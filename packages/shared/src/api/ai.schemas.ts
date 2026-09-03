import { z } from 'zod';
import { uuidSchema } from '../domain/primitives';
import { patientGenderSchema } from './patient.schemas';
import { clinicalRecordTypeSchema } from './clinical.schemas';
import {
  orderPrioritySchema,
  diagnosticOrderStatusSchema,
  diagnosticResultStatusSchema,
  evaluationVerdictSchema,
} from './diagnostics.schemas';
import { encounterTypeSchema, encounterStatusSchema } from './encounter.schemas';

/**
 * M11 — AI infrastructure contracts (ADR-017/018/019/020 binding).
 *
 * These schemas are the ONLY shapes through which AI context, AI output,
 * citations, gaps and interaction metadata may flow. Arbitrary AI JSON is
 * rejected before it can reach application state.
 *
 * M11 ships infrastructure primitives only. The M12 business capabilities
 * (note drafting, chart brief) consume these contracts.
 */

// ---------------------------------------------------------------------------
// Capability & interaction-type vocabulary
// ---------------------------------------------------------------------------

/** DB enum mirror: ai_interaction_type. `discharge_draft`/`ocr` reserved, not implemented. */
export const aiInteractionTypeSchema = z.enum([
  'note_draft',
  'chart_search',
  'discharge_draft',
  'ocr',
  'hospital_bottleneck',
]);
export type AiInteractionType = z.infer<typeof aiInteractionTypeSchema>;

/** Capabilities implemented by the ratified M11/M12/M19 scope. */
export const aiCapabilitySchema = z.enum([
  'note_draft',
  'chart_search',
  'hospital_bottleneck',
]);
export type AiCapability = z.infer<typeof aiCapabilitySchema>;

export const groundingStatusSchema = z.enum(['unverified', 'grounded', 'validation_failed']);
export const aiUserActionSchema = z.enum(['pending', 'accepted', 'rejected', 'edited']);

// ---------------------------------------------------------------------------
// Citations & input manifest
// ---------------------------------------------------------------------------

/** Approved citation source classes (ADR-018 §5 manifest vocabulary, M19 intelligence). */
export const citationSourceTypeSchema = z.enum([
  'CLINICAL_RECORD',
  'DIAGNOSTIC_ORDER',
  'DIAGNOSTIC_RESULT',
  'ENCOUNTER',
  'NOTIFICATION',
]);
export type CitationSourceType = z.infer<typeof citationSourceTypeSchema>;

export const citationSchema = z.object({
  sourceType: citationSourceTypeSchema,
  sourceId: uuidSchema,
  excerpt: z.string().trim().min(1).max(200),
});
export type Citation = z.infer<typeof citationSchema>;

/** One assembled-and-authorized context source, persisted per interaction. */
export const inputManifestEntrySchema = z.object({
  sourceType: citationSourceTypeSchema,
  sourceId: uuidSchema,
  /** Clinical-record version captured at assembly time (staleness model, ADR-019). */
  version: z.number().int().positive().optional(),
  capturedAt: z.string().datetime(),
});
export type InputManifestEntry = z.infer<typeof inputManifestEntrySchema>;

// ---------------------------------------------------------------------------
// Information gaps
// ---------------------------------------------------------------------------

/**
 * System-computed gap codes (ADR-018 §6). Extensible only by new schema
 * version; the model echoes codes — it never invents the authoritative list.
 */
export const gapCodeSchema = z.enum([
  'NO_CHIEF_COMPLAINT',
  'NO_VITALS_SIGNS',
  'NO_PRIOR_NOTES',
  'NO_DIAGNOSTIC_ORDERS',
  'NO_DIAGNOSTIC_RESULTS',
  'NO_MEDICATION_HISTORY',
  'NO_ALLERGY_DATA',
  // M19 — Hospital workflow information gaps
  'NO_ACTIVE_ENCOUNTERS',
  'NO_PENDING_ORDERS',
  'NO_CRITICAL_ALERTS',
]);
export type GapCode = z.infer<typeof gapCodeSchema>;

// ---------------------------------------------------------------------------
// Context blocks — allowlist projections (ADR-018 §2/§4)
// ---------------------------------------------------------------------------

const boundedText = (min: number, max: number) => z.string().trim().min(min).max(max);

