import { eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  intelligenceApprovedActions,
  hospitalIntelligenceSignals,
} from '../../db/schema/hospital-intelligence';
import { encounters } from '../../db/schema/appointments';
import { notifications, tasks } from '../../db/schema/tasks';
import { diagnosticOrders } from '../../db/schema/diagnostics';
import { patients } from '../../db/schema/patients';
import {
  PolicyValidationResult,
  RecommendationActionType,
} from 'shared';

/**
 * M19.3 — Deterministic Policy Engine for Governed Recommendations
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §12, §14
 *
 * Core rule: AI NEVER decides whether an action is executable.
 * All checks are deterministic, synchronous, deny-by-default, and auditable.
 */

export const ALLOWLISTED_ACTION_TYPES: readonly RecommendationActionType[] = [
  'ESCALATE_ALERT',
  'NOTIFY_ATTENDING_PHYSICIAN',
  'ACKNOWLEDGE_CRITICAL_ALERT',
  'REASSIGN_TASK',
  'VIEW_PATIENT_RECORD',
  'VIEW_DIAGNOSTIC_ORDER',
] as const;

export interface PolicyActor {
  staffId: string;
  role: string;
  departmentId: string;
}

export type PolicyPhase = 'approve' | 'execute' | 'reject';

export interface EvaluatedRecommendationContext {
  recommendation: typeof intelligenceApprovedActions.$inferSelect;
  signal: typeof hospitalIntelligenceSignals.$inferSelect;
  encounterDepartmentId: string | null;
}

