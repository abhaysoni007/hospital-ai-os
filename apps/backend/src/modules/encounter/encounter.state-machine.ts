/**
 * M8 Slice 1 — Encounter state machine.
 *
 * Pure, deterministic, no I/O. Authoritative status values mirror the
 * `encounter_status` pgEnum. Activation (registered → active) and discharge
 * (active → discharged, M13) are the only transitions any service performs;
 * `discharge_initiated` and `closed` are reserved enum values with no
 * transition path yet.
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
 * Allowed transitions, mirroring the service implementations:
 *   registered → active      (activateEncounter)
 *   active → discharged      (dischargeEncounter, M13)
 * `discharge_initiated` and `closed` are pgEnum values with no transition path
 * in any service yet (reserved); the remaining states are terminal.
 */
export const ENCOUNTER_TRANSITIONS: Readonly<Record<EncounterStatus, readonly EncounterStatus[]>> =
  {
    registered: ['active'],
    active: ['discharged'],
    discharge_initiated: [],
    discharged: [],
    closed: [],
  };

export function canTransition(from: EncounterStatus, to: EncounterStatus): boolean {
  return ENCOUNTER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidEncounterStatus(value: unknown): value is EncounterStatus {
  return typeof value === 'string' && (ENCOUNTER_STATUSES as readonly string[]).includes(value);
}
