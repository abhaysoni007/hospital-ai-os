/**
 * M10 Live API Gate — real Postgres, real Express app, RS256 JWTs, real HTTP.
 * Walks the full lab workflow incl. critical path, four-eyes verification,
 * concurrency (20 parallel collects / verifies), and PHI-minimal alerts.
 *
 * Run: pnpm --filter backend exec tsx scripts/m10_gate_verify.ts
 */
import request from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../src/db';
import { patients } from '../src/db/schema/patients';
import { staff, departments } from '../src/db/schema/staff';
import {
  diagnosticOrders,
  diagnosticResults,
  criticalValueRules,
} from '../src/db/schema/diagnostics';
import { notifications } from '../src/db/schema/tasks';
import { encounters } from '../src/db/schema/appointments';
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
  let dept = await db.query.departments.findFirst({ where: eq(departments.code, 'M10G') });
  if (!dept) {
    [dept] = await db
      .insert(departments)
      .values({ name: `M10 Gate ${RUN}`, code: 'M10G', status: 'active' })
      .returning();
  }
  const deptId = dept.id;
  let deptB = await db.query.departments.findFirst({ where: eq(departments.code, 'M10H') });
  if (!deptB) {
    [deptB] = await db
      .insert(departments)
      .values({ name: `M10 Gate B ${RUN}`, code: 'M10H', status: 'active' })
      .returning();
  }

  async function ensureStaff(
    email: string,
    role: 'physician' | 'receptionist' | 'lab_technician',
    departmentId: string,
  ): Promise<string> {
    const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
    if (existing) return existing.id;
    const [row] = await db
      .insert(staff)
      .values({
        employeeId: `EMP-M10G-${email.split('@')[0]}`,
        email,
        passwordHash: await bcrypt.hash('Gate-Passw0rd!', 10),
        firstName: 'M10G',
        lastName: role,
        role,
        departmentId,
        status: 'active',
      })
      .returning();
    return row.id;
  }

  const physicianId = await ensureStaff('m10g-physician@test.hospital', 'physician', deptId);
  const physicianBId = await ensureStaff('m10g-physician-b@test.hospital', 'physician', deptId);
  const techAId = await ensureStaff('m10g-tech-a@test.hospital', 'lab_technician', deptId);
  const techA2Id = await ensureStaff('m10g-tech-a2@test.hospital', 'lab_technician', deptId);
  const techBId = await ensureStaff('m10g-tech-b@test.hospital', 'lab_technician', deptB!.id);
  const receptionistId = await ensureStaff(
    'm10g-receptionist@test.hospital',
    'receptionist',
    deptId,
  );

  const TEST_CODE = `GLU-${RUN.slice(0, 8)}`;
  await db.insert(criticalValueRules).values({
    testCode: TEST_CODE,
    parameterName: 'Glucose',
    unit: 'mg/dL',
    normalLow: '70',
    normalHigh: '140',
    criticalLow: '40',
    criticalHigh: '500',
    updatedBy: physicianId,
  });

  const patient = (
    await db
      .insert(patients)
      .values({
        mrn: `MRN-M10G-${RUN.slice(0, 5)}`,
        firstName: 'Gate',
        lastName: 'Diagnostics',
        dateOfBirth: '1972-02-02',
        gender: 'male',
        phonePrimary: `66${RUN.replace(/\D/g, '').padEnd(8, '7').slice(0, 8)}`,
        createdBy: receptionistId,
      })
      .returning()
  )[0];

  try {
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
    async function login(email: string): Promise<string> {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'Gate-Passw0rd!' });
      check(`login ${email.split('@')[0]} → 200`, res.status === 200);
      return res.body.data.accessToken;
    }
    const physToken = await login('m10g-physician@test.hospital');
    const techAToken = await login('m10g-tech-a@test.hospital');
    const techA2Token = await login('m10g-tech-a2@test.hospital');
    const techBToken = await login('m10g-tech-b@test.hospital');

    // Active encounter via HTTP
    const encRes = await request(app).post('/api/v1/encounters').set(auth(physToken)).send({
      patientId: patient.id,
      doctorId: physicianId,
      departmentId: deptId,
      encounterType: 'opd',
    });
    check('POST /encounters → 201', encRes.status === 201);
    const encounterId = encRes.body.data.id;
    await request(app)
      .patch(`/api/v1/encounters/${encounterId}/activate`)
      .set(auth(physToken))
      .send({ expectedVersion: 1 });

    // ---- Order creation -----------------------------------------------------
    const orderRes = await request(app)
      .post(`/api/v1/encounters/${encounterId}/diagnostic-orders`)
      .set(auth(physToken))
      .send({ testCode: TEST_CODE, testName: 'Glucose (venous)', priority: 'stat' });
    check(
      'create order → 201 ordered/stat',
      orderRes.status === 201 &&
        orderRes.body.data.status === 'ordered' &&
        orderRes.body.data.priority === 'stat',
      orderRes.body,
    );
    const orderId = orderRes.body.data.id;

    // Unauthenticated + wrong-role sweeps
    const anon = await request(app).get('/api/v1/diagnostic-orders');
    check('unauthenticated queue → 401', anon.status === 401);
    const recepLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'm10g-receptionist@test.hospital', password: 'Gate-Passw0rd!' });
    const recepCreate = await request(app)
      .post(`/api/v1/encounters/${encounterId}/diagnostic-orders`)
      .set(auth(recepLogin.body.data.accessToken))
      .send({ testCode: 'CBC', testName: 'CBC' });
    check('receptionist create order → 403', recepCreate.status === 403);

    // ---- Lab queue ------------------------------------------------------------
    const queue = await request(app).get('/api/v1/diagnostic-orders').set(auth(techAToken));
    check(
      'lab queue → contains order, dept-scoped',
      queue.status === 200 && queue.body.data.some((o: { id: string }) => o.id === orderId),
    );
    const queueB = await request(app).get('/api/v1/diagnostic-orders').set(auth(techBToken));
    check(
      'cross-department queue excludes order',
      queueB.status === 200 && !queueB.body.data.some((o: { id: string }) => o.id === orderId),
    );

    // ---- Collection (concurrency) ----------------------------------------------
    const collectResults = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        request(app)
          .patch(`/api/v1/diagnostic-orders/${orderId}/collect-sample`)
          .set(auth(i === 19 ? techA2Token : techAToken)),
      ),
    );
    const collectedOk = collectResults.filter((r) => r.status === 'fulfilled');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const okResponses = collectedOk.filter((r) => (r.value as any).status === 200);
    check('20 parallel collects → exactly 1 HTTP 200', okResponses.length === 1, {
      ok: okResponses.length,
    });

    // Cancel after collection impossible for ordering physician
    const lateCancel = await request(app)
      .patch(`/api/v1/diagnostic-orders/${orderId}/cancel`)
      .set(auth(physToken))
      .send({});
    check('post-collection cancel → 409 INVALID_TRANSITION', lateCancel.status === 409);

    // ---- Result entry (normal) + four-eyes verify -------------------------------
    const normalRes = await request(app)
      .post(`/api/v1/diagnostic-orders/${orderId}/result`)
      .set(auth(techAToken))
      .send({ resultValues: [{ parameterName: 'Glucose', value: 100, unit: 'mg/dL' }] });
    check(
      'normal result → preliminary, not critical',
      normalRes.status === 201 &&
        normalRes.body.data.status === 'preliminary' &&
        normalRes.body.data.isCritical === false,
      normalRes.body,
    );
    const dupRes = await request(app)
      .post(`/api/v1/diagnostic-orders/${orderId}/result`)
      .set(auth(techAToken))
      .send({ resultValues: [{ parameterName: 'Glucose', value: 110, unit: 'mg/dL' }] });
    check('duplicate result → 409 RESULT_ALREADY_EXISTS', dupRes.status === 409);

    // Self-verification forbidden
    const selfVerify = await request(app)
      .post(`/api/v1/diagnostic-orders/${orderId}/result/verify`)
      .set(auth(techAToken))
      .send({});
    check('self-verification → 403', selfVerify.status === 403);

    const verifyRes = await request(app)
      .post(`/api/v1/diagnostic-orders/${orderId}/result/verify`)
      .set(auth(techA2Token))
      .send({});
    check(
      'verification → verified; order completed',
      verifyRes.status === 200 && verifyRes.body.data.status === 'verified',
      verifyRes.body,
    );
    const completedOrder = await db.query.diagnosticOrders.findFirst({
      where: eq(diagnosticOrders.id, orderId),
    });
    check('order derived-transition to completed', completedOrder?.status === 'completed');

    // Re-verification (by the original verifier) → verified immutable → 409
    const reVerify = await request(app)
      .post(`/api/v1/diagnostic-orders/${orderId}/result/verify`)
      .set(auth(techA2Token))
      .send({});
    check('verified immutability → 409', reVerify.status === 409, {
      status: reVerify.status,
      body: reVerify.body,
    });

    // ---- CRITICAL path ----------------------------------------------------------
    const order2Res = await request(app)
      .post(`/api/v1/encounters/${encounterId}/diagnostic-orders`)
      .set(auth(physToken))
      .send({ testCode: TEST_CODE, testName: 'Glucose (venous)' });
    const orderId2 = order2Res.body.data.id;
    await request(app)
      .patch(`/api/v1/diagnostic-orders/${orderId2}/collect-sample`)
      .set(auth(techAToken));

    const critRes = await request(app)
      .post(`/api/v1/diagnostic-orders/${orderId2}/result`)
      .set(auth(techAToken))
      .send({ resultValues: [{ parameterName: 'Glucose', value: 33, unit: 'mg/dL' }] });
    check(
      'critical entry → critical_flagged, isCritical server-derived',
      critRes.status === 201 &&
        critRes.body.data.isCritical === true &&
        critRes.body.data.status === 'critical_flagged' &&
        !!critRes.body.data.criticalRuleId,
      critRes.body,
    );

    // Notification assertions (PHI-minimal)
    const note = await db.query.notifications.findFirst({
      where: eq(notifications.referenceId!, critRes.body.data.id),
    });
    check(
      'critical notification: recipient=ordering doctor, priority=critical',
      !!note && note.recipientId === physicianId && note.priority === 'critical',
      note,
    );
    const rawBody = `${note?.title} ${note?.body}`;
    check(
      'notification body PHI-minimal (test name yes; MRN/values no)',
      rawBody.includes('Glucose') &&
        !rawBody.includes(patient.id.slice(0, 8)) &&
        !rawBody.includes('33') &&
        !/MRN-/i.test(rawBody),
      rawBody,
    );

    // Verify critical result clears safety state
    const critVerify = await request(app)
      .post(`/api/v1/diagnostic-orders/${orderId2}/result/verify`)
      .set(auth(techA2Token))
      .send({});
    check('critical result verification → verified', critVerify.status === 200);

    // ---- Audit catalog ---------------------------------------------------------
    const events = await db.query.auditEvents.findMany({
      where: inArray(auditEvents.eventType, [
        'DIAGNOSTIC_ORDER_CREATED',
        'SAMPLE_COLLECTED',
        'LAB_RESULT_ENTERED',
        'LAB_RESULT_VERIFIED',
        'CRITICAL_VALUE_DETECTED',
        'CRITICAL_VALUE_NOTIFIED',
      ]),
    });
    const types = new Set(events.map((e) => e.eventType));
    check(
      'audit catalog complete (6 events), no values leaked',
      [
        'DIAGNOSTIC_ORDER_CREATED',
        'SAMPLE_COLLECTED',
        'LAB_RESULT_ENTERED',
        'LAB_RESULT_VERIFIED',
        'CRITICAL_VALUE_DETECTED',
        'CRITICAL_VALUE_NOTIFIED',
      ].every((t) => types.has(t as never)) &&
        events.every((e) => !JSON.stringify(e.actionDetail ?? {}).includes(':33')),
    );

    console.log(`\n=== M10 GATE: ${pass} passed, ${fail} failed ===`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    // Cleanup business rows (audit retained); fixtures kept for reruns.
    const orders = await db.query.diagnosticOrders.findMany({
      where: inArray(diagnosticOrders.orderingDoctorId, [physicianId]),
      columns: { id: true },
    });
    if (orders.length) {
      await db.delete(diagnosticResults).where(
        inArray(
          diagnosticResults.orderId,
          orders.map((o) => o.id),
        ),
      );
      await db.delete(diagnosticOrders).where(
        inArray(
          diagnosticOrders.id,
          orders.map((o) => o.id),
        ),
      );
    }
    await db.delete(encounters).where(inArray(encounters.createdBy, [receptionistId, physicianId]));
    await db.delete(patients).where(eq(patients.createdBy, receptionistId));
    await db.delete(criticalValueRules).where(eq(criticalValueRules.testCode, TEST_CODE));
    await db.delete(notifications).where(eq(notifications.recipientId!, physicianId));
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error('GATE CRASHED:', err);
    process.exit(1);
  });
