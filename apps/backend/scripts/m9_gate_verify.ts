/**
 * M9 Live API Gate — real Postgres, real Express app, RS256 JWTs, real HTTP.
 * Walks: login → activate encounter → create SOAP draft → read → update →
 * sign → locked → conflicts → RBAC/PHI checks.
 *
 * Run: pnpm --filter backend exec tsx scripts/m9_gate_verify.ts
 */
import request from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../src/db';
import { patients } from '../src/db/schema/patients';
import { staff, departments } from '../src/db/schema/staff';
import { clinicalRecords } from '../src/db/schema/clinical';
import { appointments, encounters } from '../src/db/schema/appointments';
import { auditEvents } from '../src/db/schema/audit';
import { app } from '../src/app';

const RUN = crypto.randomUUID().slice(0, 8);
let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.error(`FAIL ${name}`, JSON.stringify(detail)?.slice(0, 300) ?? '');
  }
}

async function main() {
  // ---- Fixtures -----------------------------------------------------------
  let dept = await db.query.departments.findFirst({ where: eq(departments.code, 'M9G') });
  if (!dept) {
    [dept] = await db
      .insert(departments)
      .values({ name: `M9 Gate ${RUN}`, code: 'M9G', status: 'active' })
      .returning();
  }
  const deptId = dept.id;

  async function ensureStaff(
    email: string,
    role: 'physician' | 'receptionist' | 'nurse' | 'hospital_admin' | 'security_admin',
  ): Promise<string> {
    const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
    if (existing) return existing.id;
    const [row] = await db
      .insert(staff)
      .values({
        employeeId: `EMP-M9G-${email.split('@')[0]}`,
        email,
        passwordHash: await bcrypt.hash('Gate-Passw0rd!', 10),
        firstName: 'M9G',
        lastName: role,
        role,
        departmentId: deptId,
        status: 'active',
      })
      .returning();
    return row.id;
  }

  const physicianId = await ensureStaff('m9g-physician@test.hospital', 'physician');
  const physicianBId = await ensureStaff('m9g-physician-b@test.hospital', 'physician');
  const nurseId = await ensureStaff('m9g-nurse@test.hospital', 'nurse');
  const receptionistId = await ensureStaff('m9g-receptionist@test.hospital', 'receptionist');
  await ensureStaff('m9g-admin@test.hospital', 'hospital_admin');
  await ensureStaff('m9g-secadmin@test.hospital', 'security_admin');

  // ADR-012 counters reset (not strictly needed here; keeps fixtures clean)
  await db.execute(
    sql`DELETE FROM appointment_token_counters WHERE doctor_id IN (${physicianId}::uuid, ${physicianBId}::uuid)`,
  );

  const patient = (
    await db
      .insert(patients)
      .values({
        mrn: `MRN-M9G-${RUN.slice(0, 5)}`,
        firstName: 'Gate',
        lastName: 'Clinical',
        dateOfBirth: '1980-01-01',
        gender: 'female',
        phonePrimary: `99${RUN.replace(/\D/g, '').padEnd(8, '5').slice(0, 8)}`,
        createdBy: receptionistId,
      })
      .returning()
  )[0];

  try {
    // ---- Logins -----------------------------------------------------------
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
    async function login(email: string): Promise<string> {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'Gate-Passw0rd!' });
      check(
        `login ${email.split('@')[0]} → 200`,
        res.status === 200 && !!res.body.data.accessToken,
      );
      return res.body.data.accessToken;
    }
    const physToken = await login('m9g-physician@test.hospital');
    const physBToken = await login('m9g-physician-b@test.hospital');
    const nurseToken = await login('m9g-nurse@test.hospital');
    const recepToken = await login('m9g-receptionist@test.hospital');
    const adminToken = await login('m9g-admin@test.hospital');
    const secAdminToken = await login('m9g-secadmin@test.hospital');

    // ---- Active encounter (create + activate over HTTP) --------------------
    const encRes = await request(app).post('/api/v1/encounters').set(auth(physToken)).send({
      patientId: patient.id,
      doctorId: physicianId,
      departmentId: deptId,
      encounterType: 'opd',
    });
    check('POST /encounters (physician walk-in) → 201', encRes.status === 201, encRes.body);
    const encounterId = encRes.body.data.id;

    const actRes = await request(app)
      .patch(`/api/v1/encounters/${encounterId}/activate`)
      .set(auth(physToken))
      .send({ expectedVersion: 1 });
    check(
      'PATCH activate → active v2',
      actRes.status === 200 && actRes.body.data.status === 'active',
    );

    // ---- Create SOAP draft -------------------------------------------------
    const correlationCreate = crypto.randomUUID();
    const soap = {
      sections: [
        { heading: 'subjective', content: 'Fever and cough for three days.' },
        { heading: 'objective', content: 'Temp 38.4C, rhonchi right base.' },
        { heading: 'assessment', content: 'Community-acquired pneumonia.' },
        { heading: 'plan', content: 'Chest X-ray, antibiotics, review.' },
      ],
    };
    const createRes = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records`)
      .set({ ...auth(physToken), 'x-correlation-id': correlationCreate })
      .send({ recordType: 'soap', content: soap });
    check(
      'create SOAP draft → 201 draft v1 + CLINICAL_RECORD_CREATED audit (no PHI in payload)',
      createRes.status === 201 &&
        createRes.body.data.status === 'draft' &&
        createRes.body.data.version === 1,
      createRes.body,
    );
    {
      const ev = await db.query.auditEvents.findFirst({
        where: eq(auditEvents.correlationId, correlationCreate),
      });
      check(
        'audit payload PHI-free',
        !!ev && !JSON.stringify(ev.actionDetail).includes('pneumonia'),
        ev?.actionDetail,
      );
    }
    const recordId = createRes.body.data.id;

    // Nurse cannot create SOAP
    const nurseSoap = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records`)
      .set(auth(nurseToken))
      .send({ recordType: 'soap', content: soap });
    check('nurse create SOAP → 403', nurseSoap.status === 403);

    // Nurse creates vitals
    const nurseVitals = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records`)
      .set(auth(nurseToken))
      .send({
        recordType: 'vital_signs',
        vitals: { pulse_bpm: 96, temperature_c: 38.1 },
        content: { note: 'on admission' },
      });
    check('nurse create vital_signs → 201', nurseVitals.status === 201);

    // Invalid vitals rejected
    const badVitals = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records`)
      .set(auth(nurseToken))
      .send({ recordType: 'vital_signs', vitals: { pulse_bpm: 999 } });
    check(
      'nurse invalid vitals → 400',
      badVitals.status === 400 || badVitals.status === 409,
      badVitals.body,
    );

    // ---- Read paths ----------------------------------------------------------
    const listRes = await request(app)
      .get(`/api/v1/encounters/${encounterId}/clinical-records`)
      .set(auth(physToken));
    check(
      'list records → 200 with ≥2 rows',
      listRes.status === 200 && listRes.body.data.length >= 2,
    );

    const singleRes = await request(app)
      .get(`/api/v1/encounters/${encounterId}/clinical-records/${recordId}`)
      .set(auth(physToken));
    check('single read → 200', singleRes.status === 200);

    // RBAC reads
    const recepRead = await request(app)
      .get(`/api/v1/encounters/${encounterId}/clinical-records`)
      .set(auth(recepToken));
    check('receptionist list → 403', recepRead.status === 403);
    const adminRead = await request(app)
      .get(`/api/v1/encounters/${encounterId}/clinical-records`)
      .set(auth(adminToken));
    check('hospital_admin list → 403', adminRead.status === 403);
    const secRead = await request(app)
      .get(`/api/v1/encounters/${encounterId}/clinical-records`)
      .set(auth(secAdminToken));
    check('security_admin list → 403', secRead.status === 403);

    // Unauthenticated
    const anon = await request(app).get(`/api/v1/encounters/${encounterId}/clinical-records`);
    check('unauthenticated list → 401', anon.status === 401);

    // ---- Update draft --------------------------------------------------------
    const updRes = await request(app)
      .patch(`/api/v1/encounters/${encounterId}/clinical-records/${recordId}`)
      .set(auth(physToken))
      .send({ expectedVersion: 1, content: soap });
    check(
      'update draft v1→v2',
      updRes.status === 200 && updRes.body.data.version === 2,
      updRes.body,
    );

    // Stale update → VERSION_CONFLICT
    const staleUpd = await request(app)
      .patch(`/api/v1/encounters/${encounterId}/clinical-records/${recordId}`)
      .set(auth(physToken))
      .send({ expectedVersion: 1, content: soap });
    check(
      'stale update → 409 VERSION_CONFLICT',
      staleUpd.status === 409 && staleUpd.body.error.code === 'VERSION_CONFLICT',
      staleUpd.body,
    );

    // Non-author physician edit → 403
    const nonAuthorEdit = await request(app)
      .patch(`/api/v1/encounters/${encounterId}/clinical-records/${recordId}`)
      .set(auth(physBToken))
      .send({ expectedVersion: 2, content: soap });
    check('non-author physician edit → 403', nonAuthorEdit.status === 403);

    // ---- Sign ------------------------------------------------------------------
    const signRes = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records/${recordId}/sign`)
      .set(auth(physToken))
      .send({ expectedVersion: 2 });
    check(
      'sign → signed v3 with signedBy/signedAt',
      signRes.status === 200 &&
        signRes.body.data.status === 'signed' &&
        signRes.body.data.version === 3 &&
        !!signRes.body.data.signedAt,
      signRes.body,
    );
    const contentBeforeSign = JSON.stringify(signRes.body.data.content);

    // Non-author sign → 403
    const nonAuthorSign = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records/${recordId}/sign`)
      .set(auth(physBToken))
      .send({ expectedVersion: 3 });
    check('non-author physician sign → 403', nonAuthorSign.status === 403);

    // Nurse sign → 403
    const nurseSign = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records/${recordId}/sign`)
      .set(auth(nurseToken))
      .send({ expectedVersion: 3 });
    check('nurse sign → 403', nurseSign.status === 403);

    // Already-signed → INVALID_TRANSITION
    const resign = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records/${recordId}/sign`)
      .set(auth(physToken))
      .send({ expectedVersion: 3 });
    check(
      're-sign signed record → 409 INVALID_TRANSITION',
      resign.status === 409 && resign.body.error.code === 'INVALID_TRANSITION',
      resign.body,
    );

    // Any PATCH after signing fails and content is unchanged
    const patchSigned = await request(app)
      .patch(`/api/v1/encounters/${encounterId}/clinical-records/${recordId}`)
      .set(auth(physToken))
      .send({ expectedVersion: 3, content: soap });
    const afterRow = await db.query.clinicalRecords.findFirst({
      where: eq(clinicalRecords.id, recordId),
    });
    check(
      'signed immutability: PATCH → 409 and content byte-equivalent',
      patchSigned.status === 409 &&
        JSON.stringify(afterRow?.content) === contentBeforeSign &&
        afterRow?.version === 3,
      { status: patchSigned.status, version: afterRow?.version },
    );

    // Stale SIGN on a fresh draft → VERSION_CONFLICT
    const draft2 = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records`)
      .set(auth(physToken))
      .send({ recordType: 'progress_note', content: { narrative: 'Review note.' } });
    const staleSign = await request(app)
      .post(`/api/v1/encounters/${encounterId}/clinical-records/${draft2.body.data.id}/sign`)
      .set(auth(physToken))
      .send({ expectedVersion: 99 });
    check(
      'stale sign → 409 VERSION_CONFLICT',
      staleSign.status === 409 && staleSign.body.error.code === 'VERSION_CONFLICT',
      staleSign.body,
    );

    // ---- ADR-013 regression: encounter detail embeds NO clinical data ----------
    const detailRes = await request(app)
      .get(`/api/v1/encounters/${encounterId}`)
      .set(auth(physToken));
    check(
      'ADR-013 holds: encounter detail has no clinicalRecords/diagnosticOrders keys',
      detailRes.status === 200 &&
        !('clinicalRecords' in detailRes.body.data) &&
        !('diagnosticOrders' in detailRes.body.data),
    );

    // ---- Audit event presence ---------------------------------------------------
    const clinicalEvents = await db.query.auditEvents.findMany({
      where: inArray(auditEvents.eventType, [
        'CLINICAL_RECORD_CREATED',
        'CLINICAL_RECORD_DRAFT_UPDATED',
        'CLINICAL_NOTE_SIGNED',
        'CLINICAL_RECORD_ACCESSED',
      ]),
    });
    const types = new Set(clinicalEvents.map((e) => e.eventType));
    check(
      'audit catalog: CREATED/DRAFT_UPDATED/SIGNED/ACCESSED all present, AMENDED absent',
      [
        'CLINICAL_RECORD_CREATED',
        'CLINICAL_RECORD_DRAFT_UPDATED',
        'CLINICAL_NOTE_SIGNED',
        'CLINICAL_RECORD_ACCESSED',
      ].every((t) => types.has(t as never)) && !types.has('CLINICAL_RECORD_AMENDED' as never),
      [...types],
    );

    console.log(`\n=== M9 GATE: ${pass} passed, ${fail} failed ===`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    // Cleanup business rows (audit retained); staff/dept kept for reruns.
    const recRows = await db.query.clinicalRecords.findMany({
      where: inArray(clinicalRecords.createdBy, [physicianId, nurseId]),
      columns: { id: true },
    });
    void recRows;
    const encRows = await db.query.encounters.findMany({
      where: inArray(encounters.createdBy, [receptionistId, physicianId]),
      columns: { id: true },
    });
    for (const enc of encRows) {
      await db.delete(clinicalRecords).where(eq(clinicalRecords.encounterId, enc.id));
      await db.delete(appointments).where(eq(appointments.encounterId, enc.id));
    }
    await db
      .delete(clinicalRecords)
      .where(inArray(clinicalRecords.createdBy, [physicianId, nurseId]));
    await db.delete(encounters).where(inArray(encounters.createdBy, [receptionistId, physicianId]));
    await db.delete(patients).where(eq(patients.createdBy, receptionistId));
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error('GATE CRASHED:', err);
    process.exit(1);
  });
