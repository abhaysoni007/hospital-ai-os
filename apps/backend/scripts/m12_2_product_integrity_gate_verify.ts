/**
 * M12.2 Product Integrity Gate — walks the REAL critical-result operational
 * loop end-to-end over live Express + PostgreSQL:
 *
 *   order -> collect -> CRITICAL result -> notification persisted
 *   -> ordering physician retrieves it (server-derived scope)
 *   -> unauthorized actors denied
 *   -> physician opens the actual result (evaluation snapshot intact)
 *   -> governed AI note-draft path reachable
 *   -> acknowledgement audited; hash chain continuous
 *   -> no forbidden PHI in any notification payload
 *   -> staff identity projection works
 *   -> dashboard endpoints respond correctly per permission
 *
 * Run: pnpm --filter backend exec tsx scripts/m12_2_product_integrity_gate_verify.ts
 */
import './m12-gate-env';
import request from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { app } from '../src/app';
import { db } from '../src/db';
import { patients } from '../src/db/schema/patients';
import { staff, departments } from '../src/db/schema/staff';
import { appointments, encounters } from '../src/db/schema/appointments';
import { diagnosticOrders, criticalValueRules } from '../src/db/schema/diagnostics';
import { notifications } from '../src/db/schema/tasks';
import { auditEvents } from '../src/db/schema/audit';

let pass = 0;
let fail = 0;
const check = (n: string, ok: boolean, d?: unknown) => {
  if (ok) {
    pass++;
    console.log(`PASS ${n}`);
  } else {
    fail++;
    console.error(`FAIL ${n}`, JSON.stringify(d)?.slice(0, 300) ?? '');
  }
};

const RUN = crypto.randomUUID().slice(0, 8);
const ids = {
  patientIds: [] as string[],
  appointmentIds: [] as string[],
  encounterIds: [] as string[],
  orderIds: [] as string[],
  resultIds: [] as string[],
  notificationIds: [] as string[],
};
const staffIds: string[] = [];
let departmentId = '';

