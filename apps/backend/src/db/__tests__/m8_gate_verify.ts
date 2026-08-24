/**
 * M8 Slice 1 — Live API acceptance gate (mirrors phase4_verification.ts style).
 * Boots the real Express app, performs real RS256 logins against the live DB,
 * and walks the full BOOK → CHECK-IN → ENCOUNTER → ACTIVATE workflow over HTTP.
 *
 * Run: pnpm --filter backend exec tsx src/db/__tests__/m8_gate_verify.ts
 */
import request from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { patients } from '../../db/schema/patients';
import { staff, departments } from '../../db/schema/staff';
import { appointmentTokenCounters } from '../../db/schema/appointments';
import { app } from '../../app';

const RUN = crypto.randomUUID().slice(0, 8);
let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.error(`FAIL ${name}`, detail ?? '');
  }
}

async function main() {
  // ---- Fixtures -----------------------------------------------------------
  let dept = await db.query.departments.findFirst({ where: eq(departments.code, 'M8G') });
  if (!dept) {
    [dept] = await db
      .insert(departments)
      .values({ name: `M8 Gate ${RUN}`, code: 'M8G', status: 'active' })
      .returning();
  }
  const deptId = dept.id;

  async function ensureStaff(email: string, role: 'physician' | 'receptionist'): Promise<string> {
    const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
    if (existing) return existing.id;
    const [row] = await db
      .insert(staff)
      .values({
        employeeId: `EMP-M8G-${email.split('@')[0]}`,
        email,
        passwordHash: await bcrypt.hash('Gate-Passw0rd!', 10),
        firstName: 'M8G',
        lastName: role,
        role,
        departmentId: deptId,
        status: 'active',
      })
      .returning();
    return row.id;
  }

  const physicianId = await ensureStaff('m8g-physician@test.hospital', 'physician');
  const receptionistId = await ensureStaff('m8g-receptionist@test.hospital', 'receptionist');

  // ADR-012 counters persist across runs; reset for fixture doctors so the
  // strict "tokenNumber === 1" assertion holds on every gate run.
  await db
    .delete(appointmentTokenCounters)
    .where(
      sql`${appointmentTokenCounters.doctorId} IN (${physicianId}::uuid, ${receptionistId}::uuid)`,
    );

  const patient = (
    await db
      .insert(patients)
      .values({
        mrn: `MRN-M8G-${RUN.slice(0, 5)}`,
        firstName: 'Gate',
        lastName: 'Runner',
        dateOfBirth: '1992-02-02',
        gender: 'female',
        phonePrimary: `77${RUN.replace(/\D/g, '').padEnd(8, '3').slice(0, 8)}`,
        createdBy: receptionistId,
      })
      .returning()
  )[0];

  try {
    // ---- Login (real JWT pipeline) ----------------------------------------
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'm8g-receptionist@test.hospital', password: 'Gate-Passw0rd!' });
    check(
      'login receptionist → 200 + accessToken',
      loginRes.status === 200 && !!loginRes.body.data.accessToken,
      loginRes.body,
    );
    const recepToken = loginRes.body.data.accessToken;

    const physLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'm8g-physician@test.hospital', password: 'Gate-Passw0rd!' });
    const physToken = physLogin.body.data.accessToken;
    check('login physician → 200', physLogin.status === 200);

    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
    const futureDate = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);

    // ---- Auth boundary ------------------------------------------------------
    const anon = await request(app).post('/api/v1/appointments').send({});
    check('POST /appointments unauthenticated → 401', anon.status === 401);

    // ---- Booking ------------------------------------------------------------
    const bookRes = await request(app).post('/api/v1/appointments').set(auth(recepToken)).send({
      patientId: patient.id,
      doctorId: physicianId,
      departmentId: deptId,
      scheduledDate: futureDate,
      scheduledTime: '09:15',
    });
    check(
      'book appointment → 201 + tokenNumber 1',
      bookRes.status === 201 && bookRes.body.data.tokenNumber === 1,
      bookRes.body,
    );
    const apptId = bookRes.body.data?.id;

    // Double booking → 409 SLOT_UNAVAILABLE surfaced through the API envelope
    const doubleRes = await request(app).post('/api/v1/appointments').set(auth(recepToken)).send({
      patientId: patient.id,
      doctorId: physicianId,
      departmentId: deptId,
      scheduledDate: futureDate,
      scheduledTime: '09:15',
    });
    check(
      'double booking → 409 SLOT_UNAVAILABLE',
      doubleRes.status === 409 && doubleRes.body.error.code === 'SLOT_UNAVAILABLE',
      doubleRes.body,
    );

    const listRes = await request(app)
      .get('/api/v1/appointments')
      .set(auth(recepToken))
      .query({ date: futureDate });
    check(
      'GET /appointments returns enriched row',
      listRes.status === 200 && listRes.body.data.some((a: { id: string }) => a.id === apptId),
    );

    // ---- Check-in -----------------------------------------------------------
    const checkinRes = await request(app)
      .patch(`/api/v1/appointments/${apptId}/check-in`)
      .set(auth(recepToken));
    check(
      'check-in → 200, appointment checked_in, encounter registered',
      checkinRes.status === 200 &&
        checkinRes.body.data.appointment.status === 'checked_in' &&
        checkinRes.body.data.encounter.status === 'registered',
      checkinRes.body,
    );
    const encounterId = checkinRes.body.data.encounter.id;

    const recheckin = await request(app)
      .patch(`/api/v1/appointments/${apptId}/check-in`)
      .set(auth(recepToken));
    check(
      'second check-in → 409 INVALID_TRANSITION',
      recheckin.status === 409 && recheckin.body.error.code === 'INVALID_TRANSITION',
      recheckin.body,
    );

    // ---- ADR-013 PHI boundary -------------------------------------------------
    const detailRecep = await request(app)
      .get(`/api/v1/encounters/${encounterId}`)
      .set(auth(recepToken));
    check(
      'encounter detail (receptionist): metadata only, NO chiefComplaint/clinical/diagnostic keys',
      detailRecep.status === 200 &&
        !('chiefComplaint' in detailRecep.body.data) &&
        !('clinicalRecords' in detailRecep.body.data) &&
        !('diagnosticOrders' in detailRecep.body.data) &&
        detailRecep.body.data.patient.mrn === patient.mrn,
      detailRecep.body,
    );

    // ---- Activation ------------------------------------------------------------
    const wrongPhysician = await request(app)
      .patch(`/api/v1/encounters/${encounterId}/activate`)
      .set(auth(physToken))
      .send({ expectedVersion: 1 });
    // m8g physician IS the assigned doctor here → should succeed; scope failure covered by unit tests
    check(
      'activate by assigned physician → active, version 2',
      wrongPhysician.status === 200 &&
        wrongPhysician.body.data.status === 'active' &&
        wrongPhysician.body.data.version === 2,
      wrongPhysician.body,
    );

    const staleActivate = await request(app)
      .patch(`/api/v1/encounters/${encounterId}/activate`)
      .set(auth(physToken))
      .send({ expectedVersion: 1 });
    check(
      'stale-version activate → 409 VERSION_CONFLICT',
      staleActivate.status === 409 && staleActivate.body.error.code === 'VERSION_CONFLICT',
      staleActivate.body,
    );

    // ---- RBAC spot checks -------------------------------------------------------
    const pharmLogin = await db.query.staff.findFirst({ where: eq(staff.role, 'pharmacist') });
    void pharmLogin;
    const labTokenRes = await request(app)
      .patch(`/api/v1/appointments/${apptId}/cancel`)
      .set(auth(physToken));
    check(
      'physician cancel appointment → 403 (permission not granted)',
      labTokenRes.status === 403,
    );

    const adminList = await request(app).get('/api/v1/encounters').set(auth(physToken));
    check('physician GET /encounters → 200', adminList.status === 200);

    console.log(`\n=== M8 GATE: ${pass} passed, ${fail} failed ===`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    // Cleanup business rows (audit retained); keep staff/dept for reruns.
    const encRows = await db.query.encounters.findMany({
      where: eq(encounters.createdBy, receptionistId),
    });
    for (const enc of encRows) {
      await db.delete(appointments).where(eq(appointments.encounterId, enc.id));
    }
    await db.delete(appointments).where(eq(appointments.createdBy, receptionistId));
    await db.delete(encounters).where(eq(encounters.createdBy, receptionistId));
    await db.delete(patients).where(eq(patients.createdBy, receptionistId));
    void physicianId;
  }
}

// Local imports needed after fixture helpers
import { appointments, encounters } from '../../db/schema/appointments';

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error('GATE CRASHED:', err);
    process.exit(1);
  });
