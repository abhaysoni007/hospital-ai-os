/**
 * M7 Audit module integrity tests — hash-chain continuity under concurrency,
 * append-only enforcement (DB trigger), tamper evidence.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { createHash } from 'crypto';
import { desc, gt, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { auditEvents } from '../../../db/schema/audit';
import { staff } from '../../../db/schema/staff';
import { auditService } from '../audit.service';



interface ChainRow {
  sequenceNumber: number;
  previousHash: string;
  recordHash: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  actorDepartment: string;
  targetType: string | null;
  targetId: string | null;
  patientId: string | null;
  actionDetail: unknown;
  justification: string | null;
  ipAddress: string | null;
  correlationId: string | null;
}

function canonicalPayload(row: ChainRow): string {
  return JSON.stringify({
    eventType: row.eventType,
    actorId: row.actorId,
    actorRole: row.actorRole,
    actorDepartment: row.actorDepartment,
    targetType: row.targetType,
    targetId: row.targetId,
    patientId: row.patientId,
    actionDetail: row.actionDetail,
    justification: row.justification,
    ipAddress: row.ipAddress,
    correlationId: row.correlationId,
  });
}

const CHAIN_COLUMNS = {
  sequenceNumber: auditEvents.sequenceNumber,
  previousHash: auditEvents.previousHash,
  recordHash: auditEvents.recordHash,
  eventType: auditEvents.eventType,
  actorId: auditEvents.actorId,
  actorRole: auditEvents.actorRole,
  actorDepartment: auditEvents.actorDepartment,
  targetType: auditEvents.targetType,
  targetId: auditEvents.targetId,
  patientId: auditEvents.patientId,
  actionDetail: auditEvents.actionDetail,
  justification: auditEvents.justification,
  ipAddress: auditEvents.ipAddress,
  correlationId: auditEvents.correlationId,
};

async function fetchChainRows(minSequence: number): Promise<ChainRow[]> {
  const rows = await db
    .select(CHAIN_COLUMNS)
    .from(auditEvents)
    .where(gt(auditEvents.sequenceNumber, minSequence))
    .orderBy(auditEvents.sequenceNumber);
  return rows as ChainRow[];
}

describe('M7 Audit integrity (hash chain, append-only, tamper evidence)', () => {
  let actorId: string;
  let actorDept: string;
  let baseSequence = 0;

  beforeAll(async () => {
    const actor = (await db.select().from(staff).limit(1))[0];
    actorId = actor.id;
    actorDept = actor.departmentId;
  });

  it('20 concurrent audit writes produce a continuous, recomputable hash chain', async () => {
    const before = await db
      .select({ seq: auditEvents.sequenceNumber })
      .from(auditEvents)
      .orderBy(desc(auditEvents.sequenceNumber))
      .limit(1);
    baseSequence = before[0]?.seq ?? 0;

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        auditService.logEvent(
          {
            eventType: 'TEST_AUDIT_CONCURRENT',
            actorId,
            actorRole: 'physician',
            actorDepartment: actorDept,
            targetType: 'TEST',
            targetId: crypto.randomUUID(),
          },
          crypto.randomUUID(),
        ),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    expect(failed).toHaveLength(0);

    const rows = await fetchChainRows(baseSequence);
    expect(rows.length).toBeGreaterThanOrEqual(20);

    let prevHash: string | null = null;
    for (const row of rows) {
      if (prevHash !== null) {
        expect(row.previousHash).toBe(prevHash);
      } else {
        // First row after our base: previousHash must be the hash of an existing earlier row
        const base = await db
          .select({ recordHash: auditEvents.recordHash })
          .from(auditEvents)
          .where(sql`${auditEvents.recordHash} = ${row.previousHash}`)
          .limit(1);
        expect(base).toHaveLength(1);
      }
      const expected = createHash('sha256')
        .update(row.previousHash + canonicalPayload(row))
        .digest('hex');
      expect(row.recordHash).toBe(expected);
      prevHash = row.recordHash;
    }
    // Sequence numbers strictly increasing
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].sequenceNumber).toBeGreaterThan(rows[i - 1].sequenceNumber);
    }
  });

  it('append-only: UPDATE on audit_events is rejected by the DB trigger', async () => {
    const row = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .orderBy(desc(auditEvents.sequenceNumber))
      .limit(1);
    await expect(
      db.execute(sql`UPDATE audit_events SET event_type = 'TAMPERED' WHERE id = ${row[0].id}`),
    ).rejects.toThrow();
  });

  it('append-only: DELETE on audit_events is rejected by the DB trigger', async () => {
    const row = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .orderBy(desc(auditEvents.sequenceNumber))
      .limit(1);
    await expect(
      db.execute(sql`DELETE FROM audit_events WHERE id = ${row[0].id}`),
    ).rejects.toThrow();
  });

  it('tamper evidence: flipping one payload byte breaks hash verification (recomputation detects it)', async () => {
    const rows = await fetchChainRows(baseSequence);
    const first = rows[0];
    const legitHash = createHash('sha256')
      .update(first.previousHash + canonicalPayload(first))
      .digest('hex');
    expect(legitHash).toBe(first.recordHash);

    const tamperedPayload = canonicalPayload(first).replace('TEST', 'TAMP');
    const tamperedHash = createHash('sha256')
      .update(first.previousHash + tamperedPayload)
      .digest('hex');
    expect(tamperedHash).not.toBe(first.recordHash);
  });
});
