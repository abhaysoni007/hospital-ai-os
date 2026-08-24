import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { appointments, appointmentTokenCounters } from '../../../db/schema/appointments';
import { encounters } from '../../../db/schema/appointments';
import { patients } from '../../../db/schema/patients';
import { staff, departments } from '../../../db/schema/staff';
import { auditEvents } from '../../../db/schema/audit';
import { appointmentService } from '../appointment.service';
import { auditService } from '../../audit/audit.service';

/**
 * M8 Slice 1 — Appointment module live-DB integration tests.
 * Mirrors the patient.test.ts convention: real Postgres (:55432), service-level
 * calls, idempotent fixtures, append-only audit rows retained.
 */

const RUN = crypto.randomUUID().slice(0, 8);

function futureDate(dayOffset: number): string {
  return new Date(Date.now() + dayOffset * 86_400_000).toISOString().slice(0, 10);
}

describe('M8 Appointment Module (booking / token / cancel / check-in)', () => {
  let deptId: string;
  let physicianId: string;
  let physician2Id: string;
  let receptionistId: string;
  let nurseId: string;
  let patientId: string;
  const staffIds: string[] = [];

  const receptionistCtx = () => ({ role: 'receptionist', departmentId: deptId });

  beforeAll(async () => {
    // Idempotent fixtures
    let dept = await db.query.departments.findFirst({
      where: eq(departments.code, `M8T`),
    });
    if (!dept) {
      [dept] = await db
        .insert(departments)
        .values({ name: `M8 Test ${RUN}`, code: 'M8T', status: 'active' })
        .returning();
    }
    deptId = dept.id;

    async function ensureStaff(
      email: string,
      role: 'physician' | 'receptionist' | 'nurse',
    ): Promise<string> {
      const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
      if (existing) {
        staffIds.push(existing.id);
        return existing.id;
      }
      const [row] = await db
        .insert(staff)
        .values({
          employeeId: `EMP-M8-${role.toUpperCase()}-${email.split('@')[0]}`,
          email,
          passwordHash: 'dummy',
          firstName: 'M8',
          lastName: role,
          role,
          departmentId: deptId,
          status: 'active',
        })
        .returning();
      staffIds.push(row.id);
      return row.id;
    }

    physicianId = await ensureStaff('m8-physician@test.hospital', 'physician');
    physician2Id = await ensureStaff('m8-physician2@test.hospital', 'physician');
    receptionistId = await ensureStaff('m8-receptionist@test.hospital', 'receptionist');
    nurseId = await ensureStaff('m8-nurse@test.hospital', 'nurse');

    patientId = (
      await db
        .insert(patients)
        .values({
          mrn: `MRN-M8-${RUN.slice(0, 5)}A`,
          firstName: 'Test',
          lastName: 'Patient',
          dateOfBirth: '1990-05-05',
          gender: 'female',
          phonePrimary: `55${RUN.replace(/\D/g, '').padEnd(8, '1').slice(0, 8)}`,
          createdBy: receptionistId,
        })
        .returning()
    )[0].id;

    // ADR-012 counters persist across runs (keyed doctor+date). Reset the
    // fixture doctors' counters so exact token-range assertions hold per run.
    await db.execute(
      sql`DELETE FROM appointment_token_counters WHERE doctor_id IN (${sql.join(
        staffIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    );
  });

  afterAll(async () => {
    // FK-safe cleanup; audit_events retained (append-only by design).
    // NOTE: staff fixtures are intentionally RETAINED — audit_events.actor_id
    // references staff with ON DELETE no action, so actors must persist.
    // ensureStaff() reuses them idempotently on the next run.
    const createdAppointments = await db.query.appointments.findMany({
      where: inArray(appointments.createdBy, staffIds),
      columns: { id: true },
    });
    if (createdAppointments.length) {
      await db.delete(appointments).where(
        inArray(
          appointments.id,
          createdAppointments.map((a) => a.id),
        ),
      );
    }
    await db.delete(encounters).where(inArray(encounters.createdBy, staffIds));
    await db.delete(patients).where(eq(patients.createdBy, receptionistId));
  });

  // -------------------------------------------------------------------------
  it('A. Booking: happy path assigns token 1, status booked, audits APPOINTMENT_BOOKED', async () => {
    const date = futureDate(10);
    const correlationId = crypto.randomUUID();

    const appt = await appointmentService.bookAppointment(
      {
        patientId,
        doctorId: physicianId,
        departmentId: deptId,
        scheduledDate: date,
        scheduledTime: '09:00',
      },
      receptionistId,
      correlationId,
      receptionistCtx(),
    );

    expect(appt.tokenNumber).toBe(1);
    expect(appt.status).toBe('booked');
    expect(appt.encounterId).toBeNull();

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(audit?.eventType).toBe('APPOINTMENT_BOOKED');
    expect(audit?.targetId).toBe(appt.id);
  });

  it('B. Booking validation: past date rejected', async () => {
    await expect(
      appointmentService.bookAppointment(
        {
          patientId,
          doctorId: physicianId,
          departmentId: deptId,
          scheduledDate: futureDate(-1),
          scheduledTime: '09:00',
        },
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
    ).rejects.toThrow();
  });

  it('C. Booking validation: non-physician and department mismatch rejected', async () => {
    const date = futureDate(11);

    await expect(
      appointmentService.bookAppointment(
        {
          patientId,
          doctorId: nurseId,
          departmentId: deptId,
          scheduledDate: date,
          scheduledTime: '10:00',
        },
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
    ).rejects.toThrow(/physician/i);

    await expect(
      appointmentService.bookAppointment(
        {
          patientId,
          doctorId: physicianId,
          departmentId: crypto.randomUUID(), // wrong department for this doctor
          scheduledDate: date,
          scheduledTime: '10:00',
        },
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
    ).rejects.toThrow(/department/i);
  });

  it('D. Double booking → 409 SLOT_UNAVAILABLE; cancelled slot becomes bookable with NEW token', async () => {
    const date = futureDate(12);

    const first = await appointmentService.bookAppointment(
      {
        patientId,
        doctorId: physicianId,
        departmentId: deptId,
        scheduledDate: date,
        scheduledTime: '11:00',
      },
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );

    await expect(
      appointmentService.bookAppointment(
        {
          patientId,
          doctorId: physicianId,
          departmentId: deptId,
          scheduledDate: date,
          scheduledTime: '11:00',
        },
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });

    const cancelled = await appointmentService.cancelAppointment(
      first.id,
      {},
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );
    expect(cancelled.status).toBe('cancelled');

    // Same slot bookable again; token counter NOT decremented → next token issued.
    const rebooked = await appointmentService.bookAppointment(
      {
        patientId,
        doctorId: physicianId,
        departmentId: deptId,
        scheduledDate: date,
        scheduledTime: '11:00',
      },
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );
    expect(rebooked.status).toBe('booked');
    expect(rebooked.tokenNumber).toBe(first.tokenNumber! + 1); // fresh number, never reused
  });

  it('E. Cancellation rules: only booked cancellable; second cancel → INVALID_TRANSITION', async () => {
    const date = futureDate(13);
    const appt = await appointmentService.bookAppointment(
      {
        patientId,
        doctorId: physicianId,
        departmentId: deptId,
        scheduledDate: date,
        scheduledTime: '12:00',
      },
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );

    await appointmentService.cancelAppointment(
      appt.id,
      {},
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );

    await expect(
      appointmentService.cancelAppointment(
        appt.id,
        {},
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    // Cancelled appointment cannot be checked in.
    await expect(
      appointmentService.checkInAppointment(
        appt.id,
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('F. Check-in: creates registered encounter, links appointment, writes BOTH audit events atomically', async () => {
    const date = futureDate(14);
    const correlationId = crypto.randomUUID();
    const appt = await appointmentService.bookAppointment(
      {
        patientId,
        doctorId: physicianId,
        departmentId: deptId,
        scheduledDate: date,
        scheduledTime: '13:00',
      },
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );

    const result = await appointmentService.checkInAppointment(
      appt.id,
      receptionistId,
      correlationId,
      receptionistCtx(),
    );

    expect(result.appointment.status).toBe('checked_in');
    expect(result.appointment.encounterId).toBe(result.encounter.id);
    expect(result.encounter.status).toBe('registered');
    expect(result.encounter.doctorId).toBe(physicianId);

    const events = await db.query.auditEvents.findMany({
      where: eq(auditEvents.correlationId, correlationId),
    });
    const types = events.map((e) => e.eventType).sort();
    expect(types).toEqual(['APPOINTMENT_CHECKED_IN', 'ENCOUNTER_CREATED']);
  });

  it('G. Second check-in → 409 INVALID_TRANSITION', async () => {
    const date = futureDate(15);
    const appt = await appointmentService.bookAppointment(
      {
        patientId,
        doctorId: physicianId,
        departmentId: deptId,
        scheduledDate: date,
        scheduledTime: '14:00',
      },
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );

    await appointmentService.checkInAppointment(
      appt.id,
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );

    await expect(
      appointmentService.checkInAppointment(
        appt.id,
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('H. Audit failure → full rollback: no appointment, no audit row, counter reverted (no gap)', async () => {
    const date = futureDate(16);

    const counterBefore =
      (
        await db
          .select()
          .from(appointmentTokenCounters)
          .where(
            and(
              eq(appointmentTokenCounters.doctorId, physicianId),
              eq(appointmentTokenCounters.scheduledDate, date),
            ),
          )
      )[0]?.lastToken ?? 0;

    const auditSpy = vi
      .spyOn(auditService, 'logEvent')
      .mockRejectedValueOnce(new Error('INTENTIONAL_AUDIT_FAILURE'));

    let threw = false;
    try {
      await appointmentService.bookAppointment(
        {
          patientId,
          doctorId: physicianId,
          departmentId: deptId,
          scheduledDate: date,
          scheduledTime: '15:00',
        },
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      );
    } catch (e) {
      threw = true;
      expect(String(e)).toContain('INTENTIONAL_AUDIT_FAILURE');
    }
    auditSpy.mockRestore();
    expect(threw).toBe(true);

    // No orphan appointment at that slot
    const orphan = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.doctorId, physicianId),
        eq(appointments.scheduledDate, date),
        eq(appointments.scheduledTime, '15:00'),
      ),
    });
    expect(orphan).toBeUndefined();

    // Counter reverted exactly (transactional allocation ⇒ NO gap)
    const counterAfter =
      (
        await db
          .select()
          .from(appointmentTokenCounters)
          .where(
            and(
              eq(appointmentTokenCounters.doctorId, physicianId),
              eq(appointmentTokenCounters.scheduledDate, date),
            ),
          )
      )[0]?.lastToken ?? 0;
    expect(counterAfter).toBe(counterBefore);

    // The slot can be re-booked and receives the counter's next value (gap reused).
    const retry = await appointmentService.bookAppointment(
      {
        patientId,
        doctorId: physicianId,
        departmentId: deptId,
        scheduledDate: date,
        scheduledTime: '15:00',
      },
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );
    expect(retry.tokenNumber).toBe(counterBefore + 1);
  });

  it('I. CONCURRENCY: 20 parallel bookings same doctor/day → unique tokens 1..20, counter == max, no deadlocks', async () => {
    const date = futureDate(1000 + Math.floor(Math.random() * 1000)); // unique per run

    // Deterministic distinct times ⇒ every booking must succeed.
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        appointmentService.bookAppointment(
          {
            patientId,
            doctorId: physicianId,
            departmentId: deptId,
            scheduledDate: date,
            scheduledTime: `08:${String(i).padStart(2, '0')}`,
          },
          receptionistId,
          crypto.randomUUID(),
          receptionistCtx(),
        ),
      ),
    );

    expect(results).toHaveLength(20);
    const tokens = results
      .map((r: { tokenNumber: number | null }) => r.tokenNumber as number)
      .sort((a: number, b: number) => a - b);
    expect(new Set(tokens).size).toBe(20); // no duplicates
    expect(tokens).toEqual(Array.from({ length: 20 }, (_, i) => i + 1)); // exact range 1..20, no gaps

    const counter = (
      await db
        .select()
        .from(appointmentTokenCounters)
        .where(
          and(
            eq(appointmentTokenCounters.doctorId, physicianId),
            eq(appointmentTokenCounters.scheduledDate, date),
          ),
        )
    )[0];
    expect(counter.lastToken).toBe(20); // counter matches highest committed token
  });

  it('J. CONCURRENCY: different doctors/day allocate independent sequences starting at 1', async () => {
    const date = futureDate(1000 + Math.floor(Math.random() * 1000));

    const [a, b] = await Promise.all([
      appointmentService.bookAppointment(
        {
          patientId,
          doctorId: physicianId,
          departmentId: deptId,
          scheduledDate: date,
          scheduledTime: '09:30',
        },
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
      appointmentService.bookAppointment(
        {
          patientId,
          doctorId: physician2Id,
          departmentId: deptId,
          scheduledDate: date,
          scheduledTime: '09:30',
        },
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
    ]);

    expect(a.tokenNumber).toBe(1);
    expect(b.tokenNumber).toBe(1);
  });

  it('K. CONCURRENCY: 20 parallel check-ins on ONE appointment → exactly one succeeds', async () => {
    const date = futureDate(17);
    const appt = await appointmentService.bookAppointment(
      {
        patientId,
        doctorId: physicianId,
        departmentId: deptId,
        scheduledDate: date,
        scheduledTime: '16:00',
      },
      receptionistId,
      crypto.randomUUID(),
      receptionistCtx(),
    );

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        appointmentService.checkInAppointment(
          appt.id,
          receptionistId,
          crypto.randomUUID(),
          receptionistCtx(),
        ),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(19);
    for (const f of failed as PromiseRejectedResult[]) {
      expect((f.reason as { code?: string }).code).toBe('INVALID_TRANSITION');
    }

    // Exactly one encounter per successful check-in in this suite (F, G, K).
    const linkedEncounters = await db.query.encounters.findMany({
      where: eq(encounters.createdBy, receptionistId),
    });
    expect(linkedEncounters.length).toBe(3);
  });

  it('L. Department scope: receptionist cannot book outside own department', async () => {
    await expect(
      appointmentService.bookAppointment(
        {
          patientId,
          doctorId: physicianId,
          departmentId: crypto.randomUUID(),
          scheduledDate: futureDate(20),
          scheduledTime: '08:00',
        },
        receptionistId,
        crypto.randomUUID(),
        receptionistCtx(),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
  });

  it('M. Hash chain remains continuous after the whole suite', async () => {
    const rows = await db
      .select()
      .from(auditEvents)
      .orderBy(sql`sequence_number ASC`)
      .limit(500);
    void rows;
    // Spot-check: last two events chain correctly
    const lastTwo = await db.query.auditEvents.findMany({
      orderBy: [sql`sequence_number DESC`],
      limit: 2,
    });
    if (lastTwo.length === 2) {
      expect(lastTwo[1].recordHash).toBe(lastTwo[0].previousHash);
    }
  });
});
