/**
 * M8 Slice 1 — Encounter state machine.
 *
 * Pure, deterministic, no I/O. Authoritative status values mirror the
 * `encounter_status` pgEnum. Slice 1 implements ONLY registered → active;
 * discharge transitions (discharge_initiated/discharged/closed) are owned by
 * the discharge module (M13) and are intentionally unreachable here.
 */
export type EncounterStatus =
  'registered' | 'active' | 'discharge_initiated' | 'discharged' | 'closed';

export const ENCOUNTER_STATUSES: readonly EncounterStatus[] = [
  'registered',
  'active',
  'discharge_initiated',
  'discharged',
  'closed',
];

/**
 * Allowed transitions. M8 slice: registered → active only.
 * Terminal states (discharged, closed) transition to nothing.
 */
export const ENCOUNTER_TRANSITIONS: Readonly<Record<EncounterStatus, readonly EncounterStatus[]>> =
  {
    registered: ['active'],
    active: [], // discharge_initiated added by M13
    discharge_initiated: [], // discharged added by M13
    discharged: [],
    closed: [],
  };

export function canTransition(from: EncounterStatus, to: EncounterStatus): boolean {
  return ENCOUNTER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidEncounterStatus(value: unknown): value is EncounterStatus {
  return typeof value === 'string' && (ENCOUNTER_STATUSES as readonly string[]).includes(value);
}