export class HospitalIntelligencePolicyEngine {
  /**
   * Evaluates deterministic policy rules before human approval, execution, or rejection.
   */
  async evaluatePolicy(
    actor: PolicyActor,
    recommendationId: string,
    phase: PolicyPhase,
    options?: {
      isBreakGlassActive?: boolean;
      targetAssigneeId?: string;
      idempotencyKey?: string;
    },
  ): Promise<PolicyValidationResult & { context?: EvaluatedRecommendationContext }> {
    const requiredPermission = 'intelligence:approve';

    // 1. Break-glass shortcut check: break-glass cannot be used to bypass governed action policy
    if (options?.isBreakGlassActive) {
      return {
        allowed: false,
        reasonCode: 'BREAK_GLASS_PROHIBITED',
        reason: 'Break-glass access cannot be used to bypass governed intelligence action policies.',
        requiredPermission,
        resourceScope: actor.departmentId,
      };
    }

    // 2. Role & Permission check: actor must have intelligence:approve (physician or hospital_admin)
    const allowedRoles = ['physician', 'hospital_admin'];
    if (!allowedRoles.includes(actor.role)) {
      return {
        allowed: false,
        reasonCode: 'UNAUTHORIZED_ROLE',
        reason: `Role '${actor.role}' lacks '${requiredPermission}' permission required for governed actions.`,
        requiredPermission,
        resourceScope: actor.departmentId,
      };
    }

    // 3. Recommendation existence check
    const [rec] = await db
      .select()
      .from(intelligenceApprovedActions)
      .where(eq(intelligenceApprovedActions.id, recommendationId))
      .limit(1);

    if (!rec) {
      return {
        allowed: false,
        reasonCode: 'RECOMMENDATION_NOT_FOUND',
        reason: `Recommendation with ID '${recommendationId}' was not found.`,
        requiredPermission,
        resourceScope: actor.departmentId,
      };
    }

    // 4. Action allowlist check
    if (!ALLOWLISTED_ACTION_TYPES.includes(rec.actionType as RecommendationActionType)) {
      return {
        allowed: false,
        reasonCode: 'ACTION_TYPE_NOT_ALLOWLISTED',
        reason: `Action type '${rec.actionType}' is not in the ratified governed action allowlist.`,
        requiredPermission,
        resourceScope: actor.departmentId,
      };
    }

    // 5. Parent Signal existence check
    const [signal] = await db
      .select()
      .from(hospitalIntelligenceSignals)
      .where(eq(hospitalIntelligenceSignals.id, rec.signalId))
      .limit(1);

    if (!signal) {
      return {
        allowed: false,
        reasonCode: 'SIGNAL_NOT_FOUND',
        reason: `Parent intelligence signal '${rec.signalId}' was not found.`,
        requiredPermission,
        resourceScope: actor.departmentId,
      };
    }

    // 6. Signal status check (cannot act on already dismissed or stale signals)
    if (signal.status === 'dismissed' && phase !== 'reject') {
      return {
        allowed: false,
        reasonCode: 'SIGNAL_ALREADY_DISMISSED',
        reason: 'Parent intelligence signal has already been dismissed.',
        requiredPermission,
        resourceScope: actor.departmentId,
      };
    }

    // 7. Department scope check
    let encounterDepartmentId: string | null = null;
    if (signal.encounterId) {
      const [enc] = await db
        .select({ departmentId: encounters.departmentId })
        .from(encounters)
        .where(eq(encounters.id, signal.encounterId))
        .limit(1);
      if (enc) {
        encounterDepartmentId = enc.departmentId;
      }
    }

    const resourceScope = encounterDepartmentId || actor.departmentId;

    if (actor.role !== 'hospital_admin' && encounterDepartmentId) {
      if (encounterDepartmentId !== actor.departmentId) {
        return {
          allowed: false,
          reasonCode: 'CROSS_DEPARTMENT_ACCESS_DENIED',
          reason: `Action belongs to department '${encounterDepartmentId}', but actor is in department '${actor.departmentId}'.`,
          requiredPermission,
          resourceScope,
        };
      }
    }

    // 8. Phase-specific state machine transition checks
    if (phase === 'approve') {
      if (rec.policyStatus === 'executed') {
        if (options?.idempotencyKey && rec.idempotencyKey === options.idempotencyKey) {
          // Idempotent retry: allow call to proceed so service returns cached result
        } else {
          return {
            allowed: false,
            reasonCode: 'ALREADY_EXECUTED',
            reason: 'Recommendation has already been executed.',
            requiredPermission,
            resourceScope,
          };
        }
      }
      if (rec.policyStatus === 'rejected') {
        return {
          allowed: false,
          reasonCode: 'ALREADY_REJECTED',
          reason: 'Recommendation has already been rejected and cannot be approved.',
          requiredPermission,
          resourceScope,
        };
      }
      if (rec.policyStatus !== 'proposed' && rec.policyStatus !== 'approved' && rec.policyStatus !== 'executed') {
        return {
          allowed: false,
          reasonCode: 'INVALID_STATUS_TRANSITION',
          reason: `Cannot transition recommendation from '${rec.policyStatus}' to 'approved'.`,
          requiredPermission,
          resourceScope,
        };
      }
    } else if (phase === 'execute') {
      if (rec.policyStatus === 'executed') {
        if (options?.idempotencyKey && rec.idempotencyKey === options.idempotencyKey) {
          // Idempotent retry: allow call to proceed so service returns cached result
        } else {
          return {
            allowed: false,
            reasonCode: 'ALREADY_EXECUTED',
            reason: 'Recommendation has already been executed.',
            requiredPermission,
            resourceScope,
          };
        }
      }
      if (rec.policyStatus === 'rejected') {
        return {
          allowed: false,
          reasonCode: 'ALREADY_REJECTED',
          reason: 'Recommendation has already been rejected and cannot be executed.',
          requiredPermission,
          resourceScope,
        };
      }
      // Can execute if proposed (atomic approve+execute) or approved or executed (idempotent)
      if (rec.policyStatus !== 'proposed' && rec.policyStatus !== 'approved' && rec.policyStatus !== 'executed') {
        return {
          allowed: false,
          reasonCode: 'INVALID_STATUS_TRANSITION',
          reason: `Cannot execute recommendation from status '${rec.policyStatus}'.`,
          requiredPermission,
          resourceScope,
        };
      }
    } else if (phase === 'reject') {
      if (rec.policyStatus === 'executed') {
        return {
          allowed: false,
          reasonCode: 'ALREADY_EXECUTED',
          reason: 'Executed recommendations cannot be rejected.',
          requiredPermission,
          resourceScope,
        };
      }
      if (rec.policyStatus !== 'proposed') {
        return {
          allowed: false,
          reasonCode: 'INVALID_STATUS_TRANSITION',
          reason: `Cannot reject recommendation with status '${rec.policyStatus}'.`,
          requiredPermission,
          resourceScope,
        };
      }
    }

    // 9. Underlying resource existence validation
    const resourceValid = await this.verifyUnderlyingResource(rec.actionType, signal);
    if (!resourceValid) {
      return {
        allowed: false,
        reasonCode: 'UNDERLYING_RESOURCE_NOT_FOUND',
        reason: `Underlying domain resource for action '${rec.actionType}' no longer exists or is invalid.`,
        requiredPermission,
        resourceScope,
      };
    }

    return {
      allowed: true,
      reasonCode: 'ALLOWED',
      reason: 'Deterministic policy validation passed successfully.',
      requiredPermission,
      resourceScope,
      context: {
        recommendation: rec,
        signal,
        encounterDepartmentId,
      },
    };
  }

