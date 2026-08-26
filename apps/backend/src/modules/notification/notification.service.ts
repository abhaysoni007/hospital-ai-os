import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { notifications } from '../../db/schema/tasks';
import { diagnosticResults } from '../../db/schema/diagnostics';
import { GetNotificationsQuery, NotificationItem, NotificationListResponse } from 'shared';
import { ConflictError, NotFoundError } from 'shared/src/errors/AppError';
import { auditService } from '../audit/audit.service';

type AuthContext = { role: string; departmentId: string };

/**
 * M12.2 — Critical notification read/workflow (minimum operational loop).
 *
 * AUTHORIZATION MODEL (no new M5 permission required — the ratified API catalog
 * defines GET/PATCH /notifications as "Any" authenticated role):
 *   - LIST: scope is ALWAYS recipient_id = actor.staffId, derived from the JWT.
 *     No client-supplied recipient/staff/patient filter exists.
 *   - ACKNOWLEDGE: owner-only. A foreign notification id is indistinguishable
 *     from a missing one (404), mirroring the AI-interaction B2 convention.
 *
 * PHI boundary (ADR-016): title/body carry test name + pointer metadata only.
 * This service never joins patient demographics into responses; the ONLY
 * enrichment is the server-resolved `relatedOrderId` navigation pointer for
 * DiagnosticResult references so physicians can open the real result through
 * its permission-controlled endpoint.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toItem(row: any, orderIdByResultId: Map<string, string>): NotificationItem {
  return {
    id: row.id,
    notificationType: row.notificationType,
    title: row.title,
    body: row.body,
    priority: row.priority,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    referenceType: row.referenceType ?? null,
    referenceId: row.referenceId ?? null,
    relatedOrderId:
      row.referenceType === 'DiagnosticResult' && row.referenceId
        ? (orderIdByResultId.get(row.referenceId) ?? null)
        : null,
  };
}

export class NotificationService {
  /** Lists the actor's own notifications. Deterministic order, bounded page. */
  async listNotifications(
    query: GetNotificationsQuery,
    actorId: string,
    _authContext: AuthContext,
  ): Promise<NotificationListResponse> {
    void _authContext;
    const page = query.page || 1;
    const limit = query.pageSize || 20;
    const offset = (page - 1) * limit;

    // Recipient scope is server-derived — query parameters cannot widen it.
    const conditions = [eq(notifications.recipientId, actorId)];
    if (query.status) conditions.push(eq(notifications.status, query.status));
    if (query.priority) conditions.push(eq(notifications.priority, query.priority));
    if (query.notificationType) {
      conditions.push(eq(notifications.notificationType, query.notificationType));
    }
    const where = and(...conditions);

    const rows = await db.query.notifications.findMany({
      where,
      orderBy: [desc(notifications.createdAt)],
      limit,
      offset,
    });

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(where);
    const total = totalRows[0]?.count ?? 0;

    // Batch-resolve DiagnosticResult → Order pointers (single IN query, no N+1).
    const resultIds = rows
      .filter((r) => r.referenceType === 'DiagnosticResult' && r.referenceId)
      .map((r) => r.referenceId as string);
    const orderIdByResultId = new Map<string, string>();
    if (resultIds.length > 0) {
      const linked = await db
        .select({ id: diagnosticResults.id, orderId: diagnosticResults.orderId })
        .from(diagnosticResults)
        .where(inArray(diagnosticResults.id, resultIds));
      for (const l of linked) orderIdByResultId.set(l.id, l.orderId);
    }

    return {
      data: rows.map((r) => toItem(r, orderIdByResultId)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Owner-scoped guarded acknowledgement (dispatched|delivered → acknowledged).
   * Atomic with its metadata-only audit event per the ADR-008 fail-safe rule.
   * Foreign/unknown ids are indistinguishable (404). Re-acknowledgement → 409.
   */
  async acknowledgeNotification(
    id: string,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ): Promise<NotificationItem> {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(notifications)
        .where(eq(notifications.id, id))
        .for('update');

      if (rows.length === 0 || rows[0].recipientId !== actorId) {
        throw new NotFoundError('Notification not found', { code: 'NOTIFICATION_NOT_FOUND' });
      }
      const row = rows[0];

      const updated = await tx
        .update(notifications)
        .set({ status: 'acknowledged', acknowledgedAt: new Date() })
        .where(
          and(eq(notifications.id, id), inArray(notifications.status, ['dispatched', 'delivered'])),
        )
        .returning();

      if (updated.length === 0) {
        throw new ConflictError('Notification has already been acknowledged.', {
          code: 'INVALID_TRANSITION',
        });
      }

      await auditService.logEvent(
        {
          eventType: 'NOTIFICATION_ACKNOWLEDGED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'NOTIFICATION',
          targetId: id,
          actionDetail: {
            notificationType: row.notificationType,
            priority: row.priority,
            referenceType: row.referenceType ?? null,
          },
        },
        correlationId,
        tx,
      );

      return toItem(updated[0], new Map());
    });
  }
}

export const notificationService = new NotificationService();
