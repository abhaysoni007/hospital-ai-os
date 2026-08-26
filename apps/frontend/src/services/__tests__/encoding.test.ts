import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateClinicalRecordRequest } from 'shared';

import { apiClient } from '../api-client';
import { aiService } from '../ai-service';
import { appointmentService } from '../appointment-service';
import { clinicalService } from '../clinical-service';
import { diagnosticsService } from '../diagnostics-service';
import { encounterService } from '../encounter-service';
import { patientService } from '../patient-service';

/**
 * M12.1 P0-1 REGRESSION — single-source-of-truth serialization.
 *
 * The Full System Audit found that services pre-stringified bodies while
 * apiClient serialized again, so every frontend mutation reached Express as
 * a JSON *string* and failed Zod validation with 400.
 *
 * These tests capture the RAW body handed to fetch for every mutating
 * service call and assert it parses to a structured OBJECT (never a string),
 * i.e. exactly one serialization happened. If double encoding is ever
 * reintroduced, JSON.parse(body) yields a string and these tests FAIL.
 */

type CapturedRequest = { url: string; init: RequestInit };

let captured: CapturedRequest[] = [];

function respondOk(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

beforeEach(() => {
  captured = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ url: String(url), init: init ?? {} });
      return respondOk({ data: {} });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The wire-format invariant every mutation must satisfy. */
function expectObjectBody(callIndex = 0): Record<string, unknown> {
  const { url, init } = captured[callIndex];
  expect(init.body).toBeDefined();
  expect(typeof init.body).toBe('string'); // fetch bodies are always strings here
  // THE assertion: exactly ONE serialization — parse must yield an object.
  const parsed = JSON.parse(init.body as string);
  expect(parsed, `body sent to ${url} was double-encoded`).toBeTypeOf('object');
  expect(parsed).not.toBeNull();
  return parsed as Record<string, unknown>;
}

describe('P0-1: services send structured objects (apiClient owns serialization)', () => {
  it('patient registration body parses to an object matching the register schema shape', async () => {
    await patientService.registerPatient({
      firstName: 'Rohan',
      lastName: 'Sharma',
      dateOfBirth: '1990-05-01',
      gender: 'male',
      phonePrimary: '9876543210',
    });
    const body = expectObjectBody();
    expect(body).toMatchObject({ firstName: 'Rohan', phonePrimary: '9876543210' });
  });

  it('appointment booking body parses to an object', async () => {
    await appointmentService.bookAppointment({
      patientId: '11111111-1111-4111-8111-111111111111',
      doctorId: '22222222-2222-4222-8222-222222222222',
      departmentId: '33333333-3333-4333-8333-333333333333',
      scheduledDate: '2030-01-01',
      scheduledTime: '10:00:00',
    });
    const body = expectObjectBody();
    expect(body).toHaveProperty('scheduledDate', '2030-01-01');
  });

  it('appointment cancel body parses to an object', async () => {
    await appointmentService.cancelAppointment('44444444-4444-4444-8444-444444444444', 'duplicate');
    const body = expectObjectBody();
    expect(body).toMatchObject({ reason: 'duplicate' });
  });

  it('clinical record create body parses to an object', async () => {
    const payload: CreateClinicalRecordRequest = {
      recordType: 'soap',
      content: {
        sections: [
          { heading: 'subjective', content: 'c' },
          { heading: 'objective', content: 'c' },
          { heading: 'assessment', content: 'c' },
          { heading: 'plan', content: 'c' },
        ],
      },
    };
    await clinicalService.createClinicalRecord('55555555-5555-4555-8555-555555555555', payload);
    const body = expectObjectBody();
    expect(body).toHaveProperty('recordType', 'soap');
  });

  it('clinical record update body parses to an object', async () => {
    await clinicalService.updateClinicalRecord(
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
      { expectedVersion: 1, content: undefined, vitals: undefined },
    );
    const body = expectObjectBody();
    expect(body).toHaveProperty('expectedVersion', 1);
  });

  it('clinical record sign body parses to an object', async () => {
    await clinicalService.signClinicalRecord(
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
      3,
    );
    const body = expectObjectBody();
    expect(body).toMatchObject({ expectedVersion: 3 });
  });

  it('diagnostic order body parses to an object', async () => {
    await diagnosticsService.createOrder('55555555-5555-4555-8555-555555555555', {
      testCode: 'CBC',
      testName: 'Complete Blood Count',
      priority: 'routine',
    });
    const body = expectObjectBody();
    expect(body).toMatchObject({ testCode: 'CBC' });
  });

  it('diagnostic result entry body parses to an object', async () => {
    await diagnosticsService.enterResult('77777777-7777-4777-8777-777777777777', {
      resultValues: [{ parameterName: 'Hemoglobin', value: 9.1, unit: 'g/dL' }],
    });
    const body = expectObjectBody();
    expect(Array.isArray(body.resultValues)).toBe(true);
  });

  it('diagnostic verification body parses to an object', async () => {
    await diagnosticsService.verifyResult('77777777-7777-4777-8777-777777777777');
    const body = expectObjectBody();
    expect(body).toEqual({});
  });

  it('AI note draft body parses to an object', async () => {
    await aiService.draftNote('55555555-5555-4555-8555-555555555555', 'soap');
    const body = expectObjectBody();
    expect(body).toMatchObject({ encounterId: '55555555-5555-4555-8555-555555555555' });
  });

  it('AI interaction action body parses to an object', async () => {
    await aiService.rejectInteraction('88888888-8888-4888-8888-888888888888', 'OTHER');
    const body = expectObjectBody();
    expect(body).toMatchObject({ action: 'rejected', reasonCategory: 'OTHER' });
  });

  it('encounter activation body parses to an object', async () => {
    await encounterService.activateEncounter('55555555-5555-4555-8555-555555555555', 1);
    const body = expectObjectBody();
    expect(body).toMatchObject({ expectedVersion: 1 });
  });
});

describe('P0-1: apiClient rejects pre-stringified bodies at the programming-error level', () => {
  it('throws when a caller passes an already-stringified body', async () => {
    await expect(
      apiClient('/patients', { method: 'POST', body: JSON.stringify({ a: 1 }) }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(captured).toHaveLength(0); // nothing ever reached fetch
  });
});
