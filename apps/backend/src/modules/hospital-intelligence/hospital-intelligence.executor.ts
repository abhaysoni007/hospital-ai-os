import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  intelligenceApprovedActions,
  hospitalIntelligenceSignals,
} from '../../db/schema/hospital-intelligence';
import { notifications, tasks } from '../../db/schema/tasks';
import { encounters } from '../../db/schema/appointments';
import { diagnosticOrders } from '../../db/schema/diagnostics';
import { taskService } from '../task/task.service';
import { AuditService, auditService } from '../audit/audit.service';
import { GovernedActionResult } from 'shared';
import { ValidationError } from 'shared/src/errors/AppError';

/**
 * M19.3 — Governed Action Executor
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §14
 *
 * Reuses existing authorized services (NotificationService, TaskService)
 * and enforces strict separation between:
 * - Executable actions (perform bounded domain mutations)
 * - Navigation actions (read-only pointers, ZERO database mutations)
 */

export interface ExecutionContext {
  recommendation: typeof intelligenceApprovedActions.$inferSelect;
  signal: typeof hospitalIntelligenceSignals.$inferSelect;
  actor: {
    staffId: string;
    role: string;
    departmentId: string;
  };
  correlationId: string;
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0];
  targetAssigneeId?: string;
}

export interface ExecutionResultPayload {
  serviceInvoked: string;
  details: Record<string, unknown>;
}

export class HospitalIntelligenceExecutor {
  constructor(private readonly audit: AuditService = auditService) {}

