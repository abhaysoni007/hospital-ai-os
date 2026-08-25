import { hasPermission } from './rbac';
import type { StaffRole } from '../types/auth';
import { enterResultSchema, type EnterResultRequest } from 'shared';

/**
 * M10 frontend diagnostics helpers — pure logic, unit-tested.
 * NOTE: all gating here is UX-only; the backend remains authoritative.
 */

export const PRIORITY_META: Record<
  string,
  { label: string; tone: 'routine' | 'urgent' | 'stat'; icon: string }
> = {
  routine: { label: 'Routine', tone: 'routine', icon: '◦' },
  urgent: { label: 'Urgent', tone: 'urgent', icon: '▲' },
  stat: { label: 'STAT', tone: 'stat', icon: '‼' },
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  ordered: 'Ordered',
  sample_collected: 'Sample collected',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const RESULT_STATUS_LABELS: Record<string, string> = {
  preliminary: 'Preliminary — pending verification',
  verified: 'Verified & locked',
  critical_flagged: 'CRITICAL — requires clinical attention',
};

export function canOrderDiagnostics(role?: StaffRole): boolean {
  return role === 'physician' && hasPermission(role, 'diagnostic_order:create');
}

export function canReadDiagnostics(role?: StaffRole): boolean {
  return (
    hasPermission(role, 'diagnostic_order:read') || hasPermission(role, 'diagnostic_result:read')
  );
}

export function canCollectSamples(role?: StaffRole): boolean {
  return role === 'lab_technician' && hasPermission(role, 'diagnostic_order:update');
}

export function canCancelOrders(role?: StaffRole): boolean {
  return role === 'physician' && hasPermission(role, 'diagnostic_order:cancel');
}

export function canEnterResults(role?: StaffRole): boolean {
  return role === 'lab_technician' && hasPermission(role, 'diagnostic_result:enter');
}

export function canVerifyResults(role?: StaffRole): boolean {
  return role === 'lab_technician' && hasPermission(role, 'diagnostic_result:verify');
}

/** Four-eyes (ADR-016 D6): the enterer may never see a Verify action. */
export function isResultEnterer(record: { enteredBy: string }, userId?: string): boolean {
  return !!userId && record.enteredBy === userId;
}

/**
 * Builds and validates the result-entry payload client-side.
 * Evaluator-owned fields (isCritical/isAbnormal/criticalRuleId) are never
 * part of the payload — they are server-derived.
 */
export function buildResultPayload(
  values: Array<{ parameterName: string; value: string; unit: string }>,
): { ok: true; payload: EnterResultRequest } | { ok: false; errors: Record<number, string> } {
  const errors: Record<number, string> = {};
  const cleaned = values
    .map((v) => ({
      parameterName: v.parameterName.trim(),
      value: Number(v.value),
      unit: v.unit.trim(),
    }))
    .filter((v) => v.parameterName !== '' || !Number.isNaN(v.value));

  cleaned.forEach((v, i) => {
    if (!v.parameterName) errors[i] = errors[i] ?? 'Parameter name required.';
    if (v.value === undefined || Number.isNaN(v.value)) {
      errors[i] = `${errors[i] ?? ''}Numeric value required.`.trim();
    }
    if (!v.unit) errors[i] = `${errors[i] ?? ''}Unit required.`.trim();
  });

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parsed = enterResultSchema.safeParse({ resultValues: cleaned });
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      const idxMatch = /resultValues\.(\d+)/.exec(issue.path.join('.'));
      const idx = idxMatch ? Number(idxMatch[1]) : 0;
      errors[idx] = errors[idx] ?? issue.message;
    });
    return { ok: false, errors };
  }
  return { ok: true, payload: parsed.data };
}
