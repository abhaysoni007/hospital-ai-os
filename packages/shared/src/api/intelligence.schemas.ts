import { z } from 'zod';
import { uuidSchema } from '../domain/primitives';

// ---------------------------------------------------------------------------
// Clinical Timeline Models
// ---------------------------------------------------------------------------

export const timelineEventTypeSchema = z.enum([
  'ENCOUNTER_START',
  'NOTE_SIGNED',
  'ORDER_PLACED',
  'RESULT_ENTERED',
  'TASK_CREATED',
]);
export type TimelineEventType = z.infer<typeof timelineEventTypeSchema>;

export const timelineEventSchema = z.object({
  id: z.string(), // Deterministic composition (e.g. `sourceType:sourceId`)
  type: timelineEventTypeSchema,
  sourceType: z.enum(['ENCOUNTER', 'CLINICAL_RECORD', 'DIAGNOSTIC_ORDER', 'DIAGNOSTIC_RESULT', 'TASK']),
  sourceId: uuidSchema,
  occurredAt: z.string().datetime(),
  status: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();
export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export const timelineMetadataSchema = z.object({
  generatedAt: z.string().datetime(),
  latestSourceTimestamp: z.string().datetime().nullable(),
  includedEventCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
}).strict();
export type TimelineMetadata = z.infer<typeof timelineMetadataSchema>;

export const clinicalTimelineResponseSchema = z.object({
  events: z.array(timelineEventSchema),
  metadata: timelineMetadataSchema,
}).strict();
export type ClinicalTimelineResponse = z.infer<typeof clinicalTimelineResponseSchema>;

// ---------------------------------------------------------------------------
// Diagnostic Trend Models
// ---------------------------------------------------------------------------

export const diagnosticTrendPointSchema = z.object({
  resultId: uuidSchema,
  orderId: uuidSchema,
  occurredAt: z.string().datetime(),
  testCode: z.string(),
  parameterName: z.string(),
  valueNumber: z.number().finite(),
  unit: z.string(),
  isAbnormal: z.boolean(),
  isCritical: z.boolean(),
  referenceRangeText: z.string(),
}).strict();
export type DiagnosticTrendPoint = z.infer<typeof diagnosticTrendPointSchema>;

export const diagnosticTrendResponseSchema = z.object({
  patientId: uuidSchema,
  testCode: z.string(),
  points: z.array(diagnosticTrendPointSchema).max(5),
}).strict();
export type DiagnosticTrendResponse = z.infer<typeof diagnosticTrendResponseSchema>;
