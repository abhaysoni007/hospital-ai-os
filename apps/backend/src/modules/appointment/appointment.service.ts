import { sql, and, eq, ne, inArray, desc } from 'drizzle-orm';
import { db } from '../../db';
import { appointments, encounters } from '../../db/schema/appointments';
import { patients } from '../../db/schema/patients';
import { staff, departments } from '../../db/schema/staff';
import {
  CreateAppointmentRequest,
  GetAppointmentsQuery,
  CancelAppointmentRequest,
  AppointmentListItem,
  BookingOptionsResponse,
} from 'shared';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  AuthorizationError,
} from 'shared/src/errors/AppError';
import { auditService } from '../audit/audit.service';

type AuthContext = { role: string; departmentId: string };

/** Today's date in UTC as YYYY-MM-DD — matches `scheduled_date` column semantics. */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * ADR-012 allocation: atomic upsert-increment on the per-doctor/per-day
 * counter row. Runs inside the caller's transaction; the row lock is held
 * until COMMIT. Rollback (e.g., audit failure) reverts the increment.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function allocateToken(tx: any, doctorId: string, scheduledDate: string): Promise<number> {
  const result = await tx.execute(sql`
    INSERT INTO appointment_token_counters AS c (doctor_id, scheduled_date, last_token)
    VALUES (${doctorId}::uuid, ${scheduledDate}::date, 1)
    ON CONFLICT (doctor_id, scheduled_date)
    DO UPDATE SET last_token = c.last_token + 1
    RETURNING last_token
  `);
  return Number((result as unknown as Array<{ last_token: number }>)[0].last_token);
}