export const patientDemographicsBlockSchema = z
  .object({
    blockType: z.literal('patient_demographics'),
    ageYears: z.number().int().min(0).max(130),
    gender: patientGenderSchema,
  })
  .strict();

export const encounterMetadataBlockSchema = z
  .object({
    blockType: z.literal('encounter_metadata'),
    sourceId: uuidSchema.optional(),
    encounterType: encounterTypeSchema,
    status: encounterStatusSchema,
    startedAt: z.string().datetime().nullable(),
    departmentName: boundedText(1, 100),
    chiefComplaint: boundedText(1, 2000).optional(),
  })
  .strict();

export const clinicalRecordBlockSchema = z
  .object({
    blockType: z.literal('clinical_record'),
    sourceId: uuidSchema,
    recordType: clinicalRecordTypeSchema,
    version: z.number().int().positive(),
    recordedAt: z.string().datetime(),
    textContent: boundedText(1, 20000),
  })
  .strict();

export const diagnosticOrderBlockSchema = z
  .object({
    blockType: z.literal('diagnostic_order'),
    sourceId: uuidSchema,
    testCode: boundedText(1, 50),
    testName: boundedText(1, 200),
    priority: orderPrioritySchema,
    status: diagnosticOrderStatusSchema,
    createdAt: z.string().datetime(),
  })
  .strict();

export const diagnosticParameterSchema = z
  .object({
    parameterName: boundedText(1, 100),
    valueNumber: z.number().finite(),
    unit: boundedText(1, 20),
    verdict: evaluationVerdictSchema,
    referenceRangeText: boundedText(1, 100),
  })
  .strict();

export const diagnosticResultBlockSchema = z
  .object({
    blockType: z.literal('diagnostic_result'),
    sourceId: uuidSchema,
    relatedOrderSourceId: uuidSchema,
    status: diagnosticResultStatusSchema,
    isCritical: z.boolean(),
    parameters: z.array(diagnosticParameterSchema).min(1),
  })
  .strict();

export const contextBlockSchema = z.discriminatedUnion('blockType', [
  patientDemographicsBlockSchema,
  encounterMetadataBlockSchema,
  clinicalRecordBlockSchema,
  diagnosticOrderBlockSchema,
  diagnosticResultBlockSchema,
]);
export type ContextBlock = z.infer<typeof contextBlockSchema>;

// ---------------------------------------------------------------------------
// Structured output contracts (capability primitives)
// ---------------------------------------------------------------------------

const soapHeadingSchema = z.enum(['subjective', 'objective', 'assessment', 'plan']);

const citedSectionShape = z.object({
  heading: soapHeadingSchema,
  content: boundedText(1, 10_000),
  citations: z.array(citationSchema).max(20),
});

const disclaimersShape = z.array(z.string().trim().min(1).max(300)).min(1);

/**
 * SOAP note-draft output primitive. Mirrors ADR-015 content constraints and
 * adds the ratified AI-side stricter rule: each heading EXACTLY once
 * (the frozen M9 shared schema is intentionally NOT modified — ADR-019 §5).
 */
export const soapNoteDraftOutputSchema = z
  .object({
    sections: z.tuple([citedSectionShape, citedSectionShape, citedSectionShape, citedSectionShape]),
    disclaimers: disclaimersShape,
    informationGaps: z.array(gapCodeSchema),
  })
  .superRefine((val, ctx) => {
    const seen = new Map<string, number>();
    for (const s of val.sections) seen.set(s.heading, (seen.get(s.heading) ?? 0) + 1);
    for (const [heading, count] of seen) {
      if (count > 1) {
        ctx.addIssue({ code: 'custom', message: `Duplicate SOAP heading: ${heading}` });
      }
    }
    for (const h of ['subjective', 'objective', 'assessment', 'plan'] as const) {
      if (!seen.has(h)) {
        ctx.addIssue({ code: 'custom', message: `Missing SOAP heading: ${h}` });
      }
    }
  });
export type SoapNoteDraftOutput = z.infer<typeof soapNoteDraftOutputSchema>;

export const progressNoteDraftOutputSchema = z
  .object({
    narrative: boundedText(1, 20_000),
    citations: z.array(citationSchema).max(40),
    disclaimers: disclaimersShape,
    informationGaps: z.array(gapCodeSchema),
  })
  .strict();
