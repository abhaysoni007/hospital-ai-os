import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../../../db';
import { patients } from '../../../db/schema/patients';
import { auditEvents } from '../../../db/schema/audit';
import { staff, departments } from '../../../db/schema/staff';
import { patientService } from '../patient.service';
import { auditService } from '../../../modules/audit/audit.service';
import { eq, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

const MRN_SEQ_NAME = `patient_mrn_seq_${new Date().getUTCFullYear()}`;

async function getSequenceLastValue(): Promise<number> {
  const result = await db.execute(sql.raw(`SELECT last_value FROM ${MRN_SEQ_NAME}`));
  return Number((result as unknown as Array<{ last_value: string }>)[0].last_value);
}

describe('Patient Registration MRN & Concurrency (ADR-011)', () => {
  let testStaffId: string;
  let testDeptId: string;

  beforeAll(async () => {
    // We assume seed has run and there is at least one staff member
    let deptRow = await db.query.departments.findFirst();
    if (!deptRow) {
      const [inserted] = await db
        .insert(departments)
        .values({
          name: 'Test Department',
          code: 'TEST',
          status: 'active',
        })
        .returning();
      deptRow = inserted;
    }
    testDeptId = deptRow.id;

    let staffRow = await db.query.staff.findFirst({ where: eq(staff.departmentId, testDeptId) });
    if (!staffRow) {
      const [inserted] = await db
        .insert(staff)
        .values({
          employeeId: 'TEST-MRN-001',
          email: 'mrn.test@test.hospital',
          passwordHash: 'dummy',
          firstName: 'MRN',
          lastName: 'Tester',
          role: 'receptionist',
          departmentId: testDeptId,
          status: 'active',
        })
        .returning();
      staffRow = inserted;
    }
    testStaffId = staffRow.id;
  });

  afterAll(async () => {
    // Cleanup patients created during this test.
    // NOTE: audit_events is append-only by design (ADR/M7) — its rows are retained.
    await db.delete(patients).where(eq(patients.createdBy, testStaffId));
  });

  const generateMockPatient = (suffix: string) => ({
    firstName: `John${suffix}`,
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'male' as const,
    phonePrimary: `555100${suffix.padStart(4, '0')}`,
  });

  it('A. Basic MRN: produces valid MRN-YYYY-NNNNN', async () => {
    const correlationId = crypto.randomUUID();
    const result = await patientService.registerPatient(
      generateMockPatient('Basic'),
      testStaffId,
      correlationId,
      { role: 'receptionist', departmentId: testDeptId },
    );

    expect(result.mrn).toMatch(/^MRN-\d{4}-\d{5,}$/);
    const year = new Date().getUTCFullYear().toString();
    expect(result.mrn).toContain(year);
  });

  it('B & C. Concurrent registration: unique MRNs, no race conditions', async () => {
    const correlationId = crypto.randomUUID();
    const count = 20;

    // Fire 20 concurrent registrations
    const promises = Array.from({ length: count }, (_, i) =>
      patientService.registerPatient(generateMockPatient(`Conc${i}`), testStaffId, correlationId, {
        role: 'receptionist',
        departmentId: testDeptId,
      }),
    );

    const results = await Promise.all(promises);

    // Check they all succeeded
    expect(results.length).toBe(count);

    // Check all MRNs are unique and well-formed
    const mrns = results.map((r) => r.mrn);
    const uniqueMrns = new Set(mrns);
    expect(uniqueMrns.size).toBe(count);
    const year = new Date().getUTCFullYear().toString();
    for (const mrn of mrns) {
      expect(mrn).toMatch(new RegExp(`^MRN-${year}-\\d{5,}$`));
    }
  });

  it('D. Rollback: consumes sequence value but discards patient and audit', async () => {
    const correlationId = crypto.randomUUID();
    const seqBefore = await getSequenceLastValue();

    // Force a failure AFTER sequence allocation: the audit write inside the
    // registration transaction rejects. Per ADR-011 this must roll back the
    // patient row AND the audit row while permanently consuming the sequence value.
    const auditSpy = vi
      .spyOn(auditService, 'logEvent')
      .mockRejectedValueOnce(new Error('INTENTIONAL_AUDIT_FAILURE'));

    let errorThrown = false;
    try {
      await patientService.registerPatient(
        generateMockPatient('Rollback'),
        testStaffId,
        correlationId,
        { role: 'receptionist', departmentId: testDeptId },
      );
    } catch (e) {
      errorThrown = true;
      expect(String(e)).toContain('INTENTIONAL_AUDIT_FAILURE');
    }
    auditSpy.mockRestore();
    expect(errorThrown).toBe(true);

    // Patient row must NOT persist
    const orphanPatients = await db.query.patients.findMany({
      where: eq(patients.phonePrimary, generateMockPatient('Rollback').phonePrimary),
    });
    expect(orphanPatients).toHaveLength(0);

    // Audit row must NOT persist
    const orphanAudits = await db.query.auditEvents.findMany({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(orphanAudits).toHaveLength(0);

    // Sequence number is consumed (gap): last_value advanced by exactly 1
    const seqAfterFailure = await getSequenceLastValue();
    expect(seqAfterFailure).toBe(seqBefore + 1);

    // Next successful registration receives a LATER sequence value (gap not reused)
    const nextResult = await patientService.registerPatient(
      generateMockPatient('AfterGap'),
      testStaffId,
      crypto.randomUUID(),
      { role: 'receptionist', departmentId: testDeptId },
    );
    const nextSeq = Number(nextResult.mrn.split('-')[2]);
    expect(nextSeq).toBeGreaterThan(seqAfterFailure);
  });

  it('D2. Atomicity: patient + audit commit together on success', async () => {
    const correlationId = crypto.randomUUID();
    const result = await patientService.registerPatient(
      generateMockPatient('Atomic'),
      testStaffId,
      correlationId,
      { role: 'receptionist', departmentId: testDeptId },
    );

    const patientRow = await db.query.patients.findFirst({
      where: eq(patients.id, result.id),
    });
    expect(patientRow).toBeDefined();

    const auditRow = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(auditRow).toBeDefined();
    expect(auditRow?.eventType).toBe('PATIENT_REGISTERED');
    expect(auditRow?.targetId).toBe(result.id);
  });

  it('E. Audit: Successful registration produces required audit event', async () => {
    const correlationId = crypto.randomUUID();
    const result = await patientService.registerPatient(
      generateMockPatient('Audit'),
      testStaffId,
      correlationId,
      { role: 'receptionist', departmentId: testDeptId },
    );

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
      orderBy: [desc(auditEvents.sequenceNumber)],
    });

    expect(audit).toBeDefined();
    expect(audit?.eventType).toBe('PATIENT_REGISTERED');
    expect(audit?.targetId).toBe(result.id);
  });
});
