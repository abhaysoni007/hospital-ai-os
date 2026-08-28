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
import {
  diagnosticOrders,
  diagnosticResults,
  criticalValueRules,
} from '../../../db/schema/diagnostics';
import { tasks } from '../../../db/schema/tasks';
import { resolveKeyPath } from '../../auth/auth.service';
import { auditEvents } from '../../../db/schema/audit';
import { config } from '../../../config';
import { diagnosticsService } from '../../diagnostics/diagnostics.service';

const RUN = crypto.randomUUID().slice(0, 8);

function tokenFor(staffId: string, role: string, departmentId: string): string {
  const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
  const privateKey = fs.readFileSync(keyPath, 'utf-8');
  return jwt.sign({ sub: staffId, role, department_id: departmentId }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
}

describe('Phase 1B Task Management (Critical Result Loop)', () => {
  let deptId = '';
  let physicianA = '';
  let physicianB = '';
  let labTech = '';
  let patientId = '';
  let encounterId = '';
  let orderId = '';
  let resultId = '';
  let taskId = '';
  const staffIds: string[] = [];

  beforeAll(async () => {
    // Cleanup
    await db
      .execute(
        sql`DELETE FROM tasks WHERE assigned_to IN (SELECT id FROM staff WHERE email LIKE 'p1bt-%@t.hospital')`,
      )
      .catch(() => undefined);
    await db
      .execute(
        sql`DELETE FROM audit_events WHERE target_type = 'TASK' AND actor_id IN (SELECT id FROM staff WHERE email LIKE 'p1bt-%@t.hospital')`,
      )
      .catch(() => undefined);
    await db
      .execute(sql`DELETE FROM staff WHERE email LIKE 'p1bt-%@t.hospital'`)
      .catch(() => undefined);
    await db
      .execute(sql`DELETE FROM patients WHERE last_name LIKE 'Task%' AND first_name = 'Test'`)
      .catch(() => undefined);
    await db.execute(sql`DELETE FROM departments WHERE code LIKE 'P1B%'`).catch(() => undefined);

    const [dept] = await db
      .insert(departments)
      .values({ name: `P1B Task ${RUN}`, code: `P1B${RUN.slice(0, 5)}`, status: 'active' })
      .returning();
    deptId = dept.id;

    const mkStaff = async (role: string, suffix = '') => {
      const email = `p1bt-${role}${suffix}-${RUN}@t.hospital`;
      const [s] = await db
        .insert(staff)
        .values({
          employeeId: `EMP-P1BT-${role}${suffix}-${RUN}`,
          email,
          passwordHash: 'x',
          firstName: 'P1B',
          lastName: role,
          role: role as 'physician' | 'lab_technician',
          departmentId: deptId,
          status: 'active',
        })
        .returning();
      staffIds.push(s.id);
      return s.id;
    };
    physicianA = await mkStaff('physician', '-a');
    physicianB = await mkStaff('physician', '-b');
    labTech = await mkStaff('lab_technician', '-l');

    const [patient] = await db
      .insert(patients)
      .values({
        mrn: `P1BT-${RUN.slice(0, 10)}`,
        firstName: 'Test',
        lastName: `Task${RUN}`,
        dateOfBirth: '1980-01-01',
        gender: 'male',
        phonePrimary: `9${RUN.replace(/\D/g, '').padEnd(9, '4')}`.slice(0, 15),
        createdBy: physicianA,
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
        chiefComplaint: 'Chest pain.',
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
        testCode: 'TEST_TASK',
        testName: 'Test Task Lab',
        priority: 'stat',
        status: 'sample_collected',
      })
      .returning();
    orderId = order.id;

    // Create a critical value rule for this test
    await db.delete(criticalValueRules).where(eq(criticalValueRules.testCode, 'TEST_TASK'));

    await db
      .insert(criticalValueRules)
      .values({
        testCode: 'TEST_TASK',
        parameterName: 'Level',
        unit: 'U/L',
        normalLow: '10',
        normalHigh: '50',
        criticalLow: '5',
        criticalHigh: '100',
        isActive: true,
        updatedBy: physicianA,
      });
  });

  afterAll(async () => {
    // Cleanup
    if (taskId)
      await db
        .delete(tasks)
        .where(eq(tasks.id, taskId))
        .catch(() => undefined);
    await db
      .delete(criticalValueRules)
      .where(eq(criticalValueRules.testCode, 'TEST_TASK'))
      .catch(() => undefined);
    if (resultId)
      await db
        .delete(diagnosticResults)
        .where(eq(diagnosticResults.id, resultId))
        .catch(() => undefined);
    if (orderId)
      await db
        .delete(diagnosticOrders)
        .where(eq(diagnosticOrders.id, orderId))
        .catch(() => undefined);
    if (encounterId)
      await db
        .delete(encounters)
        .where(eq(encounters.id, encounterId))
        .catch(() => undefined);
    if (patientId)
      await db
        .delete(patients)
        .where(eq(patients.id, patientId))
        .catch(() => undefined);
    if (staffIds.length) {
      await db.execute(sql`DELETE FROM staff WHERE id = ANY(${staffIds})`).catch(() => undefined);
    }
    await db
      .execute(sql`DELETE FROM departments WHERE id = ${deptId}::uuid`)
      .catch(() => undefined);
  });

  it('entering a critical result atomically creates a task', async () => {
    const correlationId = crypto.randomUUID();
    const result = await diagnosticsService.enterResult(
      orderId,
      {
        resultValues: [{ parameterName: 'Level', value: 120, unit: 'U/L' }], // > 100 is critical
      },
      labTech,
      correlationId,
      { role: 'lab_technician', departmentId: deptId },
    );
    resultId = result.id;
    expect(result.isCritical).toBe(true);

    // Verify task was created
    const t = await db.query.tasks.findFirst({
      where: eq(tasks.referenceId, orderId),
    });
    expect(t).toBeDefined();
    expect(t?.taskType).toBe('critical_alert');
    expect(t?.status).toBe('created');
    expect(t?.assignedTo).toBe(physicianA); // Assigned to ordering doctor
    taskId = t!.id;
  });

  it('unauthenticated GET /api/v1/tasks → 401', async () => {
    const res = await request(app).get('/api/v1/tasks');
    expect(res.status).toBe(401);
  });

  it('ordering physician sees the created task', async () => {
    const res = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(res.status).toBe(200);
    const items = res.body.data as Array<Record<string, unknown>>;
    const mine = items.find((n) => n.id === taskId);
    expect(mine).toBeDefined();
    expect(mine?.taskType).toBe('critical_alert');
    expect(mine?.status).toBe('created');
    expect(mine?.priority).toBe('critical');
  });

  it('another physician CANNOT see or interact with the task', async () => {
    const listB = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${tokenFor(physicianB, 'physician', deptId)}`);
    expect(listB.status).toBe(200);
    const ids = (listB.body.data as Array<{ id: string }>).map((n) => n.id);
    expect(ids).not.toContain(taskId);

    const getB = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenFor(physicianB, 'physician', deptId)}`);
    expect(getB.status).toBe(404);

    const ackB = await request(app)
      .post(`/api/v1/tasks/${taskId}/acknowledge`)
      .set('Authorization', `Bearer ${tokenFor(physicianB, 'physician', deptId)}`);
    expect(ackB.status).toBe(404);
  });

  it('owner acknowledgement succeeds (created → in_progress), is audited', async () => {
    const correlationId = crypto.randomUUID();
    const ack = await request(app)
      .post(`/api/v1/tasks/${taskId}/acknowledge`)
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`)
      .set('x-correlation-id', correlationId);
    expect(ack.status).toBe(200);
    expect(ack.body.status).toBe('in_progress');

    const evt = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.targetId, taskId),
      orderBy: (auditEvents, { desc }) => [desc(auditEvents.createdAt)],
    });
    expect(evt?.eventType).toBe('TASK_ACKNOWLEDGED');
    expect(evt?.actorId).toBe(physicianA);
  });

  it('re-acknowledgement fails', async () => {
    const again = await request(app)
      .post(`/api/v1/tasks/${taskId}/acknowledge`)
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(again.status).toBe(409); // INVALID_TRANSITION
  });

  it('completion succeeds (in_progress → completed), is audited', async () => {
    const correlationId = crypto.randomUUID();
    const comp = await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`)
      .set('x-correlation-id', correlationId);
    expect(comp.status).toBe(200);
    expect(comp.body.status).toBe('completed');

    const evt = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.targetId, taskId),
      orderBy: (auditEvents, { desc }) => [desc(auditEvents.createdAt)],
    });
    expect(evt?.eventType).toBe('TASK_COMPLETED');
    expect(evt?.actorId).toBe(physicianA);
  });

  it('re-completion fails', async () => {
    const again = await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(again.status).toBe(409); // INVALID_TRANSITION
  });
});
