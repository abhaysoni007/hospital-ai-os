import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../db';
import { encounters, appointments } from '../../../db/schema/appointments';
import { patients } from '../../../db/schema/patients';
import { staff, departments } from '../../../db/schema/staff';
import { auditEvents } from '../../../db/schema/audit';
import { encounterService } from '../encounter.service';
import { appointmentService } from '../../appointment/appointment.service';

/**
 * M8 Slice 1 — Encounter module live-DB integration tests:
 * creation, activation, optimistic concurrency, scope checks,
 * and the ADR-013 PHI response boundary.
 */

const RUN = crypto.randomUUID().slice(0, 8);

describe('M8 Encounter Module', () => {
  let deptAId: string;
  let deptBId: string;
  let physicianAId: string;
  let physicianBId: string;
  let nurseAId: string;
  let receptionistId: string;
  let patientId: string;
  const staffIds: string[] = [];

  beforeAll(async () => {
    async function ensureDept(code: string, name: string): Promise<string> {
      const existing = await db.query.departments.findFirst({ where: eq(departments.code, code) });
      if (existing) return existing.id;
      return (await db.insert(departments).values({ code, name, status: 'active' }).returning())[0]
        .id;
    }
    deptAId = await ensureDept('M8E', `M8 Encounter A ${RUN}`);
    deptBId = await ensureDept('M8F', `M8 Encounter B ${RUN}`);

    async function ensureStaff(
      email: string,
      role: 'physician' | 'receptionist' | 'nurse',
      departmentId: string,
    ): Promise<string> {
      const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
      if (existing) {
        staffIds.push(existing.id);
        return existing.id;
      }
      const [row] = await db
        .insert(staff)
        .values({
          employeeId: `EMP-M8E-${email.split('@')[0]}`,
          email,
          passwordHash: 'dummy',
          firstName: 'M8E',
          lastName: role,
          role,
          departmentId,
          status: 'active',
        })
        .returning();
      staffIds.push(row.id);
      return row.id;
    }

    physicianAId = await ensureStaff('m8e-physician-a@test.hospital', 'physician', deptAId);
    physicianBId = await ensureStaff('m8e-physician-b@test.hospital', 'physician', deptBId);
    nurseAId = await ensureStaff('m8e-nurse-a@test.hospital', 'nurse', deptAId);
    receptionistId = await ensureStaff('m8e-receptionist@test.hospital', 'receptionist', deptAId);

    patientId = (
      await db
        .insert(patients)
        .values({
          mrn: `MRN-M8E-${RUN.slice(0, 5)}B`,
          firstName: 'Encounter',
          lastName: 'Test',
          dateOfBirth: '1985-03-03',
          gender: 'male',
          phonePrimary: `66${RUN.replace(/\D/g, '').padEnd(8, '2').slice(0, 8)}`,
          createdBy: receptionistId,
        })
        .returning()
    )[0].id;
  });

  afterAll(async () => {
    // Staff retained (audit FK, see appointment.test.ts).
    // FK order matters: appointments.encounter_id → encounters, so unlink first.
    const encRows = await db.query.encounters.findMany({
      where: inArray(encounters.createdBy, staffIds),
      columns: { id: true },
    });
    if (encRows.length) {
      for (const enc of encRows) {
        await db.delete(appointments).where(eq(appointments.encounterId, enc.id));
      }
    }
    await db.delete(encounters).where(inArray(encounters.createdBy, staffIds));
    await db.delete(patients).where(eq(patients.createdBy, receptionistId));
  });

  const ctxA = (role: string) => ({ role, departmentId: deptAId });

  async function createTestEncounter(chiefComplaint?: string, correlationId?: string) {
    return encounterService.createEncounter(
      {
        patientId,
        doctorId: physicianAId,
        departmentId: deptAId,
        encounterType: 'opd',
        chiefComplaint,
      },
      receptionistId,
      correlationId ?? crypto.randomUUID(),
      ctxA('receptionist'),
    );
  }

  // -------------------------------------------------------------------------
  it('A. Creation: walk-in encounter starts registered with version 1 + audit event', async () => {
    const correlationId = crypto.randomUUID();
    const enc = await createTestEncounter('Chest pain', correlationId);

    expect(enc.status).toBe('registered');
    expect(enc.version).toBe(1);
    expect(enc.startedAt).toBeNull();

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(audit?.eventType).toBe('ENCOUNTER_CREATED');
    expect(audit?.targetType).toBe('ENCOUNTER');
  });

  it('B. Activation by assigned physician → active, started_at set, version incremented, audit written', async () => {
    const enc = await createTestEncounter();
    const correlationId = crypto.randomUUID();

    const activated = await encounterService.activateEncounter(
      enc.id,
      1,
      physicianAId,
      correlationId,
      ctxA('physician'),
    );

    expect(activated.status).toBe('active');
    expect(activated.startedAt).not.toBeNull();
    expect(activated.version).toBe(2);

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(audit?.eventType).toBe('ENCOUNTER_ACTIVATED');
  });

  it('C. State machine via service: activating an active encounter → INVALID_TRANSITION', async () => {
    const enc = await createTestEncounter();
    await encounterService.activateEncounter(
      enc.id,
      1,
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );

    await expect(
      encounterService.activateEncounter(
        enc.id,
        2,
        physicianAId,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('D. Optimistic concurrency: stale version → VERSION_CONFLICT', async () => {
    const enc = await createTestEncounter();
    const ctxPhysician = ctxA('physician');

    // First activation succeeds (version 1 → 2)
    await encounterService.activateEncounter(
      enc.id,
      1,
      physicianAId,
      crypto.randomUUID(),
      ctxPhysician,
    );

    // Second attempt with the SAME (now stale) version → VERSION_CONFLICT
    await expect(
      encounterService.activateEncounter(
        enc.id,
        1,
        physicianAId,
        crypto.randomUUID(),
        ctxPhysician,
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('E. Scope: non-assigned physician → 403; cross-department nurse → 403', async () => {
    const enc = await createTestEncounter();

    // Physician B is a valid physician but not assigned to this encounter
    await expect(
      encounterService.activateEncounter(enc.id, 1, physicianBId, crypto.randomUUID(), {
        role: 'physician',
        departmentId: deptBId,
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    // Nurse from a different department
    await expect(
      encounterService.activateEncounter(enc.id, 1, physicianBId, crypto.randomUUID(), {
        role: 'nurse',
        departmentId: deptBId,
      }),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
  });

  it('F. Scope: same-department nurse MAY activate', async () => {
    const enc = await createTestEncounter();
    const activated = await encounterService.activateEncounter(
      enc.id,
      1,
      nurseAId,
      crypto.randomUUID(),
      ctxA('nurse'),
    );
    expect(activated.status).toBe('active');
  });

  it('G. ADR-013 PHI boundary: chiefComplaint omitted WITHOUT clinical_record:read, present WITH it', async () => {
    const enc = await createTestEncounter('Severe migraine');

    // Receptionist holds encounter:read but NOT clinical_record:read → key omitted entirely
    const forReceptionist = await encounterService.getEncounterDetail(enc.id, ctxA('receptionist'));
    expect(forReceptionist).not.toHaveProperty('chiefComplaint');

    // Nurse holds clinical_record:read → chiefComplaint present
    const forNurse = await encounterService.getEncounterDetail(enc.id, ctxA('nurse'));
    expect(forNurse.chiefComplaint).toBe('Severe migraine');

    // Neither response ever embeds clinical/diagnostic collections
    for (const detail of [forReceptionist, forNurse]) {
      expect(detail).not.toHaveProperty('clinicalRecords');
      expect(detail).not.toHaveProperty('diagnosticOrders');
      expect(detail).not.toHaveProperty('diagnosticResults');
    }
  });

  it('H. Detail includes bounded patient demographics + linked appointment metadata', async () => {
    const date = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const appt = await appointmentService.bookAppointment(
      {
        patientId,
        doctorId: physicianAId,
        departmentId: deptAId,
        scheduledDate: date,
        scheduledTime: '10:15',
      },
      receptionistId,
      crypto.randomUUID(),
      ctxA('receptionist'),
    );
    const checkedIn = await appointmentService.checkInAppointment(
      appt.id,
      receptionistId,
      crypto.randomUUID(),
      ctxA('receptionist'),
    );

    // hospital_admin reads globally (no department restriction)
    const adminDetail = await encounterService.getEncounterDetail(checkedIn.encounter.id, {
      role: 'hospital_admin',
      departmentId: deptBId,
    });

    expect(adminDetail.patient).toMatchObject({
      id: patientId,
      lastName: 'Test',
    });
    expect(adminDetail.appointment?.id).toBe(appt.id);
    expect(adminDetail.appointment?.tokenNumber).toBeGreaterThan(0);
    expect(adminDetail.appointment?.status).toBe('checked_in');
  });

  it('I. List scope: query parameters cannot bypass department scope', async () => {
    // Create an encounter in department B by its own physician-receptionist combo
    const encB = await encounterService.createEncounter(
      {
        patientId,
        doctorId: physicianBId,
        departmentId: deptBId,
        encounterType: 'follow_up',
      },
      receptionistId,
      crypto.randomUUID(),
      { role: 'physician', departmentId: deptBId }, // creator acts as dept-B physician
    );

    // Department-A receptionist lists encounters: forced to dept A only.
    const listA = await encounterService.listEncounters(
      { page: 1, pageSize: 100, departmentId: deptBId } as never, // attempted bypass
      ctxA('receptionist'),
    );
    expect(listA.data.some((e) => e.id === encB.id)).toBe(false);

    // hospital_admin reads globally and CAN filter by department B.
    const listAdmin = await encounterService.listEncounters(
      { page: 1, pageSize: 100, departmentId: deptBId },
      { role: 'hospital_admin', departmentId: deptAId },
    );
    expect(listAdmin.data.some((e) => e.id === encB.id)).toBe(true);
  });
});
