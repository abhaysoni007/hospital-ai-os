import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const isoDateStringSchema = z.string().datetime();

export enum PatientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MERGED = 'merged',
}

/**
 * @deprecated Legacy stub whose values never matched the M2 `encounter_status`
 * pgEnum. Superseded by `encounterStatusSchema` / `EncounterStatusValue` in
 * `api/encounter.schemas.ts`, which mirror the database exactly:
 * registered | active | discharge_initiated | discharged | closed.
 * Do not use in new code.
 */
export enum EncounterStatus {
  REGISTERED = 'registered',
  ACTIVE = 'active',
  DISCHARGE_INITIATED = 'discharge_initiated',
  DISCHARGED = 'discharged',
  CLOSED = 'closed',
}
