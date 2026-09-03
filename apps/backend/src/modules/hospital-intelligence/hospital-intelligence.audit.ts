import { CreateAuditEventRequest } from 'shared';

/**
 * M19 — Hospital Intelligence Audit Events (ADR-020, M19.0 §17)
 * Metadata-only payloads. Raw clinical narrative or PHI is never included in actionDetail.
 */
export const HOSPITAL_INTELLIGENCE_AUDIT_EVENTS = {
  ANALYSIS_REQUESTED: 'INTELLIGENCE_ANALYSIS_REQUESTED',
  ANALYSIS_COMPLETED: 'INTELLIGENCE_ANALYSIS_COMPLETED',
  SIGNAL_DETECTED: 'SIGNAL_DETECTED',
  SIGNAL_DISMISSED: 'SIGNAL_DISMISSED',
  RECOMMENDATION_CREATED: 'RECOMMENDATION_CREATED',
  RECOMMENDATION_PROPOSED: 'RECOMMENDATION_PROPOSED',
  RECOMMENDATION_APPROVED: 'RECOMMENDATION_APPROVED',
  RECOMMENDATION_REJECTED: 'RECOMMENDATION_REJECTED',
  RECOMMENDATION_POLICY_REJECTED: 'RECOMMENDATION_POLICY_REJECTED',
  ACTION_APPROVED: 'ACTION_APPROVED',
  ACTION_EXECUTED: 'ACTION_EXECUTED',
  ACTION_FAILED: 'ACTION_FAILED',
} as const;

export type HospitalIntelligenceAuditEvent =
  (typeof HOSPITAL_INTELLIGENCE_AUDIT_EVENTS)[keyof typeof HOSPITAL_INTELLIGENCE_AUDIT_EVENTS];

export interface IntelligenceAuditActor {
  staffId: string;
  role: string;
  departmentId: string;
}

export function buildHospitalIntelligenceAuditEvent(params: {
  eventType: HospitalIntelligenceAuditEvent;
  actor: IntelligenceAuditActor;
  targetType: string;
  targetId?: string;
  patientId?: string | null;
  actionDetail?: Record<string, unknown>;
  justification?: string;
}): CreateAuditEventRequest {
  return {
    eventType: params.eventType,
    actorId: params.actor.staffId,
    actorRole: params.actor.role,
    actorDepartment: params.actor.departmentId,
    targetType: params.targetType,
    ...(params.targetId ? { targetId: params.targetId } : {}),
    ...(params.patientId ? { patientId: params.patientId } : {}),
    actionDetail: params.actionDetail ?? {},
    ...(params.justification ? { justification: params.justification } : {}),
  };
}
