import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { eq, sql } from 'drizzle-orm';

import { app } from '../../../app';
import { db } from '../../../db';
import { departments, staff } from '../../../db/schema/staff';
import { patients } from '../../../db/schema/patients';
import { encounters } from '../../../db/schema/appointments';
import { diagnosticOrders, diagnosticResults } from '../../../db/schema/diagnostics';
import { notifications } from '../../../db/schema/tasks';
import { auditEvents } from '../../../db/schema/audit';
import { resolveKeyPath } from '../../auth/auth.service';
import { config } from '../../../config';

/**
 * M12.2 — Critical notification read/workflow integration tests.
 *
 * Real PostgreSQL + real Express. Proves:
 *  - recipient scope is server-derived (cross-user isolation)
 *  - foreign notification ids are indistinguishable (404)
 *  - acknowledgement is guarded, audited atomically, PHI-free
 *  - pagination is bounded and deterministic
 *  - unauthenticated access is rejected
 */

const RUN = crypto.randomUUID().slice(0, 8);

function tokenFor(staffId: string, role: string, departmentId: string): string {
  const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
  const privateKey = fs.readFileSync(keyPath, 'utf-8');
  return jwt.sign({ sub: staffId, role, department_id: departmentId }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
}

describe('M12.2 Notification read/workflow (critical-result loop)', () => {
  let deptId = '';
  let physicianA = '';
  let physicianB = '';
  let receptionistId = '';
  let adminId = '';
  let secadminId = '';
  let patientId = '';
  let encounterId = '';
  let orderId = '';
  let resultId = '';
  let notificationA = '';
  const staffIds: string[] = [];
  const createdNotificationIds: string[] = [];

  beforeAll(async () => {
    // Idempotency sweep: remove any leftover fixtures from previously
    // interrupted runs of this suite (email/code prefixes are suite-owned).
    // Sweep pattern matches both suffixed roles.
    await db
      .execute(
        sql`DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM staff WHERE email LIKE 'm122n-%@t.hospital')`,
      )
      .catch(() => undefined);
    await db
      .execute(
        sql`DELETE FROM audit_events WHERE target_type = 'NOTIFICATION' AND actor_id IN (SELECT id FROM staff WHERE email LIKE 'm122n-%@t.hospital')`,
      )
      .catch(() => undefined);
    await db
      .execute(sql`DELETE FROM staff WHERE email LIKE 'm122n-%@t.hospital'`)
      .catch(() => undefined);
    await db
      .execute(sql`DELETE FROM patients WHERE last_name LIKE 'Probe%' AND first_name = 'Loop'`)
      .catch(() => undefined);
    await db.execute(sql`DELETE FROM departments WHERE code LIKE 'M2N%'`).catch(() => undefined);

    const [dept] = await db
      .insert(departments)
      .values({ name: `M12.2N ${RUN}`, code: `M2N${RUN.slice(0, 5)}`, status: 'active' })
      .returning();
    deptId = dept.id;

    const mkStaff = async (role: string, suffix = '') => {
      const email = `m122n-${role}${suffix}-${RUN}@t.hospital`;
      const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
      if (existing) {
        staffIds.push(existing.id);
        return existing.id;
      }
      const [s] = await db
        .insert(staff)
        .values({
          employeeId: `EMP-M122N-${role}${suffix}-${RUN}`,
          email,
          passwordHash: 'x',
          firstName: 'M122N',
          lastName: role,
          role: role as 'physician',
          departmentId: deptId,
          status: 'active',
        })
        .returning();
      staffIds.push(s.id);
      return s.id;
    };
    physicianA = await mkStaff('physician', '-a');
    physicianB = await mkStaff('physician', '-b');
    receptionistId = await mkStaff('receptionist');
    adminId = await mkStaff('hospital_admin');
    secadminId = await mkStaff('security_admin');

    const [patient] = await db
      .insert(patients)
      .values({
        mrn: `M122N-${RUN.slice(0, 10)}`,
        firstName: 'Loop',
        lastName: `Probe${RUN}`,
        dateOfBirth: '1980-01-01',
        gender: 'male',
        phonePrimary: `9${RUN.replace(/\D/g, '').padEnd(9, '4')}`.slice(0, 15),
        createdBy: receptionistId,
      })
      .returning();
    patientId = patient.id;

    const [enc] = await db
      .insert(encounters)
      .values({
        patientId,
        doctorId: physicianA,
        departmentId: deptId,
        encounterType: 'opd',
        chiefComplaint: 'Chest discomfort.',
        status: 'active',
        startedAt: new Date(),
        createdBy: physicianA,
      })
      .returning();
    encounterId = enc.id;

    const [order] = await db
      .insert(diagnosticOrders)
      .values({
        encounterId,
        patientId,
        orderingDoctorId: physicianA,
        testCode: 'K',
        testName: 'Serum Potassium',
        priority: 'stat',
        status: 'sample_collected',
      })
      .returning();
    orderId = order.id;

    const [result] = await db
      .insert(diagnosticResults)
      .values({
        orderId,
        patientId,
        testCode: 'K',
        resultValues: [{ parameterName: 'Potassium', value: 6.6, unit: 'mEq/L' }],
        referenceRange: {},
        isAbnormal: true,
        isCritical: true,
        status: 'critical_flagged',
        enteredBy: physicianB, // irrelevant for this suite; any staff id
      })
      .returning();
    resultId = result.id;

    // Mirror of the M10 outbox row (creation logic itself is NOT duplicated).
    const [notif] = await db
      .insert(notifications)
      .values({
        recipientId: physicianA,
        notificationType: 'critical_lab_alert',
        title: 'Critical lab value: Serum Potassium',
        body: 'Serum Potassium (K) flagged CRITICAL and requires immediate physician review.',
        referenceType: 'DiagnosticResult',
        referenceId: resultId,
        priority: 'critical',
        status: 'dispatched',
      })
      .returning();
    notificationA = notif.id;
    createdNotificationIds.push(notificationA);
  });

  afterAll(async () => {
    // Audit events retained (append-only). FK-safe reverse cleanup.
    for (const id of createdNotificationIds) {
      await db
        .delete(notifications)
        .where(eq(notifications.id, id))
        .catch(() => undefined);
    }
    await db
      .delete(diagnosticResults)
      .where(eq(diagnosticResults.orderId, orderId))
      .catch(() => undefined);
    await db
      .delete(diagnosticOrders)
      .where(eq(diagnosticOrders.id, orderId))
      .catch(() => undefined);
    await db
      .delete(encounters)
      .where(eq(encounters.id, encounterId))
      .catch(() => undefined);
    await db
      .delete(patients)
      .where(eq(patients.id, patientId))
      .catch(() => undefined);
    if (staffIds.length) {
      await db
        .delete(staff)
        .where(eq(staff.departmentId, deptId))
        .catch(() => undefined);
    }
    await db
      .delete(notifications)
      .where(eq(notifications.recipientId, physicianA))
      .catch(() => undefined);
    // Staff rows are RETAINED (audit_events.actor_id FK — append-only ledger),
    // so the department row is retained with them; the startup sweep handles
    // cross-run hygiene instead.
    await db
      .execute(sql`DELETE FROM departments WHERE id = ${deptId}::uuid`)
      .catch(() => undefined);
  });

  it('unauthenticated GET → 401', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  it('ordering physician sees his critical notification with server-resolved order pointer', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(res.status).toBe(200);
    const items = res.body.data as Array<Record<string, unknown>>;
    const mine = items.find((n) => n.id === notificationA);
    expect(mine).toBeDefined();
    expect(mine?.notificationType).toBe('critical_lab_alert');
    expect(mine?.priority).toBe('critical');
    expect(mine?.status).toBe('dispatched');
    expect(mine?.relatedOrderId).toBe(orderId); // navigation pointer resolved server-side

    // PHI boundary: test name allowed; identifiers/values never present.
    const json = JSON.stringify(res.body);
    expect(json).not.toContain(`Probe${RUN}`); // patient last name absent
    expect(json).not.toContain('1980-01-01'); // DOB absent
    expect(json).not.toContain('6.6'); // clinical value absent
    expect(json).toContain('Serum Potassium'); // pointer metadata allowed per ADR-016
  });

  it('another physician CANNOT see or acknowledge a foreign notification', async () => {
    const listB = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenFor(physicianB, 'physician', deptId)}`);
    expect(listB.status).toBe(200);
    const ids = (listB.body.data as Array<{ id: string }>).map((n) => n.id);
    expect(ids).not.toContain(notificationA);

    const ackB = await request(app)
      .patch(`/api/v1/notifications/${notificationA}/acknowledge`)
      .set('Authorization', `Bearer ${tokenFor(physicianB, 'physician', deptId)}`);
    expect(ackB.status).toBe(404); // indistinguishable from missing
  });

  it('arbitrary/fabricated notification id → 404 (no cross-user leak)', async () => {
    const fabricated = crypto.randomUUID();
    const res = await request(app)
      .patch(`/api/v1/notifications/${fabricated}/acknowledge`)
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(res.status).toBe(404);
  });

  it('owner acknowledgement succeeds once, is audited, then is guarded', async () => {
    const correlationId = crypto.randomUUID();
    const ack = await request(app)
      .patch(`/api/v1/notifications/${notificationA}/acknowledge`)
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`)
      .set('x-correlation-id', correlationId);
    expect(ack.status).toBe(200);
    expect(ack.body.data.status).toBe('acknowledged');
    expect(ack.body.data.acknowledgedAt).toBeTruthy();

    const evt = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.targetId, notificationA),
    });
    expect(evt?.eventType).toBe('NOTIFICATION_ACKNOWLEDGED');
    expect(evt?.actorId).toBe(physicianA);
    expect(evt?.correlationId).toBe(correlationId);
    const payloadJson = JSON.stringify(evt);
    expect(payloadJson).not.toContain('Potassium'); // no clinical values in audit
    expect(payloadJson).not.toContain('Probe');

    const again = await request(app)
      .patch(`/api/v1/notifications/${notificationA}/acknowledge`)
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('other roles receive their own (empty) scoped list without error', async () => {
    for (const [id, role] of [
      [receptionistId, 'receptionist'],
      [adminId, 'hospital_admin'],
      [secadminId, 'security_admin'],
    ] as const) {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${tokenFor(id as string, role as string, deptId)}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(
        (res.body.data as unknown[]).find((n) => (n as { id: string }).id === notificationA),
      ).toBeUndefined();
    }
  });

  it('pagination is bounded and deterministic', async () => {
    // Seed 5 extra notifications for A.
    const seeded: string[] = [];
    for (let i = 0; i < 5; i++) {
      const [row] = await db
        .insert(notifications)
        .values({
          recipientId: physicianA,
          notificationType: 'system_alert',
          title: `Probe alert ${i} ${RUN}`,
          body: 'Probe body',
          priority: 'normal',
          status: 'dispatched',
        })
        .returning();
      seeded.push(row.id);
      createdNotificationIds.push(row.id);
    }

    const page1 = await request(app)
      .get('/api/v1/notifications?page=1&pageSize=3')
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(3);
    expect(page1.body.meta).toMatchObject({ limit: 3, page: 1 });
    const times: number[] = (page1.body.data as Array<{ createdAt: string }>).map((n) =>
      Date.parse(n.createdAt),
    );
    expect([...times].sort((a, b) => b - a)).toEqual(times); // deterministic desc order

    // pageSize beyond bound → 400 via shared schema (max 100)
    const tooBig = await request(app)
      .get('/api/v1/notifications?pageSize=500')
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(tooBig.status).toBe(400);

    // status filter works
    const ackedOnly = await request(app)
      .get('/api/v1/notifications?status=acknowledged')
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    const ackedIds = (ackedOnly.body.data as Array<{ id: string }>).map((n) => n.id);
    expect(ackedIds).toContain(notificationA);
    for (const sid of seeded) expect(ackedIds).not.toContain(sid);
  });
});
