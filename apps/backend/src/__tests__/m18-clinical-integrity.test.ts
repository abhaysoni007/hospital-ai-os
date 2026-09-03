/**
 * M18 Part 1 — Clinical data integrity regression tests.
 *
 * Each test targets a single defect fixed by M18. Tests run against the
 * real PostgreSQL dev demo database (no mocks) and rely on seeded staff
 * (active.test@hospital.os or equivalent) for the actor.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../db';
import { auditEvents } from '../db/schema/audit';
import { patients as patientsTable } from '../db/schema';
import { encounters, staff as staffTable } from '../db/schema';
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

interface SeedHandles {
  physician: { id: string; departmentId: string };
  receptionist: { id: string; departmentId: string };
  otherDeptPhysician: { id: string; departmentId: string };
  otherDeptReceptionist: { id: string; departmentId: string };
  labTech: { id: string; departmentId: string };
  nurse: { id: string; departmentId: string };
  patientId: string;
  otherDeptPatientId: string;
}

const seeds: SeedHandles = {
  physician: { id: '', departmentId: '' },
  receptionist: { id: '', departmentId: '' },
  otherDeptPhysician: { id: '', departmentId: '' },
  otherDeptReceptionist: { id: '', departmentId: '' },
  labTech: { id: '', departmentId: '' },
  nurse: { id: '', departmentId: '' },
  patientId: '',
  otherDeptPatientId: '',
};

async function findStaff(
  role: string,
  deptId: string,
): Promise<{ id: string; departmentId: string } | undefined> {
  const row = await db.query.staff.findFirst({
    where: and(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(staffTable.role as any, role),
      eq(staffTable.departmentId, deptId),
    ),
  });
  if (!row) return undefined;
  return { id: row.id, departmentId: row.departmentId };
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
  const depts = await db.query.departments.findMany({ limit: 2 });
  if (depts.length < 2) {
    throw new Error('M18 tests require at least 2 seeded departments; run db:seed-demo first.');
  }
  const [a, b] = depts;
  const p = (await findStaff('physician', a.id)) ?? (await findStaff('physician', b.id));
  if (!p) throw new Error('M18 tests require at least one physician in the seed.');
  seeds.physician = p;
  const r =
    (await findStaff('receptionist', a.id)) ?? (await findStaff('receptionist', b.id));
  if (!r) throw new Error('M18 tests require at least one receptionist in the seed.');
  seeds.receptionist = r;
  const odp = await findStaff('physician', b.id);
  if (!odp) throw new Error('M18 tests require a physician in the second seeded department.');
  seeds.otherDeptPhysician = odp;
  const odr = await findStaff('receptionist', b.id);
  if (!odr) throw new Error('M18 tests require a receptionist in the second seeded department.');
  seeds.otherDeptReceptionist = odr;
  const lt = await findStaff('lab_technician', a.id);
  if (!lt) throw new Error('M18 tests require a lab_technician in the first seeded department.');
  seeds.labTech = lt;
  const nu = await findStaff('nurse', a.id);
  if (!nu) throw new Error('M18 tests require a nurse in the first seeded department.');
  seeds.nurse = nu;
  seeds.patientId = await findOrCreatePatient(
    { firstName: 'M18A', lastName: 'Patient', dob: '1990-01-01', phone: '+10000000001' },
    seeds.receptionist.id,
  );
  seeds.otherDeptPatientId = await findOrCreatePatient(
    { firstName: 'M18B', lastName: 'Patient', dob: '1990-01-01', phone: '+10000000002' },
    seeds.otherDeptReceptionist.id,
  );
});

afterAll(async () => {
  // No global teardown — each test cleans its own rows where it matters.
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
        lastName: 'Optimistic',
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
        lastName: 'FreshVersion',
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
          lastName: 'Identity',
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
        { documentType: 'aadhaar', documentNumber: 'M18-IDENT-1' } as never,
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

describe('M18 — appointment cancel department parity', () => {
  it('receptionist in another department cannot cancel an appointment outside their scope', async () => {
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
    const booked = await appointmentService.bookAppointment(
      {
        patientId: seeds.patientId,
        doctorId: seeds.physician.id,
        departmentId: seeds.physician.departmentId,
        scheduledDate: new Date().toISOString().slice(0, 10),
        scheduledTime: '08:00',
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

    // Sanity: encounter from above is unused here, suppress unused var.
    void created;
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
