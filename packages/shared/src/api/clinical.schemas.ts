import { z } from 'zod';
import { offsetPaginationSchema } from './pagination';
import { uuidSchema } from '../domain/primitives';

/**
 * M9 — Clinical record contracts (ADR-015 binding).
 *
 * Content is structured per record type via a discriminated union.
 * Unrestricted free-form JSON is rejected. `amended` is a reserved status
 * and unreachable in M9. `discharge_summary` validates at the schema level
 * only — no discharge workflow exists until M13, and creation of this type
 * is intentionally NOT offered by the M9 create endpoint.
 */

export const clinicalRecordTypeSchema = z.enum([
  'soap',
  'progress_note',
  'vital_signs',
  'discharge_summary',
]);

export type ClinicalRecordType = z.infer<typeof clinicalRecordTypeSchema>;

export const clinicalRecordStatusSchema = z.enum(['draft', 'signed', 'amended']);

export type ClinicalRecordStatusValue = z.infer<typeof clinicalRecordStatusSchema>;

// ---------------------------------------------------------------------------
// Content schemas (ADR-015 Decision 2)
// ---------------------------------------------------------------------------

const trimmedContent = (max: number) => z.string().trim().min(1).max(max);

const soapSectionSchema = z.object({
  heading: z.enum(['subjective', 'objective', 'assessment', 'plan']),
  content: trimmedContent(10_000),
});

/** Exactly the four SOAP headings; each required, trimmed, non-empty, ≤ 10k chars. */
export const soapContentSchema = z.object({
  sections: z.tuple([soapSectionSchema, soapSectionSchema, soapSectionSchema, soapSectionSchema]),
});

export type SoapContent = z.infer<typeof soapContentSchema>;

/** Bounded narrative model for progress notes. */
export const progressNoteContentSchema = z.object({
  narrative: trimmedContent(20_000),
});

export type ProgressNoteContent = z.infer<typeof progressNoteContentSchema>;

/**
 * Discharge summary placeholder shape (ADR-015): narrative model.
 * Valid at schema level; workflow belongs to M13. Not creatable via M9 API.
 */
export const dischargeSummaryContentSchema = z.object({
  narrative: trimmedContent(20_000),
});

export type DischargeSummaryContent = z.infer<typeof dischargeSummaryContentSchema>;

/** Optional bounded remark accompanying vital_signs records. */
export const vitalSignsContentSchema = z.object({
  note: z.string().trim().max(2_000).optional(),
});

export type VitalSignsContent = z.infer<typeof vitalSignsContentSchema>;

/**
 * Vital signs panel (ADR-015). All fields optional; normalized units;
 * validated physiological ranges; invalid values rejected.
 */
export const vitalsSchema = z
  .object({
    temperature_c: z.number().min(25).max(45).optional(),
    pulse_bpm: z.number().min(20).max(300).optional(),
    resp_rate: z.number().min(4).max(80).optional(),
    bp_systolic: z.number().min(40).max(300).optional(),
    bp_diastolic: z.number().min(20).max(200).optional(),
    spo2_pct: z.number().min(50).max(100).optional(),
    weight_kg: z.number().min(0.3).max(500).optional(),
    height_cm: z.number().min(30).max(260).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one vital sign value is required.',
  });

export type Vitals = z.infer<typeof vitalsSchema>;

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

/**
 * Discriminated union for creation. NOTE: `discharge_summary` is deliberately
 * absent — its authoring workflow belongs to M13 (ADR-015 Decision 2).
 */
export const createClinicalRecordSchema = z.discriminatedUnion('recordType', [
  z.object({ recordType: z.literal('soap'), content: soapContentSchema }),
  z.object({
    recordType: z.literal('progress_note'),
    content: progressNoteContentSchema,
  }),
  z.object({
    recordType: z.literal('vital_signs'),
    content: vitalSignsContentSchema.optional(),
    vitals: vitalsSchema,
  }),
]);

export type CreateClinicalRecordRequest = z.infer<typeof createClinicalRecordSchema>;

/**
 * Draft update payload. `content` is validated against the stored record's
 * type in the service layer using the per-type schemas above.
 */
export const updateClinicalRecordSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    content: z.unknown().optional(),
    vitals: vitalsSchema.optional(),
  })
  .refine((v) => v.content !== undefined || v.vitals !== undefined, {
    message: 'Provide content and/or vitals to update.',
  });

export type UpdateClinicalRecordRequest = z.infer<typeof updateClinicalRecordSchema>;

export const signClinicalRecordSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export type SignClinicalRecordRequest = z.infer<typeof signClinicalRecordSchema>;

export const getClinicalRecordsQuerySchema = offsetPaginationSchema.extend({});

export type GetClinicalRecordsQuery = z.infer<typeof getClinicalRecordsQuerySchema>;

/** Per-type content validators used by the service on update. */
export const contentSchemasByType = {
  soap: soapContentSchema,
  progress_note: progressNoteContentSchema,
  vital_signs: vitalSignsContentSchema,
  discharge_summary: dischargeSummaryContentSchema,
} as const;

// ---------------------------------------------------------------------------
// Response shapes (PHI/Critical — served only through gated endpoints)
// ---------------------------------------------------------------------------

export const clinicalRecordResponseSchema = z.object({
  id: uuidSchema,
  encounterId: uuidSchema,
  patientId: uuidSchema,
  recordType: clinicalRecordTypeSchema,
  status: clinicalRecordStatusSchema,
  version: z.number().int().positive(),
  content: z.unknown(),
  vitals: z.unknown().nullable(),
  signedBy: uuidSchema.nullable(),
  signedAt: z.string().datetime().nullable(),
  createdBy: uuidSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ClinicalRecordResponse = {
  id: string;
  encounterId: string;
  patientId: string;
  recordType: ClinicalRecordType;
  status: ClinicalRecordStatusValue;
  version: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vitals: any | null;
  signedBy: string | null;
  signedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