async function main() {
  // ---- SEED ---------------------------------------------------------------
  const [dept] = await db
    .insert(departments)
    .values({ name: `M122G ${RUN}`, code: `M22${RUN.slice(0, 5)}`, status: 'active' })
    .returning();
  departmentId = dept.id;

  const mkStaff = async (
    email: string,
    role: 'physician' | 'nurse' | 'receptionist' | 'lab_technician',
  ) => {
    const password = 'Gate-Passw0rd!';
    const [s] = await db
      .insert(staff)
      .values({
        employeeId: `EMP-M122G-${email.split('@')[0]}-${RUN}`,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'M122G',
        lastName: role,
        role,
        departmentId: dept.id,
        status: 'active',
      })
      .returning();
    staffIds.push(s.id);
    return { id: s.id, email, password };
  };

  const physicianA = await mkStaff(`m122g-pa-${RUN}@t.hospital`, 'physician');
  const physicianB = await mkStaff(`m122g-pb-${RUN}@t.hospital`, 'physician');
  const receptionist = await mkStaff(`m122g-r-${RUN}@t.hospital`, 'receptionist');
  const labtech = await mkStaff(`m122g-l1-${RUN}@t.hospital`, 'lab_technician');

  const login = async (s: { email: string; password: string }) => {
    const r = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: s.email, password: s.password });
    return r.body.data.accessToken as string;
  };
  const tokenA = await login(physicianA);
  const tokenB = await login(physicianB);
  const tokenR = await login(receptionist);
  const tokenL = await login(labtech);

  // ---- 1-2. Active encounter via real booking flow --------------------------
  const [patient] = await db
    .insert(patients)
    .values({
      mrn: `M122G-${RUN.slice(0, 10)}`,
      firstName: 'Critical',
      lastName: `Loop${RUN}`,
      dateOfBirth: '1975-07-07',
      gender: 'female',
      phonePrimary: `97${RUN.replace(/\D/g, '').padEnd(8, '6').slice(0, 8)}`,
      createdBy: receptionist.id,
    })
    .returning();
  ids.patientIds.push(patient.id);

  const bookDate = new Date().toISOString().slice(0, 10);
  const book = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${tokenR}`)
    .send({
      patientId: patient.id,
      doctorId: physicianA.id,
      departmentId,
      scheduledDate: bookDate,
      scheduledTime: '14:20',
    });
  check('booking created', book.status === 201, book.body);
  ids.appointmentIds.push(book.body.data.id);

  const checkin = await request(app)
    .patch(`/api/v1/appointments/${book.body.data.id}/check-in`)
    .set('Authorization', `Bearer ${tokenR}`);
  check('check-in creates encounter', checkin.status === 200, checkin.body);
  const encounterId = checkin.body.data.encounter.id as string;
  ids.encounterIds.push(encounterId);
  await db
    .update(encounters)
    .set({ chiefComplaint: 'Severe palpitations.' })
    .where(eq(encounters.id, encounterId));

  const encRow = await db.query.encounters.findFirst({ where: eq(encounters.id, encounterId) });
  const act = await request(app)
    .patch(`/api/v1/encounters/${encounterId}/activate`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ expectedVersion: encRow!.version });
  check('encounter activated', act.status === 200, act.body);

  // ---- 3-4. Order -> collect -> CRITICAL result ------------------------------
  // Deterministic evaluator (ADR-010) needs an ACTIVE rule for this test code.
  const TEST_CODE = `K-${RUN.slice(0, 8)}`;
  await db.insert(criticalValueRules).values({
    testCode: TEST_CODE,
    parameterName: 'Potassium',
    unit: 'mEq/L',
    normalLow: '3.5',
    normalHigh: '5.1',
    criticalLow: '2.5',
    criticalHigh: '6.5',
    updatedBy: physicianA.id,
  });

  const order = await request(app)
    .post(`/api/v1/encounters/${encounterId}/diagnostic-orders`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ testCode: TEST_CODE, testName: 'Serum Potassium', priority: 'stat' });
  check('stat order created', order.status === 201, order.body);
  const orderId = order.body.data.id as string;
  ids.orderIds.push(orderId);

  const collect = await request(app)
    .patch(`/api/v1/diagnostic-orders/${orderId}/collect-sample`)
    .set('Authorization', `Bearer ${tokenL}`);
  check('sample collected', collect.status === 200, collect.body);

  // Critical value determined by the deterministic evaluator (ADR-010 battery).
  const enter = await request(app)
    .post(`/api/v1/diagnostic-orders/${orderId}/result`)
    .set('Authorization', `Bearer ${tokenL}`)
    .send({ resultValues: [{ parameterName: 'Potassium', value: 6.9, unit: 'mEq/L' }] });
  check(
    'result entered and DETERMINISTICALLY classified critical',
    enter.status === 201 && enter.body.data.isCritical === true,
    enter.body,
  );
  const resultId = enter.body.data.id as string;
  ids.resultIds.push(resultId);
  check(
    'evaluation snapshot persisted with critical verdict',
    enter.body.data.referenceRange?.parameters?.some(
      (p: { verdict?: string }) => p.verdict === 'critical',
    ) === true,
    enter.body.data.referenceRange,
  );

  // ---- 5. Notification persisted by the EXISTING M10 outbox ------------------
  const notifRow = await db.query.notifications.findFirst({
    where: eq(notifications.referenceId, resultId),
  });
  check(
    'critical notification persisted to ORDERING physician',
    !!notifRow && notifRow.recipientId === physicianA.id && notifRow.priority === 'critical',
    notifRow?.recipientId,
  );
  if (notifRow) ids.notificationIds.push(notifRow.id);

  // ---- 6. Physician retrieves his notification -------------------------------
  const listA = await request(app)
    .get('/api/v1/notifications')
    .set('Authorization', `Bearer ${tokenA}`);
  check('physician GET /notifications → 200', listA.status === 200, listA.body);
  const mine = (listA.body.data as Array<Record<string, unknown>>).find(
    (n) => n.relatedOrderId === orderId,
  );
  check(
    'notification visible with server-resolved relatedOrderId',
    !!mine && mine.referenceId === resultId && mine.notificationType === 'critical_lab_alert',
    mine,
  );
  const notifJson = JSON.stringify(listA.body);
  check(
    'notification payload carries NO forbidden PHI (name/MRN/DOB/values)',
    !notifJson.includes(`Loop${RUN}`) &&
      !notifJson.includes(patient.mrn) &&
      !notifJson.includes('1975-07-07') &&
      !notifJson.includes('6.9'),
  );

  // ---- 7. Unauthorized actors denied ----------------------------------------
  const listB = await request(app)
    .get('/api/v1/notifications')
    .set('Authorization', `Bearer ${tokenB}`);
  const bIds = (listB.body.data as Array<{ id: string }>).map((n) => n.id);
  check('foreign physician cannot see the notification (scope)', !bIds.includes(notifRow!.id));
  const ackB = await request(app)
    .patch(`/api/v1/notifications/${notifRow!.id}/acknowledge`)
    .set('Authorization', `Bearer ${tokenB}`);
  check('foreign acknowledgement → 404 (indistinguishable)', ackB.status === 404, ackB.body);
  const anon = await request(app).get('/api/v1/notifications');
  check('unauthenticated /notifications → 401', anon.status === 401);

  // ---- 8. Physician opens the ACTUAL diagnostic result -----------------------
  const openResult = await request(app)
    .get(`/api/v1/diagnostic-orders/${orderId}/result`)
    .set('Authorization', `Bearer ${tokenA}`);
  check(
    'ordering physician opens real result (isCritical + snapshot)',
    openResult.status === 200 &&
      openResult.body.data.isCritical === true &&
      openResult.body.data.referenceRange?.parameters?.length > 0,
    openResult.body,
  );

  // ---- 9. Governed AI note-draft path remains reachable ----------------------
  const draft = await request(app)
    .post('/api/v1/ai/note-draft')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ encounterId, recordType: 'soap' });
  check(
    'AI note-draft path parses and stays governed (200 or safe 409)',
    [200, 409].includes(draft.status),
    draft.body,
  );

  // ---- 10. Acknowledgement audited atomically --------------------------------
  const ackCorrelation = crypto.randomUUID();
  const ack = await request(app)
    .patch(`/api/v1/notifications/${notifRow!.id}/acknowledge`)
    .set('Authorization', `Bearer ${tokenA}`)
    .set('x-correlation-id', ackCorrelation);
  check(
    'owner acknowledges notification → acknowledged',
    ack.status === 200 && ack.body.data.status === 'acknowledged',
    ack.body,
  );

  const ackEvt = await db.query.auditEvents.findFirst({
    where: sql`target_id = ${notifRow!.id}::uuid AND event_type = 'NOTIFICATION_ACKNOWLEDGED'`,
  });
  check(
    'NOTIFICATION_ACKNOWLEDGED audit event is actor-attributed + correlation-bound',
    !!ackEvt && ackEvt.actorId === physicianA.id && ackEvt.correlationId === ackCorrelation,
  );

  const again = await request(app)
    .patch(`/api/v1/notifications/${notifRow!.id}/acknowledge`)
    .set('Authorization', `Bearer ${tokenA}`);
  check('double acknowledgement → 409 INVALID_TRANSITION', again.status === 409);

  // ---- 11. Hash chain continuity across the whole run ------------------------
  const lastTwo = await db.query.auditEvents.findMany({
    orderBy: [sql`sequence_number DESC`],
    limit: 2,
  });
  check(
    'audit hash chain continuous after loop completion',
    lastTwo.length === 2 ? lastTwo[1].recordHash === lastTwo[0].previousHash : false,
  );

  // ---- 12. Staff identity projection -----------------------------------------
  const ident = await request(app)
    .get(`/api/v1/staff/identity?ids=${labtech.id},${physicianA.id}`)
    .set('Authorization', `Bearer ${tokenA}`);
  const identItems = ident.body.data as Array<Record<string, unknown>>;
  check(
    'staff identity projection returns displayName+role only',
    ident.status === 200 &&
      identItems.length === 2 &&
      Object.keys(identItems[0]).sort().join() === 'displayName,id,role',
    identItems,
  );

  // ---- 13. Dashboard data endpoints behave per permission --------------------
  const apptsToday = await request(app)
    .get(`/api/v1/appointments?date=${bookDate}&pageSize=50`)
    .set('Authorization', `Bearer ${tokenR}`);
  check(
    "receptionist dashboard source: today's appointments (department-scoped)",
    apptsToday.status === 200 &&
      (apptsToday.body.data as unknown[]).some(
        (a) => (a as { id: string }).id === book.body.data.id,
      ),
    apptsToday.body.meta,
  );

  const activeEnc = await request(app)
    .get('/api/v1/encounters?status=active&pageSize=10')
    .set('Authorization', `Bearer ${tokenA}`);
  check(
    'physician dashboard source: active encounters include this one',
    activeEnc.status === 200 &&
      (activeEnc.body.data.data ?? activeEnc.body.data).some?.(
        (e: { id: string }) => e.id === encounterId,
      ) === true,
    activeEnc.body,
  );

  const queueOrdered = await request(app)
    .get('/api/v1/diagnostic-orders?status=ordered&pageSize=1')
    .set('Authorization', `Bearer ${tokenL}`);
  const queueCollected = await request(app)
    .get('/api/v1/diagnostic-orders?status=sample_collected&pageSize=1')
    .set('Authorization', `Bearer ${tokenL}`);
  check(
    'lab pending-work counters bounded and queryable (meta.total)',
    queueOrdered.status === 200 &&
      queueCollected.status === 200 &&
      typeof queueOrdered.body.meta.total === 'number' &&
      typeof queueCollected.body.meta.total === 'number',
  );

  // ---- CLEANUP ---------------------------------------------------------------
  for (const id of ids.notificationIds) {
    await db.execute(sql`DELETE FROM notifications WHERE id = ${id}::uuid`).catch(() => undefined);
  }
  for (const id of ids.orderIds) {
    await db
      .execute(sql`DELETE FROM diagnostic_results WHERE order_id = ${id}::uuid`)
      .catch(() => undefined);
    await db
      .execute(sql`DELETE FROM diagnostic_orders WHERE id = ${id}::uuid`)
      .catch(() => undefined);
  }
  for (const id of ids.appointmentIds) {
    await db.execute(sql`DELETE FROM appointments WHERE id = ${id}::uuid`).catch(() => undefined);
  }
  for (const id of ids.encounterIds) {
    await db.execute(sql`DELETE FROM encounters WHERE id = ${id}::uuid`).catch(() => undefined);
  }
  for (const id of ids.patientIds) {
    await db.execute(sql`DELETE FROM patients WHERE id = ${id}::uuid`).catch(() => undefined);
  }
  await db
    .delete(criticalValueRules)
    .where(eq(criticalValueRules.testCode, TEST_CODE))
    .catch(() => undefined);

  console.log(`\nM12.2 gate: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('M12.2 gate crashed:', err);
  process.exit(1);
});