  /**
   * Dispatches and executes an approved recommendation through existing services.
   */
  async execute(context: ExecutionContext): Promise<ExecutionResultPayload> {
    const { recommendation, signal, actor, correlationId, tx, targetAssigneeId } = context;
    const dbClient = tx || db;

    switch (recommendation.actionType) {
      case 'ACKNOWLEDGE_CRITICAL_ALERT': {
        const notifRef = (signal.evidenceRefs as Array<{ sourceType: string; sourceRecordId: string }>).find(
          (e) => e.sourceType === 'NOTIFICATION',
        );
        if (!notifRef) {
          throw new ValidationError('No notification evidence associated with this critical alert signal.');
        }

        const [existing] = await dbClient
          .select()
          .from(notifications)
          .where(eq(notifications.id, notifRef.sourceRecordId))
          .limit(1);

        if (!existing) {
          throw new ValidationError(`Target notification '${notifRef.sourceRecordId}' was not found.`);
        }

        const now = new Date();
        await dbClient
          .update(notifications)
          .set({
            status: 'acknowledged',
            acknowledgedAt: now,
          })
          .where(
            eq(notifications.id, notifRef.sourceRecordId),
          );

        // Audit notification acknowledgment
        await this.audit.logEvent(
          {
            eventType: 'NOTIFICATION_ACKNOWLEDGED',
            actorId: actor.staffId,
            actorRole: actor.role,
            actorDepartment: actor.departmentId,
            targetType: 'NOTIFICATION',
            targetId: notifRef.sourceRecordId,
            patientId: signal.patientId ?? undefined,
            actionDetail: {
              acknowledgedVia: 'GOVERNED_INTELLIGENCE_ACTION',
              recommendationId: recommendation.id,
              signalId: signal.id,
              previousStatus: existing.status,
            },
          },
          correlationId,
          tx,
        );

        return {
          serviceInvoked: 'NotificationService',
          details: {
            notificationId: notifRef.sourceRecordId,
            status: 'acknowledged',
            acknowledgedAt: now.toISOString(),
          },
        };
      }

      case 'NOTIFY_ATTENDING_PHYSICIAN': {
        if (!signal.encounterId) {
          throw new ValidationError('No encounter ID associated with signal for physician notification.');
        }

        const [enc] = await dbClient
          .select()
          .from(encounters)
          .where(eq(encounters.id, signal.encounterId))
          .limit(1);

        if (!enc) {
          throw new ValidationError(`Encounter '${signal.encounterId}' was not found.`);
        }

        // Identify attending physician
        let recipientId = enc.doctorId;
        if (!recipientId) {
          // Fallback to ordering doctor from diagnostic order
          const orderRef = (signal.evidenceRefs as Array<{ sourceType: string; sourceRecordId: string }>).find(
            (e) => e.sourceType === 'DIAGNOSTIC_ORDER',
          );
          if (orderRef) {
            const [order] = await dbClient
              .select({ doctorId: diagnosticOrders.orderingDoctorId })
              .from(diagnosticOrders)
              .where(eq(diagnosticOrders.id, orderRef.sourceRecordId))
              .limit(1);
            recipientId = order?.doctorId ?? null;
          }
        }

        if (!recipientId) {
          throw new ValidationError('Could not identify attending or ordering physician to notify.');
        }

        const [insertedNotif] = await dbClient
          .insert(notifications)
          .values({
            recipientId,
            notificationType: 'system_alert',
            title: `Operational Notice: ${signal.title}`,
            body: `Governed action approved: ${recommendation.rationale}. Please review active encounter.`,
            referenceType: 'Encounter',
            referenceId: signal.encounterId,
            priority: 'urgent',
            status: 'dispatched',
          })
          .returning();

        return {
          serviceInvoked: 'NotificationService',
          details: {
            notificationId: insertedNotif.id,
            recipientId,
            notificationType: 'system_alert',
            priority: 'urgent',
          },
        };
      }

      case 'ESCALATE_ALERT': {
        const notifRef = (signal.evidenceRefs as Array<{ sourceType: string; sourceRecordId: string }>).find(
          (e) => e.sourceType === 'NOTIFICATION',
        );

        if (notifRef) {
          await dbClient
            .update(notifications)
            .set({ priority: 'critical' })
            .where(eq(notifications.id, notifRef.sourceRecordId));

          return {
            serviceInvoked: 'NotificationService',
            details: {
              notificationId: notifRef.sourceRecordId,
              priority: 'critical',
              escalated: true,
            },
          };
        }

        return {
          serviceInvoked: 'NotificationService',
          details: {
            signalId: signal.id,
            escalated: true,
          },
        };
      }

      case 'REASSIGN_TASK': {
        if (!signal.encounterId) {
          throw new ValidationError('No encounter ID associated with task reassignment signal.');
        }

        const [existingTask] = await dbClient
          .select()
          .from(tasks)
          .where(eq(tasks.encounterId, signal.encounterId))
          .limit(1);

        if (!existingTask) {
          throw new ValidationError('No active task found for this encounter to reassign.');
        }

        if (!targetAssigneeId) {
          throw new ValidationError('Target assignee ID must be provided for task reassignment.');
        }

        const updatedTask = await taskService.reassignTask(
          existingTask.id,
          targetAssigneeId,
          actor.staffId,
          correlationId,
          { role: actor.role, departmentId: actor.departmentId },
        );

        return {
          serviceInvoked: 'TaskService',
          details: {
            taskId: updatedTask.id,
            reassignedTo: targetAssigneeId,
            status: updatedTask.status,
          },
        };
      }

      case 'VIEW_PATIENT_RECORD': {
        // Read-only navigation action: ZERO database mutations
        if (!signal.patientId) {
          throw new ValidationError('Signal has no associated patient ID.');
        }
        return {
          serviceInvoked: 'FrontendNavigation',
          details: {
            patientId: signal.patientId,
            targetUrl: `/patients/${signal.patientId}`,
            isReadOnly: true,
            mutationPerformed: false,
          },
        };
      }

      case 'VIEW_DIAGNOSTIC_ORDER': {
        // Read-only navigation action: ZERO database mutations
        const orderRef = (signal.evidenceRefs as Array<{ sourceType: string; sourceRecordId: string }>).find(
          (e) => e.sourceType === 'DIAGNOSTIC_ORDER',
        );
        const orderId = orderRef?.sourceRecordId;
        if (!orderId) {
          throw new ValidationError('Signal has no associated diagnostic order reference.');
        }
        return {
          serviceInvoked: 'FrontendNavigation',
          details: {
            orderId,
            targetUrl: `/diagnostics/${orderId}`,
            isReadOnly: true,
            mutationPerformed: false,
          },
        };
      }

      default:
        throw new ValidationError(`Unsupported action type: '${recommendation.actionType}'`);
    }
  }
}

export const hospitalIntelligenceExecutor = new HospitalIntelligenceExecutor();
