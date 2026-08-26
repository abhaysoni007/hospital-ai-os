import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../db';
import {
  diagnosticOrders,
  diagnosticResults,
  criticalValueRules,
} from '../../../db/schema/diagnostics';
import { notifications } from '../../../db/schema/tasks';
import { encounters } from '../../../db/schema/appointments';
import { patients } from '../../../db/schema/patients';
import { staff, departments } from '../../../db/schema/staff';
import { auditEvents } from '../../../db/schema/audit';
import type { EvaluationSnapshot } from 'shared';
import { diagnosticsService } from '../diagnostics.service';
import { encounterService } from '../../encounter/encounter.service';
import { auditService } from '../../audit/audit.service';

/**
 * M10 Diagnostics — live-DB integration tests (ADR-016).
 */

const RUN = crypto.randomUUID().slice(0, 8);

const TEST_CODE = `GLU-${RUN.slice(0, 8)}`;

const NORMAL_VALUES = [{ parameterName: 'Glucose', value: 100, unit: 'mg/dL' }];
const CRITICAL_VALUES = [{ parameterName: 'Glucose', value: 33, unit: 'mg/dL' }];

describe('M10 Diagnostics Module', () => {
  let deptAId: string;
  let deptBId: string;
  let physicianAId: string;
  let physicianBId: string;
  let techAId: string;
  let techA2Id: string;
  let techBId: string;
  let receptionistId: string;
  let patientId: string;
  const staffIds: string[] = [];
  const ctx = (role: string, deptId?: string) => ({ role, departmentId: deptId ?? deptAId });

  beforeAll(async () => {
    async function ensureDept(code: string): Promise<string> {
      const existing = await db.query.departments.findFirst({ where: eq(departments.code, code) });
      if (existing) return existing.id;
      return (
        await db
          .insert(departments)
          .values({ code, name: `M10 ${code} ${RUN}`, status: 'active' })
          .returning()
      )[0].id;
    }
    deptAId = await ensureDept(`M10A${RUN.slice(0, 4)}`);
    deptBId = await ensureDept(`M10B${RUN.slice(0, 4)}`);

    async function ensureStaff(
      email: string,
      role: 'physician' | 'receptionist' | 'lab_technician',
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
          employeeId: `EMP-M10-${email.split('@')[0]}`,
          email,
          passwordHash: 'dummy',
          firstName: 'M10',
          lastName: role,
          role,
          departmentId,
          status: 'active',
        })
        .returning();
      staffIds.push(row.id);
      return row.id;
    }

    physicianAId = await ensureStaff('m10-physician-a@test.hospital', 'physician', deptAId);
    physicianBId = await ensureStaff('m10-physician-b@test.hospital', 'physician', deptBId);
    techAId = await ensureStaff('m10-tech-a@test.hospital', 'lab_technician', deptAId);
    techA2Id = await ensureStaff('m10-tech-a2@test.hospital', 'lab_technician', deptAId);
    techBId = await ensureStaff('m10-tech-b@test.hospital', 'lab_technician', deptBId);
    receptionistId = await ensureStaff('m10-receptionist@test.hospital', 'receptionist', deptAId);

    patientId = (
      await db
        .insert(patients)
        .values({
          mrn: `MRN-M10-${RUN.slice(0, 5)}D`,
          firstName: 'Lab',
          lastName: 'Ten',
          dateOfBirth: '1965-09-09',
          gender: 'female',
          phonePrimary: `77${RUN.replace(/\D/g, '').padEnd(8, '6').slice(0, 8)}`,
          createdBy: receptionistId,
        })
        .returning()
    )[0].id;

    // Seed the active critical rule for this run's unique test code.
    await db.insert(criticalValueRules).values({
      testCode: TEST_CODE,
      parameterName: 'Glucose',
      unit: 'mg/dL',
      normalLow: '70',
      normalHigh: '140',
      criticalLow: '40',
      criticalHigh: '500',
      updatedBy: physicianAId,
    });
  });

  afterAll(async () => {
    // FK-safe cleanup: results → orders → encounters → patients. Staff retained.
    const orders = await db.query.diagnosticOrders.findMany({
      where: inArray(diagnosticOrders.orderingDoctorId, staffIds),
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
    await db.delete(encounters).where(inArray(encounters.createdBy, staffIds));
    await db.delete(patients).where(eq(patients.createdBy, receptionistId));
    await db.delete(criticalValueRules).where(eq(criticalValueRules.testCode, TEST_CODE));
  });

  async function makeActiveEncounter(physicianId: string, deptId: string) {
    const enc = await encounterService.createEncounter(
      { patientId, doctorId: physicianId, departmentId: deptId, encounterType: 'opd' },
      receptionistId,
      crypto.randomUUID(),
      ctx('receptionist', deptId),
    );
    return encounterService.activateEncounter(
      enc.id,
      1,
      physicianId,
      crypto.randomUUID(),
      ctx('physician', deptId),
    );
  }

  async function createOrder(physicianId: string, deptId: string, correlationId?: string) {
    const enc = await makeActiveEncounter(physicianId, deptId);
    return diagnosticsService.createOrder(
      enc.id,
      { testCode: TEST_CODE, testName: 'Glucose (venous)' },
      physicianId,
      correlationId ?? crypto.randomUUID(),
      ctx('physician', deptId),
    );
  }

  async function collect(orderId: string, techId: string, deptId: string, correlationId?: string) {
    return diagnosticsService.collectSample(
      orderId,
      techId,
      correlationId ?? crypto.randomUUID(),
      ctx('lab_technician', deptId),
    );
  }

  // -------------------------------------------------------------------------
  it('A. Creation: assigned physician on active encounter; server-side inheritance; audited', async () => {
    const correlationId = crypto.randomUUID();
    const order = await createOrder(physicianAId, deptAId, correlationId);

    expect(order.status).toBe('ordered');
    expect(order.patientId).toBe(patientId);
    expect(order.orderingDoctorId).toBe(physicianAId);

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(audit?.eventType).toBe('DIAGNOSTIC_ORDER_CREATED');
  });

  it('B. Creation scope: inactive encounter → ENCOUNTER_NOT_ACTIVE; non-assigned → 403', async () => {
    const registered = await encounterService.createEncounter(
      { patientId, doctorId: physicianAId, departmentId: deptAId, encounterType: 'opd' },
      receptionistId,
      crypto.randomUUID(),
      ctx('receptionist'),
    );

    await expect(
      diagnosticsService.createOrder(
        registered.id,
        { testCode: 'CBC', testName: 'CBC' },
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({ code: 'ENCOUNTER_NOT_ACTIVE' });

    const activeB = await makeActiveEncounter(physicianBId, deptBId);
    await expect(
      diagnosticsService.createOrder(
        activeB.id,
        { testCode: 'CBC', testName: 'CBC' },
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
  });

  it('C. Collection: provenance set once; 20 parallel collects → 1 success; cross-dept denied', async () => {
    const order = await createOrder(physicianAId, deptAId);
    const correlationId = crypto.randomUUID();

    const single = await collect(order.id, techAId, deptAId, correlationId);
    expect(single.status).toBe('sample_collected');
    expect(single.collectedAt).not.toBeNull();
    expect(single.collectedBy).toBe(techAId);

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(audit?.eventType).toBe('SAMPLE_COLLECTED');

    const order2 = await createOrder(physicianAId, deptAId);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => collect(order2.id, techAId, deptAId)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const f of results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]) {
      expect((f.reason as { code?: string }).code).toBe('INVALID_TRANSITION');
    }

    const order3 = await createOrder(physicianAId, deptAId);
    await expect(collect(order3.id, techBId, deptBId)).rejects.toMatchObject({
      code: 'AUTHORIZATION_ERROR',
    });
  });

  it('D. Cancellation: ordering physician own+ordered OK; else-order → 403; post-collection → 409; race deterministic', async () => {
    const own = await createOrder(physicianAId, deptAId);
    const cancelled = await diagnosticsService.cancelOrder(
      own.id,
      { reason: 'Duplicate order' },
      physicianAId,
      crypto.randomUUID(),
      ctx('physician'),
    );
    expect(cancelled.status).toBe('cancelled');

    const other = await createOrder(physicianBId, deptBId);
    await expect(
      diagnosticsService.cancelOrder(
        other.id,
        {},
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    const collected = await createOrder(physicianAId, deptAId);
    await collect(collected.id, techAId, deptAId);
    await expect(
      diagnosticsService.cancelOrder(
        collected.id,
        {},
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    const race = await createOrder(physicianAId, deptAId);
    const [collectRes, cancelRes] = await Promise.allSettled([
      collect(race.id, techAId, deptAId),
      diagnosticsService.cancelOrder(
        race.id,
        {},
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ]);
    const finalRow = await db.query.diagnosticOrders.findFirst({
      where: eq(diagnosticOrders.id, race.id),
    });
    const oneWon =
      (collectRes.status === 'fulfilled' && cancelRes.status === 'rejected') ||
      (cancelRes.status === 'fulfilled' && collectRes.status === 'rejected');
    expect(oneWon).toBe(true);
    expect(['sample_collected', 'cancelled']).toContain(finalRow?.status);
  });

  it('E. Lab queue: no cross-department leak', async () => {
    const queueA = await diagnosticsService.listLabQueue(
      { page: 1, pageSize: 100 },
      ctx('lab_technician'),
    );
    expect(queueA.data.some((o) => o.orderingDoctorId === physicianBId)).toBe(false);
  });

  it('F. Result entry: preliminary on normal; duplicate → RESULT_ALREADY_EXISTS; pre-collection → INVALID_TRANSITION; cross-dept → 403', async () => {
    const order = await createOrder(physicianAId, deptAId);

    await expect(
      diagnosticsService.enterResult(
        order.id,
        { resultValues: NORMAL_VALUES },
        techAId,
        crypto.randomUUID(),
        ctx('lab_technician'),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    await collect(order.id, techAId, deptAId);

    const entered = await diagnosticsService.enterResult(
      order.id,
      { resultValues: NORMAL_VALUES },
      techAId,
      crypto.randomUUID(),
      ctx('lab_technician'),
    );
    expect(entered.status).toBe('preliminary');
    expect(entered.isCritical).toBe(false);
    expect((entered.referenceRange as EvaluationSnapshot | null)?.parameters[0].verdict).toBe(
      'normal',
    );

    await expect(
      diagnosticsService.enterResult(
        order.id,
        { resultValues: NORMAL_VALUES },
        techAId,
        crypto.randomUUID(),
        ctx('lab_technician'),
      ),
    ).rejects.toMatchObject({ code: 'RESULT_ALREADY_EXISTS' });

    const order2 = await createOrder(physicianAId, deptAId);
    await collect(order2.id, techAId, deptAId);
    await expect(
      diagnosticsService.enterResult(
        order2.id,
        { resultValues: NORMAL_VALUES },
        techBId,
        crypto.randomUUID(),
        ctx('lab_technician', deptBId),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
  });

  it('G. CRITICAL path: flagged + notification PHI-free + full atomic event set', async () => {
    const correlationId = crypto.randomUUID();
    const order = await createOrder(physicianAId, deptAId);
    await collect(order.id, techAId, deptAId);

    const result = await diagnosticsService.enterResult(
      order.id,
      { resultValues: CRITICAL_VALUES },
      techAId,
      correlationId,
      ctx('lab_technician'),
    );

    expect(result.isCritical).toBe(true);
    expect(result.status).toBe('critical_flagged');
    expect(result.referenceRange && 'parameters' in result.referenceRange).toBeTruthy();

    const events = await db.query.auditEvents.findMany({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(events.map((e) => e.eventType).sort()).toEqual([
      'CRITICAL_VALUE_DETECTED',
      'CRITICAL_VALUE_NOTIFIED',
      'LAB_RESULT_ENTERED',
    ]);

    const target = await db.query.notifications.findFirst({
      where: eq(notifications.referenceId!, result.id),
    });
    expect(target).toBeDefined();
    expect(target?.recipientId).toBe(physicianAId);
    expect(target?.priority).toBe('critical');
    const rawBody = `${target?.title} ${target?.body}`;
    expect(rawBody).toContain('Glucose');
    expect(rawBody).not.toContain(patientId.slice(0, 8));
    expect(rawBody).not.toContain('33');
    expect(rawBody).not.toMatch(/MRN-/i);

    for (const ev of events) {
      const raw = JSON.stringify(ev.actionDetail ?? {});
      expect(raw).not.toContain('"value"');
      expect(raw).not.toContain(': 33');
    }
  });

  it('H. Entry-audit failure rolls back result + audits + notification entirely; retry succeeds', async () => {
    const order = await createOrder(physicianAId, deptAId);
    await collect(order.id, techAId, deptAId);
    const correlationId = crypto.randomUUID();

    // Baseline notification count for the ordering physician.
    const beforeNotes = await db.query.notifications.findMany({
      where: eq(notifications.recipientId, physicianAId),
    });

    const spy = vi.spyOn(auditService, 'logEvent').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any, c: string, tx?: any) => {
        if (payload.eventType === 'LAB_RESULT_ENTERED') {
          throw new Error('INTENTIONAL_ENTRY_AUDIT_FAILURE');
        }
        // Delegate non-target events to the real implementation.
        return import('../../audit/audit.service').then((m) =>
          Object.getPrototypeOf(m.auditService).logEvent.call(m.auditService, payload, c, tx),
        );
      },
    );

    let threw = false;
    try {
      await diagnosticsService.enterResult(
        order.id,
        { resultValues: CRITICAL_VALUES },
        techAId,
        correlationId,
        ctx('lab_technician'),
      );
    } catch (e) {
      threw = true;
      expect(String(e)).toContain('INTENTIONAL_ENTRY_AUDIT_FAILURE');
    }
    spy.mockRestore();
    expect(threw).toBe(true);

    expect(
      await db.query.diagnosticResults.findFirst({
        where: eq(diagnosticResults.orderId, order.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.auditEvents.findMany({ where: eq(auditEvents.correlationId, correlationId) }),
    ).toHaveLength(0);

    // Notification count unchanged ⇒ the in-tx alert write rolled back too.
    const afterNotes = await db.query.notifications.findMany({
      where: eq(notifications.recipientId, physicianAId),
    });
    expect(afterNotes).toHaveLength(beforeNotes.length);

    // Retry succeeds cleanly afterwards.
    const retry = await diagnosticsService.enterResult(
      order.id,
      { resultValues: CRITICAL_VALUES },
      techAId,
      crypto.randomUUID(),
      ctx('lab_technician'),
    );
    expect(retry.isCritical).toBe(true);
  });

  it('I. Verification: four-eyes → 403; 20 parallel verifies → 1; verified immutable; order completed', async () => {
    const order = await createOrder(physicianAId, deptAId);
    await collect(order.id, techAId, deptAId);
    await diagnosticsService.enterResult(
      order.id,
      { resultValues: NORMAL_VALUES },
      techAId,
      crypto.randomUUID(),
      ctx('lab_technician'),
    );

    await expect(
      diagnosticsService.verifyResult(
        order.id,
        techAId,
        crypto.randomUUID(),
        ctx('lab_technician'),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        diagnosticsService.verifyResult(
          order.id,
          techA2Id,
          crypto.randomUUID(),
          ctx('lab_technician'),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const finalResult = await db.query.diagnosticResults.findFirst({
      where: eq(diagnosticResults.orderId, order.id),
    });
    expect(finalResult?.status).toBe('verified');
    expect(finalResult?.verifiedBy).toBe(techA2Id);

    const finalOrder = await db.query.diagnosticOrders.findFirst({
      where: eq(diagnosticOrders.id, order.id),
    });
    expect(finalOrder?.status).toBe('completed');

    const correlationId = crypto.randomUUID();
    await expect(
      diagnosticsService.verifyResult(order.id, techA2Id, correlationId, ctx('lab_technician')),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(
      await db.query.auditEvents.findMany({ where: eq(auditEvents.correlationId, correlationId) }),
    ).toHaveLength(0);
  });

  it('J. Reads enforce department parity', async () => {
    const order = await createOrder(physicianAId, deptAId);
    await collect(order.id, techAId, deptAId);
    await diagnosticsService.enterResult(
      order.id,
      { resultValues: NORMAL_VALUES },
      techAId,
      crypto.randomUUID(),
      ctx('lab_technician'),
    );

    await expect(
      diagnosticsService.getOrder(order.id, techBId, ctx('lab_technician', deptBId)),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
    await expect(
      diagnosticsService.getResult(order.id, techBId, ctx('lab_technician', deptBId)),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    const res = await diagnosticsService.getResult(order.id, techA2Id, ctx('lab_technician'));
    expect(res.orderId).toBe(order.id);
  });

  it('K. Lab queue strictly scopes to technician department (ADR-016 Decision 5)', async () => {
    const order = await createOrder(physicianAId, deptAId);

    // Technician in Department A sees the order
    const queueA = await diagnosticsService.listLabQueue(
      { page: 1, pageSize: 50 },
      ctx('lab_technician', deptAId),
    );
    expect(queueA.data.some((o) => o.id === order.id)).toBe(true);

    // Technician in Department B does NOT see Department A order
    const queueB = await diagnosticsService.listLabQueue(
      { page: 1, pageSize: 50 },
      ctx('lab_technician', deptBId),
    );
    expect(queueB.data.some((o) => o.id === order.id)).toBe(false);
  });
});
