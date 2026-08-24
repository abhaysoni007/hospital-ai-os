import { z } from 'zod';
import { offsetPaginationSchema } from './pagination';

/**
 * M8 Slice 1 — Appointment contracts.
 * Status values mirror the DB pgEnum `appointment_status` exactly.
 *
 * Lifecycle (slice scope): booked → checked_in.
 * in_consult/completed transitions belong to later slices; `cancelled` is
 * reachable only from `booked`.
 */
export const appointmentStatusSchema = z.enum([
  'booked',
  'checked_in',
  'in_consult',
  'completed',
  'cancelled',
]);

export type AppointmentStatusValue = z.infer<typeof appointmentStatusSchema>;

/** Time of day in HH:mm (24h). Stored in the `time` column verbatim. */
export const scheduledTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'scheduledTime must be HH:mm (24-hour)');

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  /** ISO date (YYYY-MM-DD). Must be today or future — enforced server-side. */
  scheduledDate: z.string().date(),
  scheduledTime: scheduledTimeSchema,
});

export type CreateAppointmentRequest = z.infer<typeof createAppointmentSchema>;

export const getAppointmentsQuerySchema = offsetPaginationSchema.extend({
  date: z.string().date().optional(),
  doctorId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  status: appointmentStatusSchema.optional(),
});

export type GetAppointmentsQuery = z.infer<typeof getAppointmentsQuerySchema>;

export const cancelAppointmentSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CancelAppointmentRequest = z.infer<typeof cancelAppointmentSchema>;

export type AppointmentResponse = {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  scheduledDate: string;
  scheduledTime: string;
  tokenNumber: number | null;
  status: AppointmentStatusValue;
  encounterId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

/** Enriched list row for the schedule/queue screen. */
export type AppointmentListItem = AppointmentResponse & {
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  doctor: { id: string; firstName: string; lastName: string };
};

/**
 * Read-only booking support data for the booking form.
 * NOTE (M8 report): this is a minimal read-only directory read required because
 * staff management (§2.10 admin endpoints, M20) does not exist yet. It grants no
 * new permission surface beyond `appointment:create` and exposes staff names only.
 */
export const bookingOptionsResponseSchema = z.object({
  departments: z.array(z.object({ id: z.string().uuid(), name: z.string(), code: z.string() })),
  physicians: z.array(
    z.object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      departmentId: z.string().uuid(),
    }),
  ),
});

export type BookingOptionsResponse = z.infer<typeof bookingOptionsResponseSchema>;