  /**
   * Verifies that the resource targeted by the action still exists in the system.
   */
  private async verifyUnderlyingResource(
    actionType: string,
    signal: typeof hospitalIntelligenceSignals.$inferSelect,
  ): Promise<boolean> {
    try {
      if (actionType === 'ACKNOWLEDGE_CRITICAL_ALERT') {
        // Evidence should contain notification reference
        const notifRef = (signal.evidenceRefs as Array<{ sourceType: string; sourceRecordId: string }>).find(
          (e) => e.sourceType === 'NOTIFICATION',
        );
        if (!notifRef) return false;
        const [n] = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(eq(notifications.id, notifRef.sourceRecordId))
          .limit(1);
        return Boolean(n);
      }

      if (actionType === 'NOTIFY_ATTENDING_PHYSICIAN') {
        if (!signal.encounterId) return false;
        const [enc] = await db
          .select({ id: encounters.id })
          .from(encounters)
          .where(eq(encounters.id, signal.encounterId))
          .limit(1);
        return Boolean(enc);
      }

      if (actionType === 'ESCALATE_ALERT') {
        const notifRef = (signal.evidenceRefs as Array<{ sourceType: string; sourceRecordId: string }>).find(
          (e) => e.sourceType === 'NOTIFICATION',
        );
        if (notifRef) {
          const [n] = await db
            .select({ id: notifications.id })
            .from(notifications)
            .where(eq(notifications.id, notifRef.sourceRecordId))
            .limit(1);
          return Boolean(n);
        }
        return Boolean(signal.encounterId);
      }

      if (actionType === 'REASSIGN_TASK') {
        if (!signal.encounterId) return false;
        // Verify an active task exists
        const [t] = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(eq(tasks.encounterId, signal.encounterId))
          .limit(1);
        return Boolean(t);
      }

      if (actionType === 'VIEW_PATIENT_RECORD') {
        if (!signal.patientId) return false;
        const [p] = await db
          .select({ id: patients.id })
          .from(patients)
          .where(eq(patients.id, signal.patientId))
          .limit(1);
        return Boolean(p);
      }

      if (actionType === 'VIEW_DIAGNOSTIC_ORDER') {
        const orderRef = (signal.evidenceRefs as Array<{ sourceType: string; sourceRecordId: string }>).find(
          (e) => e.sourceType === 'DIAGNOSTIC_ORDER',
        );
        if (!orderRef) return false;
        const [o] = await db
          .select({ id: diagnosticOrders.id })
          .from(diagnosticOrders)
          .where(eq(diagnosticOrders.id, orderRef.sourceRecordId))
          .limit(1);
        return Boolean(o);
      }

      return false;
    } catch {
      return false;
    }
  }
}

export const hospitalIntelligencePolicyEngine = new HospitalIntelligencePolicyEngine();
