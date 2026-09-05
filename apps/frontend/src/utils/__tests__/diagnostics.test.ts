import { describe, it, expect } from 'vitest';
import {
  PRIORITY_META,
  ORDER_STATUS_LABELS,
  RESULT_STATUS_LABELS,
  canOrderDiagnostics,
  canReadDiagnostics,
  canCollectSamples,
  canCancelOrders,
  canEnterResults,
  canVerifyResults,
  canAcknowledgeCritical,
  isResultEnterer,
  buildResultPayload,
} from '../diagnostics';

/**
 * M10 frontend pure-logic tests. Gating helpers are UX-only — the backend
 * remains the authoritative enforcement point.
 */

describe('M10 diagnostics UX metadata', () => {
  it('exposes exactly the three contract priorities', () => {
    expect(Object.keys(PRIORITY_META).sort()).toEqual(['routine', 'stat', 'urgent']);
  });

  it('STAT is visually distinct from routine (tone + icon)', () => {
    expect(PRIORITY_META.stat.tone).toBe('stat');
    expect(PRIORITY_META.stat.icon).not.toBe(PRIORITY_META.routine.icon);
    expect(PRIORITY_META.stat.label).toBe('STAT');
  });

  it('status labels never rely on raw enum values for users', () => {
    expect(ORDER_STATUS_LABELS.sample_collected).toBe('Sample collected');
    expect(RESULT_STATUS_LABELS.critical_flagged).toContain('CRITICAL');
    expect(RESULT_STATUS_LABELS.verified).toContain('locked');
  });
});

describe('M10 permission gating (UX-only mirrors)', () => {
  type Role = Parameters<typeof canOrderDiagnostics>[0];

  it('physician orders + cancels; cannot collect/enter/verify', () => {
    const role = 'physician' as Role;
    expect(canOrderDiagnostics(role)).toBe(true);
    expect(canCancelOrders(role)).toBe(true);
    expect(canCollectSamples(role)).toBe(false);
    expect(canEnterResults(role)).toBe(false);
    expect(canVerifyResults(role)).toBe(false);
  });

  it('lab technician collects/enters/verifies; cannot order', () => {
    const role = 'lab_technician' as Role;
    expect(canCollectSamples(role)).toBe(true);
    expect(canEnterResults(role)).toBe(true);
    expect(canVerifyResults(role)).toBe(true);
    expect(canOrderDiagnostics(role)).toBe(false);
    expect(canCancelOrders(role)).toBe(false);
  });

  it('nurse reads only; receptionist/admin/security get nothing', () => {
    expect(canReadDiagnostics('nurse' as Role)).toBe(true);
    for (const role of ['receptionist', 'hospital_admin', 'security_admin'] as Role[]) {
      expect(canReadDiagnostics(role)).toBe(false);
      expect(canOrderDiagnostics(role)).toBe(false);
      expect(canCollectSamples(role)).toBe(false);
      expect(canEnterResults(role)).toBe(false);
      expect(canVerifyResults(role)).toBe(false);
    }
  });

  it('physicians and nurses can clinically acknowledge results; lab_tech and others cannot', () => {
    expect(canAcknowledgeCritical('physician' as Role)).toBe(true);
    expect(canAcknowledgeCritical('nurse' as Role)).toBe(true);
    expect(canAcknowledgeCritical('lab_technician' as Role)).toBe(false);
    expect(canAcknowledgeCritical('receptionist' as Role)).toBe(false);
    expect(canAcknowledgeCritical('hospital_admin' as Role)).toBe(false);
    expect(canAcknowledgeCritical('security_admin' as Role)).toBe(false);
    expect(canAcknowledgeCritical(undefined)).toBe(false);
  });

  it('missing role fails closed', () => {
    expect(canOrderDiagnostics(undefined)).toBe(false);
    expect(canCollectSamples(undefined)).toBe(false);
  });
});

describe('four-eyes helper', () => {
  const record = { enteredBy: 'tech-a-id' };

  it('identifies the enterer', () => {
    expect(isResultEnterer(record, 'tech-a-id')).toBe(true);
  });
  it('other technicians are independent verifiers', () => {
    expect(isResultEnterer(record, 'tech-b-id')).toBe(false);
  });
  it('no user id → not enterer', () => {
    expect(isResultEnterer(record, undefined)).toBe(false);
  });
});

describe('result payload builder (ADR-015/016: evaluator fields server-derived)', () => {
  it('builds a valid payload from string inputs', () => {
    const r = buildResultPayload([{ parameterName: 'Glucose', value: '100', unit: 'mg/dL' }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.resultValues[0]).toEqual({
        parameterName: 'Glucose',
        value: 100,
        unit: 'mg/dL',
      });
      expect(r.payload).not.toHaveProperty('isCritical');
      expect(r.payload).not.toHaveProperty('isAbnormal');
      expect(r.payload).not.toHaveProperty('criticalRuleId');
    }
  });

  it('collects per-row validation errors', () => {
    const r = buildResultPayload([{ parameterName: '', value: 'abc', unit: '' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain('0');
  });

  it('reports per-field errors so each input shows its own message (M17)', () => {
    const r = buildResultPayload([{ parameterName: '', value: 'abc', unit: '' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const row = r.errors[0];
      expect(row.parameterName).toBeTruthy();
      expect(row.value).toBeTruthy();
      expect(row.unit).toBeTruthy();
      // Three distinct messages, not one concatenated string.
      expect(new Set([row.parameterName, row.value, row.unit]).size).toBe(3);
    }
  });

  it('an empty value field is a validation error, never a silent 0 (M17 regression)', () => {
    const r = buildResultPayload([{ parameterName: 'Glucose', value: '', unit: 'mg/dL' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.value).toBeTruthy();
      expect(r.errors[0]?.parameterName).toBeUndefined();
      expect(r.errors[0]?.unit).toBeUndefined();
    }
  });

  it('whitespace-only rows are rejected rather than coerced to 0', () => {
    const r = buildResultPayload([{ parameterName: '  ', value: '   ', unit: ' ' }]);
    expect(r.ok).toBe(false);
  });

  it('rejects an all-empty form', () => {
    expect(buildResultPayload([]).ok).toBe(false);
  });
});
