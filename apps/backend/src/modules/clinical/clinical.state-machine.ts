/**
 * M9 — Clinical record state machine.
 *
 * Pure, deterministic, no I/O. Statuses mirror the `clinical_record_status` pgEnum.
 * M9 legal lifecycle (ADR-015 Decision 3):
 *   draft → draft   (edits while draft)
 *   draft → signed  (signing)
 * `amended` is RESERVED and unreachable — amendment is deferred to a future
 * architectural decision. Fail closed on anything else.
 */
export type ClinicalStatus = 'draft' | 'signed' | 'amended';

export const CLINICAL_STATUSES: readonly ClinicalStatus[] = ['draft', 'signed', 'amended'];

export const CLINICAL_TRANSITIONS: Readonly<Record<ClinicalStatus, readonly ClinicalStatus[]>> = {
  draft: ['draft', 'signed'],
  signed: [], // immutable; amendment deferred (ADR-015 Decision 3)
  amended: [], // reserved
};

export function canClinicalTransition(from: ClinicalStatus, to: ClinicalStatus): boolean {
  return CLINICAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidClinicalStatus(value: unknown): value is ClinicalStatus {
  return typeof value === 'string' && (CLINICAL_STATUSES as readonly string[]).includes(value);
}
