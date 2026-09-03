import { CreateAuditEventRequest } from 'shared';

/**
 * AI audit event plumbing (ADR-020 §1). Metadata-only payloads — the builder
 * shape makes it impossible to pass narrative/raw-response/values through.
 * Emission of AI_DRAFT_ACCEPTED / AI_DRAFT_REJECTED occurs at M12 binding
 * time; constants and builders ship here as ratified infrastructure.
 */
export const AI_AUDIT_EVENTS = {
  DRAFT_GENERATED: 'AI_DRAFT_GENERATED',
  SEARCH_EXECUTED: 'AI_SEARCH_EXECUTED',
  DRAFT_ACCEPTED: 'AI_DRAFT_ACCEPTED',
  DRAFT_REJECTED: 'AI_DRAFT_REJECTED',
  DRAFT_EDITED: 'AI_DRAFT_EDITED', // M12.1 P0-4: pending→edited is state-changing and must be audited
  BOTTLENECK_ANALYZED: 'AI_BOTTLENECK_ANALYZED',
} as const;

export interface AiAuditActor {
  staffId: string;
  role: string;
  departmentId: string;
}

export interface AiInteractionAuditDetail {
  capability: string;
  promptTemplateId: string;
  modelProvider: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  groundingStatus: string;
}

export function buildAiInteractionAuditEvent(params: {
  eventType: (typeof AI_AUDIT_EVENTS)[keyof typeof AI_AUDIT_EVENTS];
  actor: AiAuditActor;
  interactionId: string;
  patientId?: string | null;
  detail: AiInteractionAuditDetail;
}): CreateAuditEventRequest {
  return {
    eventType: params.eventType,
    actorId: params.actor.staffId,
    actorRole: params.actor.role,
    actorDepartment: params.actor.departmentId,
    targetType: 'AI_INTERACTION',
    targetId: params.interactionId,
    ...(params.patientId ? { patientId: params.patientId } : {}),
    actionDetail: {
      capability: params.detail.capability,
      promptTemplateId: params.detail.promptTemplateId,
      modelProvider: params.detail.modelProvider,
      modelName: params.detail.modelName,
      inputTokens: params.detail.inputTokens,
      outputTokens: params.detail.outputTokens,
      latencyMs: params.detail.latencyMs,
      groundingStatus: params.detail.groundingStatus,
    },
  };
}
