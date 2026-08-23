import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const isoDateStringSchema = z.string().datetime();

export enum PatientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MERGED = 'merged',
}

export enum EncounterStatus {
  PLANNED = 'planned',
  ARRIVED = 'arrived',
  TRIAGED = 'triaged',
  IN_PROGRESS = 'in_progress',
  DISCHARGED = 'discharged',
  CANCELLED = 'cancelled',
}
