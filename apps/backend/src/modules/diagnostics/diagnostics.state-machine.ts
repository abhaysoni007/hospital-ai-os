/**
 * M10 — Diagnostic order & result state machines (ADR-016).
 *
 * Pure, deterministic, fail-closed.
 *
 * ORDER (authoritative enum: ordered | sample_collected | in_progress |
 * completed | cancelled):
 *   ordered          → sample_collected   (collect-sample)
 *   sample_collected → in_progress        (reserved — NO M10 endpoint)
 *   in_progress      → completed          (reserved)
 *   sample_collected → completed          (DERIVED: verification completes the order)
 *   ordered          → cancelled          (ordering physician, pre-collection only)
 * Everything else illegal; terminal states closed.
 *
 * RESULT (preliminary | verified | critical_flagged):
 *   preliminary       → verified
 *   preliminary       → critical_flagged  (deterministic evaluator ONLY)
 *   critical_flagged  → verified
 *   verified          → *                 immutable
 */

export type DiagnosticOrderStatus =
  'ordered' | 'sample_collected' | 'in_progress' | 'completed' | 'cancelled';

export const ORDER_TRANSITIONS: Readonly<
  Record<DiagnosticOrderStatus, readonly DiagnosticOrderStatus[]>
> = {
  ordered: ['sample_collected', 'cancelled'],
  sample_collected: ['in_progress', 'completed'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

export function canOrderTransition(
  from: DiagnosticOrderStatus,
  to: DiagnosticOrderStatus,
): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export type DiagnosticResultStatus = 'preliminary' | 'verified' | 'critical_flagged';

export const RESULT_TRANSITIONS: Readonly<
  Record<DiagnosticResultStatus, readonly DiagnosticResultStatus[]>
> = {
  preliminary: ['verified', 'critical_flagged'],
  critical_flagged: ['verified'],
  verified: [], // immutable
};

export function canResultTransition(
  from: DiagnosticResultStatus,
  to: DiagnosticResultStatus,
): boolean {
  return RESULT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** States from which result entry is permitted. */
export const RESULT_ENTRY_ALLOWED: readonly DiagnosticOrderStatus[] = [
  'sample_collected',
  'in_progress',
];
