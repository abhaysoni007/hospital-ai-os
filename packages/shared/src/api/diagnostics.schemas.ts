import { z } from 'zod';
import { offsetPaginationSchema } from './pagination';
import { uuidSchema } from '../domain/primitives';

/**
 * M10 — Diagnostics/Lab contracts (ADR-016 binding).
 *
 * SECURITY: `isAbnormal`, `isCritical` and `criticalRuleId` are computed
 * SERVER-SIDE by the deterministic rule evaluator (ADR-010). They are never
 * accepted from callers and never appear in request schemas.
 * Result amendment/correction is deferred — no update schema exists.
 */

export const orderPrioritySchema = z.enum(['routine', 'urgent', 'stat']);

export type OrderPriority = z.infer<typeof orderPrioritySchema>;

export const diagnosticOrderStatusSchema = z.enum([
  'ordered',
  'sample_collected',
  'in_progress', // authoritative enum state; no user-triggered M10 endpoint (ADR-016 Decision 3)
  'completed',
  'cancelled',
]);

export type DiagnosticOrderStatus = z.infer<typeof diagnosticOrderStatusSchema>;

export const diagnosticResultStatusSchema = z.enum(['preliminary', 'verified', 'critical_flagged']);

export type DiagnosticResultStatus = z.infer<typeof diagnosticResultStatusSchema>;

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const createDiagnosticOrderSchema = z.object({
  testCode: z.string().trim().min(1).max(50),
  testName: z.string().trim().min(1).max(200),
  priority: orderPrioritySchema.default('routine'),
  clinicalIndication: z.string().trim().max(2000).optional(),
  /**
   * M18: optional client-supplied idempotency key. The same (encounterId, key)
   * pair returns the originally created order instead of producing a duplicate.
   * Scoped per encounter so a key reused on a different encounter is permitted.
   */
  clientRequestId: z.string().trim().min(1).max(100).optional(),
});

/** Input type: `priority` optional (default applied by the schema at the boundary). */
export type CreateDiagnosticOrderRequest = z.input<typeof createDiagnosticOrderSchema>;

export const getDiagnosticOrdersQuerySchema = offsetPaginationSchema.extend({
  status: diagnosticOrderStatusSchema.optional(),
  priority: orderPrioritySchema.optional(),
  date: z.string().date().optional(),
});

export type GetDiagnosticOrdersQuery = z.infer<typeof getDiagnosticOrdersQuerySchema>;

export const cancelDiagnosticOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CancelDiagnosticOrderRequest = z.infer<typeof cancelDiagnosticOrderSchema>;

/** Lab-workflow order representation (queue + detail + encounter list). */
export interface DiagnosticOrderResponse {
  id: string;
  encounterId: string;
  patientId: string;
  orderingDoctorId: string;
  testCode: string;
  testName: string;
  priority: OrderPriority;
  status: DiagnosticOrderStatus;
  clinicalIndication: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** One measured parameter. Values are numbers; qualitative inputs are rejected. */
export const resultValueSchema = z
  .object({
    parameterName: z.string().trim().min(1).max(100),
    value: z.number().finite(),
    unit: z.string().trim().min(1).max(20),
  })
  .strict();

export type ResultValue = z.infer<typeof resultValueSchema>;

export const enterResultSchema = z.object({
  resultValues: z.array(resultValueSchema).min(1).max(50),
});

export type EnterResultRequest = z.infer<typeof enterResultSchema>;

/** Verification carries no body fields; the actor is derived from the JWT. */
export const verifyResultSchema = z.object({}).optional();

// --- Evaluation snapshot (persisted in reference_range JSONB) ---------------

export const evaluationVerdictSchema = z.enum(['normal', 'abnormal', 'critical', 'unevaluated']);

export const unevaluatedReasonSchema = z.enum([
  'UNIT_MISMATCH',
  'NON_NUMERIC',
  'NO_RULE',
  'NO_BOUNDS',
]);

export const parameterEvaluationSchema = z.object({
  parameterName: z.string(),
  suppliedUnit: z.string(),
  verdict: evaluationVerdictSchema,
  reason: unevaluatedReasonSchema.optional(),
  bounds: z
    .object({
      normalLow: z.number().nullable(),
      normalHigh: z.number().nullable(),
      criticalLow: z.number().nullable(),
      criticalHigh: z.number().nullable(),
    })
    .optional(),
});

export const evaluationSnapshotSchema = z.object({
  parameters: z.array(parameterEvaluationSchema),
  isAbnormal: z.boolean(),
  isCritical: z.boolean(),
  matchedRuleIds: z.array(uuidSchema),
});

export type ParameterEvaluation = z.infer<typeof parameterEvaluationSchema>;
export type EvaluationSnapshot = z.infer<typeof evaluationSnapshotSchema>;

/** PHI/Critical — served only behind `diagnostic_result:read`. */
export interface DiagnosticResultResponse {
  id: string;
  orderId: string;
  patientId: string;
  testCode: string;
  resultValues: Array<{ parameterName: string; value: number; unit: string }>;
  referenceRange: EvaluationSnapshot | null;
  isAbnormal: boolean;
  isCritical: boolean;
  criticalRuleId: string | null;
  status: DiagnosticResultStatus;
  enteredBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  /** M-ACK: set when a physician/nurse clinically acknowledges a critical result. */
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
