import { pgEnum } from 'drizzle-orm/pg-core';

export const genderEnum = pgEnum('gender_type', ['male', 'female', 'other', 'undisclosed']);
export const patientStatusEnum = pgEnum('patient_status', ['active', 'merged', 'archived']);
export const documentTypeEnum = pgEnum('document_type', [
  'aadhaar',
  'pan',
  'passport',
  'driving_license',
  'voter_id',
  'other',
]);
export const verificationStatusEnum = pgEnum('verification_status', [
  'pending',
  'verified',
  'rejected',
]);
export const staffRoleEnum = pgEnum('staff_role', [
  'physician',
  'nurse',
  'pharmacist',
  'lab_technician',
  'receptionist',
  'hospital_admin',
  'security_admin',
]);
export const staffStatusEnum = pgEnum('staff_status', ['active', 'suspended']);
export const departmentStatusEnum = pgEnum('department_status', ['active', 'inactive']);
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'booked',
  'checked_in',
  'in_consult',
  'completed',
  'cancelled',
]);
export const encounterTypeEnum = pgEnum('encounter_type', ['opd', 'follow_up']);
export const encounterStatusEnum = pgEnum('encounter_status', [
  'registered',
  'active',
  'discharge_initiated',
  'discharged',
  'closed',
]);
export const clinicalRecordTypeEnum = pgEnum('clinical_record_type', [
  'soap',
  'progress_note',
  'vital_signs',
  'discharge_summary',
]);
export const clinicalRecordStatusEnum = pgEnum('clinical_record_status', [
  'draft',
  'signed',
  'amended',
]);
export const orderPriorityEnum = pgEnum('order_priority', ['routine', 'urgent', 'stat']);
export const diagnosticOrderStatusEnum = pgEnum('diagnostic_order_status', [
  'ordered',
  'sample_collected',
  'in_progress',
  'completed',
  'cancelled',
]);
export const diagnosticResultStatusEnum = pgEnum('diagnostic_result_status', [
  'preliminary',
  'verified',
  'critical_flagged',
]);
export const taskTypeEnum = pgEnum('task_type', [
  'lab_review',
  'discharge_draft',
  'critical_alert',
  'general',
]);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'critical']);
export const taskStatusEnum = pgEnum('task_status', [
  'created',
  'assigned',
  'in_progress',
  'awaiting_approval',
  'completed',
  'cancelled',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'critical_lab_alert',
  'task_assignment',
  'break_glass_alert',
  'system_alert',
]);
export const notificationPriorityEnum = pgEnum('notification_priority', [
  'normal',
  'urgent',
  'critical',
]);
export const notificationStatusEnum = pgEnum('notification_status', [
  'dispatched',
  'delivered',
  'acknowledged',
]);
export const aiInteractionTypeEnum = pgEnum('ai_interaction_type', [
  'note_draft',
  'chart_search',
  'discharge_draft',
  'ocr',
  'hospital_bottleneck',
]);
export const groundingStatusEnum = pgEnum('grounding_status', [
  'unverified',
  'grounded',
  'validation_failed',
]);
export const aiUserActionEnum = pgEnum('ai_user_action', [
  'pending',
  'accepted',
  'rejected',
  'edited',
]);
export const breakGlassReasonEnum = pgEnum('break_glass_reason', [
  'emergency_care',
  'patient_safety',
  'continuity_of_care',
]);

// M19 — Hospital Intelligence Enums
export const signalTypeEnum = pgEnum('signal_type', [
  'PENDING_DIAGNOSTIC_RESULT',
  'CRITICAL_RESULT_UNACKNOWLEDGED',
  'ENCOUNTER_WITHOUT_CLINICAL_RECORD',
]);
export const signalSeverityEnum = pgEnum('signal_severity', [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]);
export const signalStatusEnum = pgEnum('signal_status', [
  'detected',
  'analyzed',
  'actioned',
  'dismissed',
  'resolved',
  'stale',
]);
export const recommendationStatusEnum = pgEnum('recommendation_status', [
  'proposed',
  'approved',
  'executed',
  'rejected',
  'policy_rejected',
  'execution_failed',
  'insufficient_evidence',
  'unavailable',
]);
