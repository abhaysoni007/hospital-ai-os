import type {
  AppointmentStatusValue,
  ClinicalRecordStatusValue,
  DiagnosticOrderStatus,
  DiagnosticResultStatus,
  EncounterStatusValue,
  NotificationPriority,
  OrderPriority,
  TaskPriorityEnum,
  TaskStatusEnum,
} from 'shared';
import type { BadgeVariant } from '../components/ui/Badge/Badge';

/**
 * M13 — Centralized status presentation metadata.
 *
 * Single source of truth mapping backend enum values (frozen M8–M12 contracts)
 * to human labels and badge semantics. Status is NEVER communicated by color
 * alone: every entry renders a text label, and critical states additionally
 * render an icon at the call site.
 *
 * Unknown values degrade to the raw value (never invented labels).
 */

export interface StatusMeta {
  /** Human-readable label shown next to/inside the badge. */
  label: string;
  /** Semantic badge variant driving the visual treatment. */
  variant: BadgeVariant;
}

function meta(label: string, variant: BadgeVariant): StatusMeta {
  return { label, variant };
}

const APPOINTMENT_STATUS: Record<string, StatusMeta> = {
  booked: meta('Booked', 'neutral'),
  checked_in: meta('Checked in', 'info'),
  in_consult: meta('In consult', 'primary'),
  completed: meta('Completed', 'stable'),
  cancelled: meta('Cancelled', 'pending'),
};

const ENCOUNTER_STATUS: Record<string, StatusMeta> = {
  registered: meta('Registered', 'pending'),
  active: meta('Active', 'primary'),
  discharge_initiated: meta('Discharge initiated', 'urgent'),
  discharged: meta('Discharged', 'stable'),
  closed: meta('Closed', 'pending'),
};

const ORDER_STATUS: Record<string, StatusMeta> = {
  ordered: meta('Ordered', 'pending'),
  sample_collected: meta('Sample collected', 'info'),
  in_progress: meta('In progress', 'primary'),
  completed: meta('Completed', 'stable'),
  cancelled: meta('Cancelled', 'pending'),
};

const RESULT_STATUS: Record<string, StatusMeta> = {
  preliminary: meta('Preliminary — verification required', 'urgent'),
  verified: meta('Verified & locked', 'stable'),
  critical_flagged: meta('Critical flagged', 'critical'),
};

const ORDER_PRIORITY: Record<string, StatusMeta> = {
  routine: meta('Routine', 'pending'),
  urgent: meta('Urgent', 'urgent'),
  stat: meta('STAT', 'critical'),
};

const NOTIFICATION_PRIORITY: Record<string, StatusMeta> = {
  normal: meta('Normal', 'info'),
  urgent: meta('Urgent', 'urgent'),
  critical: meta('Critical', 'critical'),
};

const RECORD_STATUS: Record<string, StatusMeta> = {
  draft: meta('Draft', 'pending'),
  signed: meta('Signed · locked', 'stable'),
  amended: meta('Amended', 'info'),
};

const TASK_STATUS: Record<string, StatusMeta> = {
  created: meta('Created', 'pending'),
  assigned: meta('Assigned', 'info'),
  in_progress: meta('In progress', 'primary'),
  awaiting_approval: meta('Awaiting approval', 'urgent'),
  completed: meta('Completed', 'stable'),
  cancelled: meta('Cancelled', 'pending'),
};

const TASK_PRIORITY: Record<string, StatusMeta> = {
  low: meta('Low', 'pending'),
  medium: meta('Medium', 'info'),
  high: meta('High', 'urgent'),
  critical: meta('Critical', 'critical'),
};

export function appointmentStatusMeta(status: string): StatusMeta {
  return APPOINTMENT_STATUS[status] ?? meta(status, 'neutral');
}

export function encounterStatusMeta(status: string): StatusMeta {
  return ENCOUNTER_STATUS[status] ?? meta(status, 'neutral');
}

export function orderStatusMeta(status: string): StatusMeta {
  return ORDER_STATUS[status] ?? meta(status, 'neutral');
}

export function resultStatusMeta(status: string): StatusMeta {
  return RESULT_STATUS[status] ?? meta(status, 'neutral');
}

export function priorityMeta(priority: string): StatusMeta {
  return ORDER_PRIORITY[priority] ?? NOTIFICATION_PRIORITY[priority] ?? meta(priority, 'neutral');
}

export function recordStatusMeta(status: string): StatusMeta {
  return RECORD_STATUS[status] ?? meta(status, 'neutral');
}

export function taskStatusMeta(status: string): StatusMeta {
  return TASK_STATUS[status] ?? meta(status, 'neutral');
}

export function taskPriorityMeta(priority: string): StatusMeta {
  return TASK_PRIORITY[priority] ?? meta(priority, 'neutral');
}

/** Typed convenience re-exports for call sites holding the concrete enums. */
export const appointmentStatus = (s: AppointmentStatusValue): StatusMeta =>
  appointmentStatusMeta(s);
export const encounterStatus = (s: EncounterStatusValue): StatusMeta => encounterStatusMeta(s);
export const orderStatus = (s: DiagnosticOrderStatus): StatusMeta => orderStatusMeta(s);
export const resultStatus = (s: DiagnosticResultStatus): StatusMeta => resultStatusMeta(s);
export const orderPriority = (p: OrderPriority): StatusMeta => priorityMeta(p);
export const notificationPriority = (p: NotificationPriority): StatusMeta => priorityMeta(p);
export const recordStatus = (s: ClinicalRecordStatusValue): StatusMeta => recordStatusMeta(s);
export const taskStatus = (s: TaskStatusEnum): StatusMeta => taskStatusMeta(s);
export const taskPriority = (p: TaskPriorityEnum): StatusMeta => taskPriorityMeta(p);

/** Gap codes → clinician-readable "not documented" statements (ADR-018 §6). */
const GAP_LABELS: Record<string, string> = {
  NO_CHIEF_COMPLAINT: 'Chief complaint not documented',
  NO_VITALS_SIGNS: 'Vital signs not documented',
  NO_PRIOR_NOTES: 'No prior clinical notes for this encounter',
  NO_DIAGNOSTIC_ORDERS: 'No diagnostic orders for this encounter',
  NO_DIAGNOSTIC_RESULTS: 'No diagnostic results for this encounter',
  NO_MEDICATION_HISTORY: 'Medication history not documented',
  NO_ALLERGY_DATA: 'Allergy data not documented',
};

export function gapCodeLabel(code: string): string {
  return GAP_LABELS[code] ?? code.replace(/_/g, ' ').toLowerCase();
}

/** Citation source types → short chip labels. */
export function citationSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'CLINICAL_RECORD':
      return 'Clinical record';
    case 'DIAGNOSTIC_ORDER':
      return 'Diagnostic order';
    case 'DIAGNOSTIC_RESULT':
      return 'Diagnostic result';
    default:
      return sourceType;
  }
}
