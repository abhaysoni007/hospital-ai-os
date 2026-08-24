import { createHash } from 'crypto';
import { db } from '../../db';
import { auditEvents } from '../../db/schema/audit';
import { desc, sql } from 'drizzle-orm';
import { CreateAuditEventRequest } from 'shared';

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
        actionDetail: payload.actionDetail || null,
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
