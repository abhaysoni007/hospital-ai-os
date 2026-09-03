import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { eq, sql } from 'drizzle-orm';

import { app } from '../../../app';
import { db } from '../../../db';
import { departments, staff } from '../../../db/schema/staff';
import { resolveKeyPath } from '../../auth/auth.service';
import { config } from '../../../config';
import { aiInteractionRepository } from '../ai.persistence';
import { auditService } from '../../audit/audit.service';

/**
 * M12.1 P0-4 REGRESSION — AI interaction lifecycle actions are audited
 * atomically.
 *
 * Audit finding: PATCH /ai/interactions/:id/action mutated userAction without
 * an audit event ('edited') and audited 'rejected' non-atomically. Both paths
 * now run transition + metadata-only audit event inside ONE short transaction;
 * an audit failure rolls the state mutation back.
 */

const RUN = crypto.randomUUID().slice(0, 8);
const PHYSICIAN_EMAIL = `m121-physician@test.hospital`;

let physicianId = '';
let departmentId = '';
const createdInteractions: string[] = [];

function physicianToken(): string {
  const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
  const privateKey = fs.readFileSync(keyPath, 'utf-8');
  return jwt.sign(
    { sub: physicianId, role: 'physician', department_id: departmentId },
    privateKey,
    { algorithm: 'RS256', expiresIn: '15m' },
  );
}

async function seedPendingInteraction(): Promise<string> {
  const id = await aiInteractionRepository.create({
    interactionType: 'note_draft',
    initiatedBy: physicianId,
    patientId: null,
    encounterId: null,
    promptTemplateId: 'note_draft@1',
    contextSummary: { recordType: 'soap', manifest: [], computedGaps: [] },
    modelProvider: 'fake',
    modelName: 'fake-model',
    inputTokens: 120,
    outputTokens: 240,
    latencyMs: 42,
    rawResponseEncrypted: 'iv:tag:ciphertext',
    parsedOutput: {
      sections: [{ heading: 'subjective', content: 'PROBE_NARRATIVE_MARKER', citations: [] }],
      disclaimers: ['AI-generated draft for clinician review.'],
      informationGaps: [],
    },
    groundingStatus: 'grounded',
  });
  createdInteractions.push(id);
  return id;
}

describe('M12.1 P0-4 — AI interaction action audit integrity', () => {
  beforeAll(async () => {
    let dept = await db.query.departments.findFirst({ where: eq(departments.code, 'M121T') });
    if (!dept) {
      [dept] = await db
        .insert(departments)
        .values({ name: `M12.1 Test ${RUN}`, code: 'M121T', status: 'active' })
        .returning();
    }
    departmentId = dept.id;

    let doc = await db.query.staff.findFirst({ where: eq(staff.email, PHYSICIAN_EMAIL) });
    if (!doc) {
      [doc] = await db
        .insert(staff)
        .values({
          employeeId: `EMP-M121-PHYS`,
          email: PHYSICIAN_EMAIL,
          passwordHash: 'dummy',
          firstName: 'M121',
          lastName: 'Physician',
          role: 'physician',
          departmentId,
          status: 'active',
        })
        .returning();
    }
    physicianId = doc.id;
  });

  afterAll(async () => {
    // Audit events are retained (append-only); interactions are safe to remove.
    for (const id of createdInteractions) {
      await db.execute(sql`DELETE FROM ai_interactions WHERE id = ${id}::uuid`);
    }
  });

  it('edit action → 200, userAction=edited, AI_DRAFT_EDITED audit event exists', async () => {
    const id = await seedPendingInteraction();
    const correlationId = crypto.randomUUID();

    const res = await request(app)
      .patch(`/api/v1/ai/interactions/${id}/action`)
      .set('Authorization', `Bearer ${physicianToken()}`)
      .set('x-request-id', correlationId)
      .send({ action: 'edited' });

    expect(res.status).toBe(200);
    expect(res.body.data.userAction).toBe('edited');

    const event = await db.query.auditEvents.findFirst({
      where: sql`target_id = ${id}::uuid AND event_type = 'AI_DRAFT_EDITED'`,
    });
    expect(event).toBeDefined();
    expect(event?.actorId).toBe(physicianId);
    expect(event?.correlationId).toBe(correlationId);
    // Metadata-only payload: no narrative/raw prompt/model output may appear.
    const payloadJson = JSON.stringify(event);
    expect(payloadJson).not.toContain('PROBE_NARRATIVE_MARKER');
    expect(payloadJson).not.toContain('raw_response');
  });

  it('rejected action → audit payload carries CATEGORY only, never the free-text note', async () => {
    const id = await seedPendingInteraction();
    const correlationId = crypto.randomUUID();
    const secretNote = `SECRET_FREE_TEXT_${RUN}`;

    const res = await request(app)
      .patch(`/api/v1/ai/interactions/${id}/action`)
      .set('Authorization', `Bearer ${physicianToken()}`)
      .set('x-request-id', correlationId)
      .send({ action: 'rejected', reasonCategory: 'OTHER', reasonNote: secretNote });

    expect(res.status).toBe(200);

    const event = await db.query.auditEvents.findFirst({
      where: sql`target_id = ${id}::uuid AND event_type = 'AI_DRAFT_REJECTED'`,
    });
    expect(event).toBeDefined();
    const payloadJson = JSON.stringify(event);
    expect(payloadJson).not.toContain(secretNote); // ADR-020 §1: category-only in audit

    // The full reason lives only in the access-controlled interaction column.
    const row = await aiInteractionRepository.findById(id);
    expect(row?.rejectionReason).toContain('OTHER');
  });

  it('AUDIT FAILURE ROLLS BACK the edit transition (atomicity)', async () => {
    const id = await seedPendingInteraction();
    const spy = vi.spyOn(auditService, 'logEvent').mockRejectedValueOnce(new Error('audit down'));

    const res = await request(app)
      .patch(`/api/v1/ai/interactions/${id}/action`)
      .set('Authorization', `Bearer ${physicianToken()}`)
      .send({ action: 'edited' });

    expect(res.status).toBe(500);
    spy.mockRestore();

    const row = await aiInteractionRepository.findById(id);
    expect(row?.userAction).toBe('pending'); // mutation did not survive without audit
  });

  it('AUDIT FAILURE ROLLS BACK the reject transition (atomicity)', async () => {
    const id = await seedPendingInteraction();
    const spy = vi.spyOn(auditService, 'logEvent').mockRejectedValueOnce(new Error('audit down'));

    const res = await request(app)
      .patch(`/api/v1/ai/interactions/${id}/action`)
      .set('Authorization', `Bearer ${physicianToken()}`)
      .send({ action: 'rejected', reasonCategory: 'CLINICIAN_PREFERENCE' });

    expect(res.status).toBe(500);
    spy.mockRestore();

    const row = await aiInteractionRepository.findById(id);
    expect(row?.userAction).toBe('pending');
  });

  it('double edit → 409 INVALID_TRANSITION (guarded transition)', async () => {
    const id = await seedPendingInteraction();

    const first = await request(app)
      .patch(`/api/v1/ai/interactions/${id}/action`)
      .set('Authorization', `Bearer ${physicianToken()}`)
      .send({ action: 'edited' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .patch(`/api/v1/ai/interactions/${id}/action`)
      .set('Authorization', `Bearer ${physicianToken()}`)
      .send({ action: 'edited' });
    // ConflictError(INVALID_TRANSITION) — 409, consistent with bindAiDraftInTx
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_TRANSITION');
  });
});
