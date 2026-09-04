import { z } from 'zod';
import { offsetPaginationSchema } from './pagination';

/**
 * M8 Slice 1 — Encounter contracts.
 * Status values mirror the DB pgEnum `encounter_status` exactly.
 *
 * Slice 1 implements ONLY: registered → active.
 * Discharge transitions (discharge_initiated/discharged/closed) belong to
 * the discharge module (M13) and are intentionally NOT reachable via this API yet.
 */
export const encounterTypeSchema = z.enum(['opd', 'follow_up', 'inpatient', 'emergency']);

export type EncounterType = z.infer<typeof encounterTypeSchema>;

export const encounterStatusSchema = z.enum([
  'registered',
  'active',
  'discharge_initiated',
  'discharged',
  'closed',
]);

export type EncounterStatusValue = z.infer<typeof encounterStatusSchema>;

export const createEncounterSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  encounterType: encounterTypeSchema,
  chiefComplaint: z.string().max(2000).optional(),
});

export type CreateEncounterRequest = z.infer<typeof createEncounterSchema>;

export const getEncountersQuerySchema = offsetPaginationSchema.extend({
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: encounterStatusSchema.optional(),
});

export type GetEncountersQuery = z.infer<typeof getEncountersQuerySchema>;

/**
 * Optimistic concurrency guard for activation (database-design.md §2/§5):
 * caller must supply the version it observed. A stale version yields 409 VERSION_CONFLICT.
 */
export const activateEncounterSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export type ActivateEncounterRequest = z.infer<typeof activateEncounterSchema>;

/**
 * M13 Discharge endpoint contract.
 * Requires the expected version for optimistic concurrency,
 * and the final discharge summary clinical narrative.
 */
export const dischargeEncounterSchema = z.object({
  expectedVersion: z.number().int().positive(),
  summary: z.string().trim().min(1).max(20000), // corresponds to dischargeSummaryContentSchema.narrative
});

export type DischargeEncounterRequest = z.infer<typeof dischargeEncounterSchema>;

/**
 * Bounded patient demographic block embeddable under encounter responses.
 * Every role holding `encounter:read` also holds `patient:read` (M5 matrix),
 * so this block never widens authorization. See ADR-013.
 */
export const encounterPatientBlockSchema = z.object({
  id: z.string().uuid(),
  mrn: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']),
});

/**
 * ADR-013 detail contract: metadata + bounded demographics ONLY.
 * - chiefComplaint is present ONLY when the caller holds clinical_record:read;
 *   otherwise the key is omitted entirely (never nulled).
 * - clinicalRecords / diagnosticOrders / diagnosticResults are NEVER embedded.
 */
export const encounterDetailResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  encounterType: encounterTypeSchema,
  status: encounterStatusSchema,
  startedAt: z.string().datetime().nullable(),
  dischargedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
  chiefComplaint: z.string().optional(),
  patient: encounterPatientBlockSchema,
  appointment: z
    .object({
      id: z.string().uuid(),
      scheduledDate: z.string(),
      scheduledTime: z.string(),
      tokenNumber: z.number().int().positive().nullable(),
      status: z.enum(['booked', 'checked_in', 'in_consult', 'completed', 'cancelled']),
    })
    .nullable()
    .optional(),
});

export type EncounterDetailResponse = z.infer<typeof encounterDetailResponseSchema>;

/** List item: metadata only plus the same bounded demographic block (ADR-013). */
export const encounterListItemSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  encounterType: encounterTypeSchema,
  status: encounterStatusSchema,
  startedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  version: z.number().int().positive(),
  chiefComplaint: z.string().optional(),
  patient: encounterPatientBlockSchema,
});

export type EncounterListItem = z.infer<typeof encounterListItemSchema>;