export class AppointmentService {
  /**
   * Books an appointment. Transaction order per ADR-012 lock contract:
   * validations → counter row → appointments insert → audit → COMMIT.
   */
  async bookAppointment(
    payload: CreateAppointmentRequest,
    creatorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    // Department scope: receptionists book within their own department only.
    if (authContext.role === 'receptionist' && payload.departmentId !== authContext.departmentId) {
      throw new AuthorizationError('Cannot book appointments outside your department.');
    }

    if (payload.scheduledDate < todayIsoDate()) {
      throw new ValidationError('scheduledDate must be today or in the future.', {
        code: 'VALIDATION_ERROR',
      });
    }

    return await db.transaction(async (tx) => {
      const patient = await tx.query.patients.findFirst({
        where: eq(patients.id, payload.patientId),
      });
      if (!patient || patient.status !== 'active') {
        throw new NotFoundError('Patient not found', { code: 'PATIENT_NOT_FOUND' });
      }

      const doctor = await tx.query.staff.findFirst({ where: eq(staff.id, payload.doctorId) });
      if (!doctor || doctor.status !== 'active') {
        throw new NotFoundError('Doctor not found', { code: 'DOCTOR_NOT_FOUND' });
      }
      if (doctor.role !== 'physician') {
        throw new ValidationError('Appointments can only be booked with a physician.', {
          code: 'NOT_A_PHYSICIAN',
        });
      }
      if (doctor.departmentId !== payload.departmentId) {
        throw new ValidationError('Doctor does not belong to the requested department.', {
          code: 'DEPARTMENT_MISMATCH',
        });
      }

      // Double booking: same doctor + date + time, not cancelled.
      const existing = await tx.query.appointments.findFirst({
        where: and(
          eq(appointments.doctorId, payload.doctorId),
          eq(appointments.scheduledDate, payload.scheduledDate),
          eq(appointments.scheduledTime, payload.scheduledTime),
          ne(appointments.status, 'cancelled'),
        ),
      });
      if (existing) {
        throw new ConflictError('This slot is no longer available.', { code: 'SLOT_UNAVAILABLE' });
      }

      // ADR-012: token allocated BEFORE the insert, inside this transaction.
      const tokenNumber = await allocateToken(tx, payload.doctorId, payload.scheduledDate);

      // M12.1 P0-3: migration 0005 (uq_appointments_active_slot) is the final
      // authority against concurrent double-booking — the SELECT above cannot
      // see a row another in-flight transaction has not yet inserted. A unique
      // violation here means the slot was claimed concurrently; it is mapped to
      // the SAME public error contract as the pre-check (no postgres leak).
      let appointment;
      try {
        [appointment] = await tx
          .insert(appointments)
          .values({
            patientId: payload.patientId,
            doctorId: payload.doctorId,
            departmentId: payload.departmentId,
            scheduledDate: payload.scheduledDate,
            scheduledTime: payload.scheduledTime,
            tokenNumber,
            status: 'booked',
            createdBy: creatorId,
          })
          .returning();
      } catch (err) {
        // Drizzle wraps driver errors: the pg code may sit on err.code or
        // err.cause.code depending on the drizzle/postgres-js versions.
        const pgCode =
          (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
        if (pgCode === '23505') {
          throw new ConflictError('This slot is no longer available.', {
            code: 'SLOT_UNAVAILABLE',
          });
        }
        throw err;
      }

      await auditService.logEvent(
        {
          eventType: 'APPOINTMENT_BOOKED',
          actorId: creatorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'APPOINTMENT',
          targetId: appointment.id,
          patientId: appointment.patientId,
          actionDetail: {
            scheduledDate: appointment.scheduledDate,
            scheduledTime: appointment.scheduledTime,
            tokenNumber,
          },
        },
        correlationId,
        tx,
      );

      return appointment;
    });
  }

  /**
   * Lists appointments for the schedule/queue screen.
   * Scope: hospital_admin reads globally; every other role is forced to its
   * own department regardless of query parameters.
   */
  async listAppointments(query: GetAppointmentsQuery, authContext: AuthContext) {
    const page = query.page || 1;
    const limit = query.pageSize || 50;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (authContext.role !== 'hospital_admin') {
      conditions.push(eq(appointments.departmentId, authContext.departmentId));
    }
    if (query.date) conditions.push(eq(appointments.scheduledDate, query.date));
    if (query.doctorId) conditions.push(eq(appointments.doctorId, query.doctorId));
    if (query.departmentId && authContext.role === 'hospital_admin') {
      conditions.push(eq(appointments.departmentId, query.departmentId));
    }
    if (query.patientId) conditions.push(eq(appointments.patientId, query.patientId));
    if (query.status) conditions.push(eq(appointments.status, query.status));

    const rows = await db.query.appointments.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(appointments.createdAt)],
      limit,
      offset,
    });

    const total = await db.$count(
      appointments,
      conditions.length > 0 ? and(...conditions) : undefined,
    );

    // Enrich with bounded patient demographics + doctor names for queue display.
    const patientIds = [...new Set(rows.map((r) => r.patientId))];
    const doctorIds = [...new Set(rows.map((r) => r.doctorId))];

    const patientRows = patientIds.length
      ? await db.query.patients.findMany({
          where: inArray(patients.id, patientIds),
          columns: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
          },
        })
      : [];
    const doctorRows = doctorIds.length
      ? await db.query.staff.findMany({
          where: inArray(staff.id, doctorIds),
          columns: { id: true, firstName: true, lastName: true },
        })
      : [];

    const patientById = new Map(patientRows.map((p) => [p.id, p]));
    const doctorById = new Map(doctorRows.map((d) => [d.id, d]));

    const data: AppointmentListItem[] = rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      patient: patientById.get(r.patientId) ?? {
        id: r.patientId,
        mrn: '',
        firstName: '',
        lastName: '',
      },
      doctor: doctorById.get(r.doctorId) ?? { id: r.doctorId, firstName: '', lastName: '' },
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Cancels a booked appointment. Only `booked` may be cancelled; cancelled
   * slots become bookable again but committed token numbers are never reused
   * (the counter is NOT decremented — ADR-012).
   */
  async cancelAppointment(
    id: string,
    payload: CancelAppointmentRequest,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, id))
        .for('update');
      const appointment = rows[0];
      if (!appointment) {
        throw new NotFoundError('Appointment not found', { code: 'APPOINTMENT_NOT_FOUND' });
      }
      // Department scope mirrors check-in: non-admins cancel within their own
      // department only, regardless of the route-level permission.
      if (
        authContext.role !== 'hospital_admin' &&
        appointment.departmentId !== authContext.departmentId
      ) {
        throw new AuthorizationError('Appointment is outside your department.');
      }
      if (appointment.status !== 'booked') {
        throw new ConflictError(
          `Only booked appointments can be cancelled (current status: ${appointment.status}).`,
          { code: 'INVALID_TRANSITION' },
        );
      }

      const [updated] = await tx
        .update(appointments)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(appointments.id, id), eq(appointments.status, 'booked')))
        .returning();

      await auditService.logEvent(
        {
          eventType: 'APPOINTMENT_CANCELLED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'APPOINTMENT',
          targetId: id,
          patientId: appointment.patientId,
          actionDetail: {
            reason: payload.reason ?? null,
            tokenNumber: appointment.tokenNumber,
            scheduledDate: appointment.scheduledDate,
          },
        },
        correlationId,
        tx,
      );

      return updated;
    });
  }

  /**
   * Checks a booked appointment in: creates the encounter (`registered`),
   * links it to the appointment, and flips the appointment to `checked_in`.
   * Row lock (`FOR UPDATE`) guarantees exactly one successful check-in under
   * concurrency; all writes + both audit events share one transaction.
   */
  async checkInAppointment(
    id: string,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, id))
        .for('update');
      const appointment = rows[0];
      if (!appointment) {
        throw new NotFoundError('Appointment not found', { code: 'APPOINTMENT_NOT_FOUND' });
      }
      if (
        authContext.role !== 'hospital_admin' &&
        appointment.departmentId !== authContext.departmentId
      ) {
        throw new AuthorizationError('Appointment is outside your department.');
      }
      if (appointment.status !== 'booked') {
        throw new ConflictError(
          `Only booked appointments can be checked in (current status: ${appointment.status}).`,
          { code: 'INVALID_TRANSITION' },
        );
      }

      const [encounter] = await tx
        .insert(encounters)
        .values({
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          departmentId: appointment.departmentId,
          encounterType: 'opd',
          status: 'registered',
          createdBy: actorId,
        })
        .returning();

      const [updated] = await tx
        .update(appointments)
        .set({ status: 'checked_in', encounterId: encounter.id, updatedAt: new Date() })
        .where(and(eq(appointments.id, id), eq(appointments.status, 'booked')))
        .returning();

      await auditService.logEvent(
        {
          eventType: 'APPOINTMENT_CHECKED_IN',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'APPOINTMENT',
          targetId: id,
          patientId: appointment.patientId,
          actionDetail: { encounterId: encounter.id },
        },
        correlationId,
        tx,
      );

      await auditService.logEvent(
        {
          eventType: 'ENCOUNTER_CREATED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'ENCOUNTER',
          targetId: encounter.id,
          patientId: encounter.patientId,
          actionDetail: { viaCheckIn: true, appointmentId: id },
        },
        correlationId,
        tx,
      );

      return { appointment: updated, encounter };
    });
  }

  /**
   * ADR-014 — read-only booking support data (departments + active physicians).
   *
   * Exists because staff-management endpoints (api-architecture §2.10) belong to
   * M20 and the only `appointment:create` holder (receptionist) lacks
   * `staff:manage`. Ratified as a temporary M8 support read:
   * - read-only; no mutation of staff or departments
   * - exposes ONLY: department id/name/code and physician id/first/last/departmentId
   * - no emails, employee IDs, status, auth or credential fields
   * - department-scoped: non-admin callers see only their own department and
   *   its physicians, matching the booking service's own scope rule
   */
  async getBookingOptions(authContext: {
    role: string;
    departmentId: string;
  }): Promise<BookingOptionsResponse> {
    const scoped = authContext.role !== 'hospital_admin';

    const deptRows = await db.query.departments.findMany({
      where: scoped
        ? and(eq(departments.status, 'active'), eq(departments.id, authContext.departmentId))
        : eq(departments.status, 'active'),
      columns: { id: true, name: true, code: true },
      orderBy: [departments.name],
    });

    const physicians = await db.query.staff.findMany({
      where: scoped
        ? and(
            eq(staff.role, 'physician'),
            eq(staff.status, 'active'),
            eq(staff.departmentId, authContext.departmentId),
          )
        : and(eq(staff.role, 'physician'), eq(staff.status, 'active')),
      columns: { id: true, firstName: true, lastName: true, departmentId: true },
    });

    return { departments: deptRows, physicians };
  }
}

export const appointmentService = new AppointmentService();