export type ProgressNoteDraftOutput = z.infer<typeof progressNoteDraftOutputSchema>;

/** Chart-answer output primitive (grounded brief; read-only capability). */
export const chartAnswerOutputSchema = z
  .object({
    summary: boundedText(1, 8000),
    citations: z.array(citationSchema).min(1).max(60),
    disclaimers: disclaimersShape,
    informationGaps: z.array(gapCodeSchema),
  })
  .strict();
export type ChartAnswerOutput = z.infer<typeof chartAnswerOutputSchema>;

// ---------------------------------------------------------------------------
// Request primitives (M12 consumes; defined here as frozen contract)
// ---------------------------------------------------------------------------

export const noteDraftRequestPrimitiveSchema = z
  .object({
    encounterId: uuidSchema,
    recordType: z.enum(['soap', 'progress_note']),
    instructions: boundedText(0, 2000).optional(),
  })
  .strict();
export type NoteDraftRequestPrimitive = z.infer<typeof noteDraftRequestPrimitiveSchema>;

export const chartSearchRequestPrimitiveSchema = z
  .object({
    patientId: uuidSchema,
    question: boundedText(0, 2000).optional(),
  })
  .strict();
export type ChartSearchRequestPrimitive = z.infer<typeof chartSearchRequestPrimitiveSchema>;

// ---------------------------------------------------------------------------
// Validation pipeline result & interaction metadata
// ---------------------------------------------------------------------------

export const validationStageSchema = z.enum(['PARSE', 'SCHEMA', 'BUSINESS', 'CITATION', 'GAP']);
export type ValidationStage = z.infer<typeof validationStageSchema>;

export const validationFailureSchema = z
  .object({
    stage: validationStageSchema,
    message: z.string().max(500),
  })
  .strict();
export type ValidationFailure = z.infer<typeof validationFailureSchema>;

export const structuredValidationResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('grounded'), failures: z.array(validationFailureSchema).max(0) }),
  z.object({
    status: z.literal('validation_failed'),
    failures: z.array(validationFailureSchema).min(1),
  }),
]);

/** Metadata-only interaction view (no narrative/raw response ever). */
export const aiInteractionMetadataSchema = z
  .object({
    id: uuidSchema,
    interactionType: aiInteractionTypeSchema,
    initiatedBy: uuidSchema,
    patientId: uuidSchema.nullable(),
    encounterId: uuidSchema.nullable(),
    promptTemplateId: z.string().nullable(),
    modelProvider: z.string(),
    modelName: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    latencyMs: z.number().int().nonnegative(),
    groundingStatus: groundingStatusSchema,
    userAction: aiUserActionSchema,
    createdAt: z.string().datetime(),
  })
  .strict();
export type AiInteractionMetadata = z.infer<typeof aiInteractionMetadataSchema>;

// ---------------------------------------------------------------------------
// M12 � note-draft capability contracts (ADR-018/019)
// ---------------------------------------------------------------------------

export const rejectionReasonCategorySchema = z.enum([
  'INACCURATE_CLINICAL_CONTENT',
  'MISSING_RELEVANT_CONTEXT',
  'POOR_STRUCTURE',
  'HALLUCINATION_SUSPECTED',
  'CLINICIAN_PREFERENCE',
  'OTHER',
]);
export type RejectionReasonCategory = z.infer<typeof rejectionReasonCategorySchema>;

/** PATCH /ai/interactions/:id/action � reject or edit-flag ONLY (ADR-019: accept = bind). */
export const aiInteractionActionRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('rejected'),
    reasonCategory: rejectionReasonCategorySchema,
    reasonNote: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal('edited') }),
]);
export type AiInteractionActionRequest = z.infer<typeof aiInteractionActionRequestSchema>;

/** POST /ai/note-draft response (SOURCE-GROUNDED draft; never auto-bound). */
export interface AiNoteDraftResponse {
  interactionId: string;
  groundingStatus: 'grounded';
  promptTemplateId: string;
  provider: string;
  model: string;
  latencyMs: number;
  computedGaps: GapCode[];
  draft: SoapNoteDraftOutput | ProgressNoteDraftOutput;
}
