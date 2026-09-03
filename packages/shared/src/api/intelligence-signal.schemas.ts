import { z } from 'zod';
import { uuidSchema } from '../domain/primitives';
import { citationSchema, gapCodeSchema, groundingStatusSchema } from './ai.schemas';

/**
 * M19 — Hospital Intelligence Signal Contracts
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §9, §10, §11
 *
 * Strict, validated contracts for deterministic workflow signals,
 * manifest-backed evidence references, and bounded recommendations.
 */

// ---------------------------------------------------------------------------
// Signal vocabulary
// ---------------------------------------------------------------------------

export const signalTypeSchema = z.enum([
  'PENDING_DIAGNOSTIC_RESULT',
  'CRITICAL_RESULT_UNACKNOWLEDGED',
  'ENCOUNTER_WITHOUT_CLINICAL_RECORD',
]);
export type SignalType = z.infer<typeof signalTypeSchema>;

export const signalSeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export type SignalSeverity = z.infer<typeof signalSeveritySchema>;

export const signalStatusSchema = z.enum([
  'detected',
  'analyzed',
  'actioned',
  'dismissed',
  'resolved',
  'stale',
]);
export type SignalStatus = z.infer<typeof signalStatusSchema>;

// ---------------------------------------------------------------------------
// Evidence model (manifest-validated real record references)
// ---------------------------------------------------------------------------

export const evidenceSourceTypeSchema = z.enum([
  'DIAGNOSTIC_ORDER',
  'DIAGNOSTIC_RESULT',
  'ENCOUNTER',
  'CLINICAL_RECORD',
  'NOTIFICATION',
  'TASK',
]);
export type EvidenceSourceType = z.infer<typeof evidenceSourceTypeSchema>;

export const evidenceStatusSchema = z.enum([
  'present',
  'insufficient',
  'missing',
  'unauthorized',
]);
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;

export const evidenceRefSchema = z
  .object({
    evidenceId: uuidSchema,
    sourceType: evidenceSourceTypeSchema,
    sourceRecordId: uuidSchema,
    relevantAt: z.string().datetime(),
    evidenceStatus: evidenceStatusSchema,
    authorizedVisibility: z.boolean(),
    relationToSignal: z.string().trim().min(1).max(200),
  })
  .strict();
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

// ---------------------------------------------------------------------------
// Recommendation model (bounded action vocabulary, governed by policy)
// ---------------------------------------------------------------------------

export const recommendationActionTypeSchema = z.enum([
  'ESCALATE_ALERT',
  'NOTIFY_ATTENDING_PHYSICIAN',
  'ACKNOWLEDGE_CRITICAL_ALERT',
  'REASSIGN_TASK',
  'VIEW_PATIENT_RECORD',
  'VIEW_DIAGNOSTIC_ORDER',
]);
export type RecommendationActionType = z.infer<typeof recommendationActionTypeSchema>;

export const recommendationStatusSchema = z.enum([
  'proposed',
  'approved',
  'executed',
  'rejected',
  'policy_rejected',
  'execution_failed',
  'insufficient_evidence',
  'unavailable',
]);
export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;

export const recommendationSchema = z
  .object({
    recommendationId: uuidSchema,
    signalId: uuidSchema,
    actionType: recommendationActionTypeSchema,
    rationale: z.string().trim().min(1).max(2000),
    evidenceRefs: z.array(uuidSchema),
    uncertaintyNote: z.string().trim().max(500).optional(),
    limitationsNote: z.string().trim().max(500).optional(),
    requiresHumanApproval: z.boolean(),
    policyStatus: recommendationStatusSchema,
    executableStatus: recommendationStatusSchema,
    createdAt: z.string().datetime(),
  })
  .strict();
export type Recommendation = z.infer<typeof recommendationSchema>;

// ---------------------------------------------------------------------------
// AI Explanation model (bounded summarization of detected signal)
// ---------------------------------------------------------------------------

export const aiExplanationSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    clinicalImpact: z.string().trim().max(2000).optional(),
    citations: z.array(citationSchema),
    disclaimers: z.array(z.string().trim().min(1).max(300)).min(1),
    informationGaps: z.array(gapCodeSchema),
    groundingStatus: groundingStatusSchema,
  })
  .strict();
export type AiExplanation = z.infer<typeof aiExplanationSchema>;

export const hospitalBottleneckRecommendationProposalSchema = z
  .object({
    actionType: recommendationActionTypeSchema,
    rationale: z.string().trim().min(1).max(2000),
    uncertaintyNote: z.string().trim().max(500).optional(),
    limitationsNote: z.string().trim().max(500).optional(),
  })
  .strict();
export type HospitalBottleneckRecommendationProposal = z.infer<
  typeof hospitalBottleneckRecommendationProposalSchema
>;

export const hospitalBottleneckOutputSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    clinicalImpact: z.string().trim().max(2000).optional(),
    citations: z.array(citationSchema).min(1),
    disclaimers: z.array(z.string().trim().min(1).max(300)).min(1),
    informationGaps: z.array(gapCodeSchema),
    recommendation: hospitalBottleneckRecommendationProposalSchema,
  })
  .strict();
export type HospitalBottleneckOutput = z.infer<typeof hospitalBottleneckOutputSchema>;

// ---------------------------------------------------------------------------
// Detected Signal contract
// ---------------------------------------------------------------------------

export const detectedSignalSchema = z
  .object({
    signalId: uuidSchema,
    signalType: signalTypeSchema,
    severity: signalSeveritySchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(1000),
    detectedAt: z.string().datetime(),
    status: signalStatusSchema,
    patientId: uuidSchema.nullable(),
    encounterId: uuidSchema.nullable(),
    evidenceRefs: z.array(evidenceRefSchema).min(1),
    deterministicReason: z.string().trim().min(1).max(500),
    aiExplanation: aiExplanationSchema.nullable().optional(),
    recommendation: recommendationSchema.nullable().optional(),
    correlationId: uuidSchema,
  })
  .strict();
export type DetectedSignal = z.infer<typeof detectedSignalSchema>;

// ---------------------------------------------------------------------------
// API Request and Response primitives
// ---------------------------------------------------------------------------

export const analyzeHospitalIntelligenceRequestSchema = z
  .object({
    scope: z.enum(['department', 'hospital_admin']).default('department'),
    limit: z.number().int().min(1).max(50).default(10).optional(),
  })
  .strict();
export type AnalyzeHospitalIntelligenceRequest = z.infer<
  typeof analyzeHospitalIntelligenceRequestSchema
>;

export const hospitalIntelligenceAnalysisResponseSchema = z
  .object({
    analysisId: uuidSchema,
    requestedAt: z.string().datetime(),
    signals: z.array(detectedSignalSchema),
    aiStatus: z.enum(['grounded', 'degraded', 'unavailable']),
    correlationId: uuidSchema,
  })
  .strict();
export type HospitalIntelligenceAnalysisResponse = z.infer<
  typeof hospitalIntelligenceAnalysisResponseSchema
>;

export const approveRecommendationRequestSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(255),
  })
  .strict();
export type ApproveRecommendationRequest = z.infer<
  typeof approveRecommendationRequestSchema
>;

export const rejectRecommendationRequestSchema = z
  .object({
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .strict();
export type RejectRecommendationRequest = z.infer<
  typeof rejectRecommendationRequestSchema
>;
