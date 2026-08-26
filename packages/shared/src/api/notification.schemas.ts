import { z } from 'zod';
import { uuidSchema } from '../domain/primitives';
import { offsetPaginationSchema } from './pagination';

/**
 * M12.2 — Notification read/workflow contracts (minimum critical-result loop).
 *
 * Scope: recipient-derived server-side from the JWT. No client-supplied
 * recipient/actor filters. Acknowledgement follows the EXISTING schema
 * semantics (notification_status: dispatched|delivered|acknowledged) — no new
 * clinical workflow is invented; escalation/reminders remain M14 scope.
 */

export const notificationTypeSchema = z.enum([
  'critical_lab_alert',
  'task_assignment',
  'break_glass_alert',
  'system_alert',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationPrioritySchema = z.enum(['normal', 'urgent', 'critical']);
export type NotificationPriority = z.infer<typeof notificationPrioritySchema>;

export const notificationStatusSchema = z.enum(['dispatched', 'delivered', 'acknowledged']);
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

/** GET /notifications query — actor scope derived server-side. */
export const getNotificationsQuerySchema = offsetPaginationSchema.extend({
  status: notificationStatusSchema.optional(),
  priority: notificationPrioritySchema.optional(),
  notificationType: notificationTypeSchema.optional(),
});
export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

/**
 * Notification list item. PHI boundary per ADR-016: title/body carry test name
 * + pointer metadata ONLY — never MRN, DOB, patient identifiers or clinical
 * values. `relatedOrderId` is a server-resolved navigation pointer so the
 * physician can open the actual diagnostic result via the permission-controlled
 * result endpoint.
 */
export interface NotificationItem {
  id: string;
  notificationType: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: string;
  acknowledgedAt: string | null;
  referenceType: string | null;
  referenceId: string | null;
  /** Server-resolved navigation pointer for DiagnosticResult references. */
  relatedOrderId: string | null;
}

export interface NotificationListResponse {
  data: NotificationItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** PATCH /notifications/:id/acknowledge request (no body required). */
export const acknowledgeNotificationParamsSchema = z.object({ id: uuidSchema });
