/**
 * M18 Part 1 — Clinical data integrity regression tests.
 *
 * Each test targets a single defect fixed by M18. Tests run against the
 * real PostgreSQL dev demo database (no mocks) and rely on seeded staff
 * (active.test@hospital.os or equivalent) for the actor.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { eq, and, ne, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../db';
import { auditEvents } from '../db/schema/audit';
import { patients as patientsTable } from '../db/schema';
import { appointments as appointmentsTable, encounters, staff as staffTable } from '../db/schema';
import { tasks as tasksTable } from '../db/schema/tasks';
import { encounterService } from '../modules/encounter/encounter.service';
import { patientService } from '../modules/patient/patient.service';
import { appointmentService } from '../modules/appointment/appointment.service';
import { diagnosticsService } from '../modules/diagnostics/diagnostics.service';
import { taskService } from '../modules/task/task.service';
import { auditService } from '../modules/audit/audit.service';
import { ConflictError, AuthorizationError } from 'shared/src/errors/AppError';
import {
  canTransition,
  ENCOUNTER_TRANSITIONS,
} from '../modules/encounter/encounter.state-machine';
import { randomUUID } from 'crypto';

interface StaffHandle {
  id: string;
  departmentId: string;
}

interface SeedHandles {
  /** Owns the encounters and diagnostic orders under test. */
  physician: StaffHandle;
  /** Registers patients and books appointments. */
  receptionist: StaffHandle;
  /** Receptionist in a *different* department — the negative case for scope parity. */
  otherDeptReceptionist: StaffHandle;
  patientId: string;
}

/**
 * Per-run suffix. `registerPatient` rejects an exact firstName+lastName+DOB
 * match as a duplicate, so fixed literals would make every test after the
 * first run fail with DUPLICATE_PATIENT. The suffix keeps the suite re-runnable
 * against a long-lived demo database.
 */
const RUN = randomUUID().slice(0, 8);

const seeds: SeedHandles = {
  physician: { id: '', departmentId: '' },
  receptionist: { id: '', departmentId: '' },
  otherDeptReceptionist: { id: '', departmentId: '' },
  patientId: '',
};

/**
 * Resolve every active staff member of a role, ordered by department, so the
 * fixture does not depend on which departments happen to come back first from
 * an unordered `departments` scan.
 */
async function findStaffByRole(role: string): Promise<StaffHandle[]> {
  const rows = await db
    .select({ id: staffTable.id, departmentId: staffTable.departmentId })
    .from(staffTable)
    .where(
      and(
        // Drizzle types the enum column narrowly; the role list lives in the DB enum.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq(staffTable.role as any, role),
        eq(staffTable.status, 'active'),
      ),
    )
    .orderBy(staffTable.departmentId);
  return rows;
}

async function findOrCreatePatient(
  payload: { firstName: string; lastName: string; dob: string; phone: string },
  creatorId: string,
): Promise<string> {
  // Try to reuse an existing patient with the same phone to keep tests idempotent.
  const existing = await db.query.patients.findFirst({
    where: eq(patientsTable.phonePrimary, payload.phone),
  });
  if (existing) return existing.id;
  const created = await patientService.registerPatient(
    {
      firstName: payload.firstName,
      lastName: payload.lastName,
      dateOfBirth: payload.dob,
      gender: 'undisclosed',
      phonePrimary: payload.phone,
    },
    creatorId,
    randomUUID(),
    { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
  );
  return created.id;
}

beforeAll(async () => {
  const receptionists = await findStaffByRole('receptionist');
  if (receptionists.length < 2) {
    throw new Error(
      'M18 tests require receptionists in at least 2 departments; run pnpm seed:demo first.',
    );
  }
  seeds.receptionist = receptionists[0];
  // Department-scope parity needs a receptionist whose department differs from
  // the one that owns the appointment.
  const otherDept = receptionists.find(
    (r) => r.departmentId !== seeds.receptionist.departmentId,
  );
  if (!otherDept) {
    throw new Error('M18 tests require receptionists in 2 distinct departments.');
  }
  seeds.otherDeptReceptionist = otherDept;

  // The physician must sit in the receptionist's department: the appointment is
  // booked into the physician's department, and the parity assertion only means
  // something if the *other* receptionist is genuinely outside it.
  const physicians = await findStaffByRole('physician');
  const physician = physicians.find((p) => p.departmentId === seeds.receptionist.departmentId);
  if (!physician) {
    throw new Error(
      `M18 tests require a physician in department ${seeds.receptionist.departmentId}.`,
    );
  }
  seeds.physician = physician;

  seeds.patientId = await findOrCreatePatient(
    { firstName: 'M18A', lastName: 'Patient', dob: '1990-01-01', phone: '+10000000001' },
    seeds.receptionist.id,
  );
});

describe('M18 — auditability', () => {
  it('recorded audit hash is recomputable from the stored row (jsonb canonicalization)', async () => {
    const before = await db
      .select({ seq: auditEvents.sequenceNumber })
      .from(auditEvents)
      .orderBy(desc(auditEvents.sequenceNumber))
      .limit(1);
    const baseSequence = before[0]?.seq ?? 0;

    const intent = { eventType: 'TEST_AUDIT_HASH', actorId: seeds.physician.id, actorRole: 'physician', actorDepartment: seeds.physician.departmentId, targetType: 'TEST', targetId: randomUUID() };
    await auditService.logEvent(intent, randomUUID());

    const rows = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'TEST_AUDIT_HASH'))
      .orderBy(desc(auditEvents.sequenceNumber))
      .limit(1);
    const row = rows[0];
    expect(row.sequenceNumber).toBeGreaterThan(baseSequence);

    // jsonbCanonical must match the jsonb order (length-then-bytewise).
    const canonical = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(canonical);
      if (v !== null && typeof v === 'object') {
        const entries = Object.entries(v as Record<string, unknown>).sort(([k1], [k2]) =>
          k1.length !== k2.length ? k1.length - k2.length : k1 < k2 ? -1 : k1 > k2 ? 1 : 0,
        );
        return Object.fromEntries(entries.map(([k, v]) => [k, canonical(v)]));
      }
      return v;
    };
    const payloadString = JSON.stringify({
      eventType: row.eventType,
      actorId: row.actorId,
      actorRole: row.actorRole,
      actorDepartment: row.actorDepartment,
      targetType: row.targetType || null,
      targetId: row.targetId || null,
      patientId: row.patientId || null,
      actionDetail: canonical(row.actionDetail) || null,
      justification: row.justification || null,
      ipAddress: row.ipAddress || null,
      correlationId: row.correlationId,
    });
    const expected = createHash('sha256').update(row.previousHash + payloadString).digest('hex');
    expect(row.recordHash).toBe(expected);
  });
});

