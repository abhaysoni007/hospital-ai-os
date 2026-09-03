import { createHash } from 'crypto';
import { db } from '../../db';
import { auditEvents } from '../../db/schema/audit';
import { desc, sql } from 'drizzle-orm';
import { CreateAuditEventRequest } from 'shared';

/**
 * Canonicalize a value the way Postgres jsonb stores it, so the recorded hash
 * is reproducible from the stored row. jsonb does NOT preserve object key
 * order: it sorts keys by length first, then bytewise. Without this, any
 * actionDetail whose keys were not already in jsonb order produced a hash that
 * no verifier could recompute from the database.
 */
function jsonbCanonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(jsonbCanonical);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => {
      if (a.length !== b.length) return a.length - b.length;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    return Object.fromEntries(entries.map(([k, v]) => [k, jsonbCanonical(v)]));
  }
  return value;
}

export class AuditService {
  /**
   * Appends a new event to the immutable audit log with cryptographic hash-chaining.
   */
  async logEvent(
    payload: CreateAuditEventRequest,
    correlationId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    externalTx?: any,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runInTransaction = async (tx: any) => {
      // SECURITY REMEDIATION: Strict table lock for hash-chain concurrency
      await tx.execute(sql`LOCK TABLE audit_events IN EXCLUSIVE MODE`);

      // 1. Get the latest event for previousHash
      const latestEvent = await tx.query.auditEvents.findFirst({
        orderBy: [desc(auditEvents.sequenceNumber)],
        columns: { recordHash: true },
      });

      const previousHash =
        latestEvent?.recordHash ||
        '0000000000000000000000000000000000000000000000000000000000000000';

      // 2. Prepare payload string for hashing
      const payloadString = JSON.stringify({
        eventType: payload.eventType,
        actorId: payload.actorId,
        actorRole: payload.actorRole,
        actorDepartment: payload.actorDepartment,
        targetType: payload.targetType || null,
        targetId: payload.targetId || null,
        patientId: payload.patientId || null,
        actionDetail: jsonbCanonical(payload.actionDetail) || null,
        justification: payload.justification || null,
        ipAddress: payload.ipAddress || null,
        correlationId,
      });

      // 3. Compute new hash
      const recordHash = createHash('sha256')
        .update(previousHash + payloadString)
        .digest('hex');

      // 4. Insert event
      await tx.insert(auditEvents).values({
        eventType: payload.eventType,
        actorId: payload.actorId,
        actorRole: payload.actorRole,
        actorDepartment: payload.actorDepartment,
        targetType: payload.targetType,
        targetId: payload.targetId,
        patientId: payload.patientId,
        actionDetail: payload.actionDetail,
        justification: payload.justification,
        ipAddress: payload.ipAddress,
        correlationId,
        previousHash,
        recordHash,
      });
    };

    if (externalTx) {
      await runInTransaction(externalTx);
    } else {
      await db.transaction(runInTransaction);
    }
  }
}

export const auditService = new AuditService();
