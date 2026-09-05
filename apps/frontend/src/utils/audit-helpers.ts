import type { AuditEventResponse } from 'shared';
import type { BadgeVariant } from '../components/ui/Badge/Badge';

export type AuditSeverity = 'critical' | 'warning' | 'info' | 'stable';

export type AuditCategory =
  | 'all'
  | 'break_glass'
  | 'clinical'
  | 'diagnostics'
  | 'patient'
  | 'intelligence'
  | 'system';

/**
 * Converts SCREAMING_SNAKE_CASE event types into clean, human-readable labels.
 */
export function formatEventType(eventType: string): string {
  if (!eventType) return 'Unknown Event';

  const knownLabels: Record<string, string> = {
    BREAK_GLASS_ACTIVATED: 'Break Glass Activated',
    BREAK_GLASS_DEACTIVATED: 'Break Glass Deactivated',
    BREAK_GLASS_REVIEWED: 'Break Glass Reviewed',
    CRITICAL_VALUE_DETECTED: 'Critical Value Detected',
    CRITICAL_VALUE_NOTIFIED: 'Critical Value Notified',
    PATIENT_REGISTERED: 'Patient Registered',
    PATIENT_ACCESSED: 'Patient Record Viewed',
    PATIENT_UPDATED: 'Patient Updated',
    IDENTITY_UPLOADED: 'Identity Document Uploaded',
    IDENTITY_VERIFIED: 'Identity Document Verified',
    ENCOUNTER_CREATED: 'Encounter Created',
    ENCOUNTER_ACTIVATED: 'Encounter Activated',
    ENCOUNTER_DISCHARGED: 'Encounter Discharged',
    CLINICAL_RECORD_CREATED: 'Clinical Record Created',
    CLINICAL_RECORD_DRAFT_UPDATED: 'Clinical Draft Updated',
    CLINICAL_NOTE_SIGNED: 'Clinical Note Signed',
    CLINICAL_RECORD_ACCESSED: 'Clinical Record Viewed',
    DIAGNOSTIC_ORDER_CREATED: 'Lab Order Created',
    SAMPLE_COLLECTED: 'Sample Collected',
    DIAGNOSTIC_ORDER_CANCELLED: 'Lab Order Cancelled',
    LAB_RESULT_ENTERED: 'Lab Result Entered',
    LAB_RESULT_VERIFIED: 'Lab Result Verified',
    LAB_RESULT_ACKNOWLEDGED: 'Lab Result Acknowledged',
    TASK_CREATED: 'Task Created',
    TASK_ACKNOWLEDGED: 'Task Acknowledged',
    TASK_COMPLETED: 'Task Completed',
    TASK_REASSIGNED: 'Task Reassigned',
    TASK_ESCALATED: 'Task Escalated',
    NOTIFICATION_ACKNOWLEDGED: 'Notification Acknowledged',
    RECOMMENDATION_PROPOSED: 'AI Recommendation Proposed',
    RECOMMENDATION_APPROVED: 'AI Recommendation Approved',
    RECOMMENDATION_REJECTED: 'AI Recommendation Rejected',
    RECOMMENDATION_POLICY_REJECTED: 'Policy Check Blocked',
    ACTION_EXECUTED: 'Governed Action Executed',
    AUTH_LOGIN_FAILED: 'Authentication Failed',
  };

  if (knownLabels[eventType]) {
    return knownLabels[eventType];
  }

  return eventType
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Categorizes an audit event for filter tabs.
 */
export function getEventCategory(eventType: string): AuditCategory {
  const upper = (eventType || '').toUpperCase();

  if (upper.includes('BREAK_GLASS')) return 'break_glass';
  if (
    upper.includes('CLINICAL') ||
    upper.includes('NOTE') ||
    upper.includes('ENCOUNTER')
  ) {
    return 'clinical';
  }
  if (
    upper.includes('LAB') ||
    upper.includes('DIAGNOSTIC') ||
    upper.includes('SAMPLE') ||
    upper.includes('CRITICAL_VALUE')
  ) {
    return 'diagnostics';
  }
  if (upper.includes('PATIENT') || upper.includes('IDENTITY')) {
    return 'patient';
  }
  if (
    upper.includes('RECOMMENDATION') ||
    upper.includes('HOSPITAL_INTELLIGENCE') ||
    upper.includes('ANALYSIS')
  ) {
    return 'intelligence';
  }

  return 'system';
}

/**
 * Derives risk/severity from event type and action detail.
 */
export function getEventSeverity(event: AuditEventResponse): AuditSeverity {
  const upperType = (event.eventType || '').toUpperCase();
  const detail = event.actionDetail as Record<string, unknown> | null | undefined;
  const detailSeverity = typeof detail?.severity === 'string' ? detail.severity.toLowerCase() : '';

  if (
    upperType.includes('BREAK_GLASS') ||
    upperType.includes('CRITICAL') ||
    upperType.includes('AUTH_LOGIN_FAILED') ||
    detailSeverity === 'critical' ||
    detailSeverity === 'high'
  ) {
    return 'critical';
  }

  if (
    upperType.includes('REJECTED') ||
    upperType.includes('CANCELLED') ||
    upperType.includes('ESCALATED') ||
    upperType.includes('FAILED') ||
    detailSeverity === 'warning' ||
    detailSeverity === 'medium'
  ) {
    return 'warning';
  }

  if (
    upperType.includes('SIGNED') ||
    upperType.includes('VERIFIED') ||
    upperType.includes('COMPLETED') ||
    upperType.includes('DISCHARGED')
  ) {
    return 'stable';
  }

  return 'info';
}

/**
 * Maps derived severity to UI BadgeVariant.
 */
export function getSeverityBadgeVariant(severity: AuditSeverity): BadgeVariant {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'warning':
      return 'urgent';
    case 'stable':
      return 'stable';
    case 'info':
    default:
      return 'info';
  }
}

/**
 * Checks if the given previous hash represents the immutable Genesis block.
 */
export function isGenesisHash(hash: string): boolean {
  return !hash || hash === '0000000000000000000000000000000000000000000000000000000000000000';
}

/**
 * Truncates a 64-character SHA-256 hash for compact presentation.
 */
export function truncateHash(hash: string, head = 6, tail = 6): string {
  if (!hash) return '—';
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

/**
 * Mask / strip sensitive security credentials and session keys before display.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'sessionsecret',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'bearer',
  'api_key',
  'apikey',
  'private_key',
  'credentials',
]);

export function sanitizeActionDetail(data: unknown): unknown {
  if (data === null || data === undefined) return null;

  if (Array.isArray(data)) {
    return data.map(sanitizeActionDetail);
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeActionDetail(value);
      }
    }
    return sanitized;
  }

  return data;
}
