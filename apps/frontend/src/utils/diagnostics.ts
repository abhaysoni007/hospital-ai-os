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

/** Per-field validation messages for one result-entry row (M17 forms). */
export interface RowFieldErrors {
  parameterName?: string;
  value?: string;
  unit?: string;
}

/**
 * Builds and validates the result-entry payload client-side.
 * Evaluator-owned fields (isCritical/isAbnormal/criticalRuleId) are never
 * part of the payload — they are server-derived.
 *
 * M17: an empty value field is a validation error, never a silent `0`
 * (`Number('') === 0`, so the raw string must be inspected, not the coercion).
 */
export function buildResultPayload(
  values: Array<{ parameterName: string; value: string; unit: string }>,
):
  | { ok: true; payload: EnterResultRequest }
  | { ok: false; errors: Record<number, RowFieldErrors> } {
  const errors: Record<number, RowFieldErrors> = {};
  const cleaned = values
    .map((v) => ({
      parameterName: v.parameterName.trim(),
      rawValue: v.value.trim(),
      unit: v.unit.trim(),
    }))
    .filter((v) => v.parameterName !== '' || v.rawValue !== '' || v.unit !== '');

  cleaned.forEach((v, i) => {
    const row: RowFieldErrors = {};
    if (!v.parameterName) row.parameterName = 'Parameter name required.';
    if (v.rawValue === '' || Number.isNaN(Number(v.rawValue))) {
      row.value = 'Numeric value required.';
    }
    if (!v.unit) row.unit = 'Unit required.';
    if (row.parameterName || row.value || row.unit) errors[i] = row;
  });

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parsed = enterResultSchema.safeParse({
    resultValues: cleaned.map((v) => ({
      parameterName: v.parameterName,
      value: Number(v.rawValue),
      unit: v.unit,
    })),
  });
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      const idxMatch = /resultValues\.(\d+)\.?(\w*)/.exec(issue.path.join('.'));
      const idx = idxMatch ? Number(idxMatch[1]) : 0;
      const field = (idxMatch?.[2] ?? '') as keyof RowFieldErrors;
      const row = errors[idx] ?? {};
      if (field === 'parameterName' || field === 'value' || field === 'unit') {
        row[field] = row[field] ?? issue.message;
      } else {
        row.value = row.value ?? issue.message;
      }
      errors[idx] = row;
    });
    return { ok: false, errors };
  }
  return { ok: true, payload: parsed.data };
}
