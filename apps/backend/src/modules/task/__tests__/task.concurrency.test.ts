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

describe('Phase 1B Task Management - CONCURRENCY PROOF', () => {
  let deptId = '';
  let physicianA = '';
  let labTech = '';
  let patientId = '';
  let encounterId = '';
  let orderId = '';
  let resultId = '';
  let taskId = '';
  const staffIds: string[] = [];

  beforeAll(async () => {
    const [dept] = await db
      .insert(departments)
      .values({ name: `P1B Task Conc ${RUN}`, code: `P1BC${RUN.slice(0, 4)}`, status: 'active' })
      .returning();
    deptId = dept.id;

    const mkStaff = async (role: string, suffix = '') => {
      const email = `p1btc-${role}${suffix}-${RUN}@t.hospital`;
      const [s] = await db
        .insert(staff)
        .values({
          employeeId: `EMP-P1BTC-${role}${suffix}-${RUN}`,
          email,
          passwordHash: 'x',
          firstName: 'P1BC',
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
    labTech = await mkStaff('lab_technician', '-l');

    const [patient] = await db
      .insert(patients)
      .values({
        mrn: `P1BTC-${RUN.slice(0, 9)}`,
        firstName: 'Test',
        lastName: `TaskConc${RUN}`,
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
        testCode: 'TEST_CONC',
        testName: 'Test Task Conc Lab',
        priority: 'stat',
        status: 'sample_collected',
      })
      .returning();
    orderId = order.id;

    await db
      .insert(criticalValueRules)
      .values({
        testCode: 'TEST_CONC',
        parameterName: 'Level',
        unit: 'U/L',
        normalLow: '10',
        normalHigh: '50',
        criticalLow: '5',
        criticalHigh: '100',
        isActive: true,
        updatedBy: physicianA,
      });

    const result = await diagnosticsService.enterResult(
      orderId,
      {
        resultValues: [{ parameterName: 'Level', value: 120, unit: 'U/L' }], // > 100 is critical
      },
      labTech,
      crypto.randomUUID(),
      { role: 'lab_technician', departmentId: deptId },
    );
    resultId = result.id;

    const t = await db.query.tasks.findFirst({
      where: eq(tasks.referenceId, orderId),
    });
    taskId = t!.id;
  });

  afterAll(async () => {
    if (taskId) await db.delete(tasks).where(eq(tasks.id, taskId)).catch(() => undefined);
    await db.delete(criticalValueRules).where(eq(criticalValueRules.testCode, 'TEST_CONC')).catch(() => undefined);
    if (resultId) await db.delete(diagnosticResults).where(eq(diagnosticResults.id, resultId)).catch(() => undefined);
    if (orderId) await db.delete(diagnosticOrders).where(eq(diagnosticOrders.id, orderId)).catch(() => undefined);
    if (encounterId) await db.delete(encounters).where(eq(encounters.id, encounterId)).catch(() => undefined);
    if (patientId) await db.delete(patients).where(eq(patients.id, patientId)).catch(() => undefined);
    if (staffIds.length) {
      await db.execute(sql`DELETE FROM staff WHERE id = ANY(${staffIds})`).catch(() => undefined);
    }
    await db.execute(sql`DELETE FROM departments WHERE id = ${deptId}::uuid`).catch(() => undefined);
  });

  it('handles concurrent duplicate tasks properly (same order) - DUPLICATE PROTECTION', async () => {
      const p1 = diagnosticsService.enterResult(
          orderId,
          { resultValues: [{ parameterName: 'Level', value: 150, unit: 'U/L' }] },
          labTech,
          crypto.randomUUID(),
          { role: 'lab_technician', departmentId: deptId },
      );
      const p2 = diagnosticsService.enterResult(
          orderId,
          { resultValues: [{ parameterName: 'Level', value: 150, unit: 'U/L' }] },
          labTech,
          crypto.randomUUID(),
          { role: 'lab_technician', departmentId: deptId },
      );

      const results = await Promise.allSettled([p1, p2]);
      
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      // Since one result is already created in beforeAll, BOTH should fail here with ConflictError
      expect(successes.length).toBe(0);
      expect(failures.length).toBe(2);
      expect((failures[0] as PromiseRejectedResult).reason.code).toBe('RESULT_ALREADY_EXISTS');
      expect((failures[1] as PromiseRejectedResult).reason.code).toBe('RESULT_ALREADY_EXISTS');
  });

  it('handles concurrent acknowledgement - 1 success, 1 conflict', async () => {
    const token = tokenFor(physicianA, 'physician', deptId);
    const reqA = request(app)
      .post(`/api/v1/tasks/${taskId}/acknowledge`)
      .set('Authorization', `Bearer ${token}`);
    
    const reqB = request(app)
      .post(`/api/v1/tasks/${taskId}/acknowledge`)
      .set('Authorization', `Bearer ${token}`);

    const results = await Promise.allSettled([reqA, reqB]);

    const statuses = results.map(r => r.status === 'fulfilled' ? (r.value as any).status : 500);
    
    expect(statuses).toContain(200);
    expect(statuses).toContain(409); // One succeeds, one returns conflict
  });

  it('handles concurrent completion - 1 success, 1 conflict', async () => {
    const token = tokenFor(physicianA, 'physician', deptId);
    const reqA = request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    
    const reqB = request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    const results = await Promise.allSettled([reqA, reqB]);

    const statuses = results.map(r => r.status === 'fulfilled' ? (r.value as any).status : 500);
    
    expect(statuses).toContain(200);
    expect(statuses).toContain(409); // One succeeds, one returns conflict
  });
});