describe('M18 — state transitions', () => {
  it('encounter state machine permits active → discharged (M13 alignment)', () => {
    expect(canTransition('active', 'discharged')).toBe(true);
    expect(ENCOUNTER_TRANSITIONS.discharged).toHaveLength(0);
  });

  it('discharging a non-active encounter fails with INVALID_TRANSITION', async () => {
    const created = await encounterService.createEncounter(
      {
        patientId: seeds.patientId,
        doctorId: seeds.physician.id,
        departmentId: seeds.physician.departmentId,
        encounterType: 'opd',
      } as never,
      seeds.physician.id,
      randomUUID(),
      { role: 'physician', departmentId: seeds.physician.departmentId },
    );
    // Status is 'registered'; discharge must fail.
    await expect(
      encounterService.dischargeEncounter(
        created.id,
        { expectedVersion: created.version, summary: 'too early' } as never,
        seeds.physician.id,
        randomUUID(),
        { role: 'physician', departmentId: seeds.physician.departmentId },
      ),
    ).rejects.toThrow(ConflictError);
  });
});

describe('M18 — optimistic concurrency', () => {
  it('patient update with stale expectedVersion → VERSION_CONFLICT', async () => {
    // Force a fresh patient to avoid races with the test fixture.
    const patient = await patientService.registerPatient(
      {
        firstName: 'M18',
        lastName: `Optimistic-${RUN}`,
        dateOfBirth: '1991-01-01',
        gender: 'undisclosed',
        phonePrimary: `+1${Math.floor(Math.random() * 1e10)}`,
      },
      seeds.receptionist.id,
      randomUUID(),
      { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
    );

    const staleVersion = patient.version - 1;
    await expect(
      patientService.updatePatient(
        patient.id,
        { firstName: 'Renamed', expectedVersion: staleVersion } as never,
        seeds.receptionist.id,
        randomUUID(),
        { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('patient update with current expectedVersion succeeds and increments version', async () => {
    const patient = await patientService.registerPatient(
      {
        firstName: 'M18',
        lastName: `FreshVersion-${RUN}`,
        dateOfBirth: '1992-01-01',
        gender: 'undisclosed',
        phonePrimary: `+1${Math.floor(Math.random() * 1e10)}`,
      },
      seeds.receptionist.id,
      randomUUID(),
      { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
    );

    const updated = await patientService.updatePatient(
      patient.id,
      { firstName: 'Renamed', expectedVersion: patient.version } as never,
      seeds.receptionist.id,
      randomUUID(),
      { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
    );
    expect(updated.version).toBe(patient.version + 1);
    expect(updated.firstName).toBe('Renamed');
  });
});

describe('M18 — identity-verify status guard', () => {
  it('verifying an already-resolved identity deterministically rejects', async () => {
    const identity = await db.transaction(async () => {
      const patient = await patientService.registerPatient(
        {
          firstName: 'M18',
          lastName: `Identity-${RUN}`,
          dateOfBirth: '1993-01-01',
          gender: 'undisclosed',
          phonePrimary: `+1${Math.floor(Math.random() * 1e10)}`,
        },
        seeds.receptionist.id,
        randomUUID(),
        { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
      );
      return await patientService.addIdentity(
        patient.id,
        { documentType: 'aadhaar', documentNumber: `M18-IDENT-${RUN}` } as never,
        seeds.receptionist.id,
        randomUUID(),
        { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
      );
    });
    // First verify: succeeds.
    const first = await patientService.verifyIdentity(
      identity.patientId,
      identity.id,
      'verified',
      seeds.receptionist.id,
      randomUUID(),
      { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
    );
    expect(first.verificationStatus).toBe('verified');
    // Second: status predicate + 23505 mapped → IDENTITY_ALREADY_RESOLVED.
    await expect(
      patientService.verifyIdentity(
        identity.patientId,
        identity.id,
        'rejected',
        seeds.receptionist.id,
        randomUUID(),
        { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
      ),
    ).rejects.toThrow(ConflictError);
  });
});

/**
 * Pick a slot that is still free for this doctor on this date. Booking rejects a
 * duplicate (doctor, date, time) with SLOT_UNAVAILABLE, so a hard-coded time
 * would only work on the first run against a persistent database.
 */
async function findFreeSlot(doctorId: string, date: string): Promise<string> {
  const taken = new Set(
    (
      await db
        .select({ time: appointmentsTable.scheduledTime })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.doctorId, doctorId),
            eq(appointmentsTable.scheduledDate, date),
            ne(appointmentsTable.status, 'cancelled'),
          ),
        )
    ).map((r) => r.time.slice(0, 5)),
  );
  for (let hour = 8; hour < 20; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const slot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      if (!taken.has(slot)) return slot;
    }
  }
  throw new Error(`No free slot for doctor ${doctorId} on ${date}.`);
}

describe('M18 — appointment cancel department parity', () => {
  it('receptionist in another department cannot cancel an appointment outside their scope', async () => {
    const scheduledDate = new Date().toISOString().slice(0, 10);
    const booked = await appointmentService.bookAppointment(
      {
        patientId: seeds.patientId,
        doctorId: seeds.physician.id,
        departmentId: seeds.physician.departmentId,
        scheduledDate,
        scheduledTime: await findFreeSlot(seeds.physician.id, scheduledDate),
      } as never,
      seeds.receptionist.id,
      randomUUID(),
      { role: 'receptionist', departmentId: seeds.receptionist.departmentId },
    );

    await expect(
      appointmentService.cancelAppointment(
        booked.id,
        { reason: 'x' } as never,
        seeds.otherDeptReceptionist.id,
        randomUUID(),
        { role: 'receptionist', departmentId: seeds.otherDeptReceptionist.departmentId },
      ),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe('M18 — diagnostic order idempotency', () => {
  it('same clientRequestId on the same encounter returns the original order', async () => {
    // Build an active encounter owned by the seeded physician.
    const enc = await encounterService.createEncounter(
      {
        patientId: seeds.patientId,
        doctorId: seeds.physician.id,
        departmentId: seeds.physician.departmentId,
        encounterType: 'opd',
      } as never,
      seeds.physician.id,
      randomUUID(),
      { role: 'physician', departmentId: seeds.physician.departmentId },
    );
    await encounterService.activateEncounter(
      enc.id,
      enc.version,
      seeds.physician.id,
      randomUUID(),
      { role: 'physician', departmentId: seeds.physician.departmentId },
    );

    const key = `m18-idem-${randomUUID()}`;
    const a = await diagnosticsService.createOrder(
      enc.id,
      {
        testCode: 'CBC',
        testName: 'Complete Blood Count',
        priority: 'routine',
        clientRequestId: key,
      } as never,
      seeds.physician.id,
      randomUUID(),
      { role: 'physician', departmentId: seeds.physician.departmentId },
    );
    const b = await diagnosticsService.createOrder(
      enc.id,
      {
        testCode: 'CBC',
        testName: 'Complete Blood Count',
        priority: 'routine',
        clientRequestId: key,
      } as never,
      seeds.physician.id,
      randomUUID(),
      { role: 'physician', departmentId: seeds.physician.departmentId },
    );
    expect(b.id).toBe(a.id);
  });
});

describe('M18 — task escalate race guard', () => {
  it('completed tasks cannot be escalated; guarded UPDATE yields INVALID_TRANSITION', async () => {
    // Direct DB setup: build a completed task owned by the physician, then try
    // to escalate it through the service.
    const taskRow = await db.transaction(async (tx) => {
      const enc = await tx.query.encounters.findFirst({
        where: eq(encounters.doctorId, seeds.physician.id),
      });
      const patient = await tx.query.patients.findFirst({});
      const [row] = await tx
        .insert(tasksTable)
        .values({
          taskType: 'general',
          title: 'M18 escalate guard',
          description: 'pre-completed',
          patientId: patient?.id ?? null,
          encounterId: enc?.id ?? null,
          assignedTo: seeds.physician.id,
          assignedBy: seeds.physician.id,
          priority: 'low',
          status: 'completed',
        } as never)
        .returning();
      return row;
    });

    await expect(
      taskService.escalateTask(taskRow.id, seeds.physician.id, randomUUID(), {
        role: 'physician',
        departmentId: seeds.physician.departmentId,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
