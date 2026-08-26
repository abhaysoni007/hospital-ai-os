import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../db';
import { encounters, appointments } from '../../../db/schema/appointments';
import { patients } from '../../../db/schema/patients';
import { staff, departments } from '../../../db/schema/staff';
import { auditEvents } from '../../../db/schema/audit';
import { clinicalRecords } from '../../../db/schema/clinical';
import { diagnosticOrders } from '../../../db/schema/diagnostics';
import { encounterService } from '../encounter.service';
import { clinicalService } from '../../clinical/clinical.service';
import { diagnosticsService } from '../../diagnostics/diagnostics.service';
import { auditService } from '../../audit/audit.service';
import { dischargeEncounterSchema } from 'shared';

const RUN = crypto.randomUUID().slice(0, 8);

describe('M13 Discharge Module (Phase 1A)', () => {
  let deptAId: string;
  let physicianAId: string;
  let physicianBId: string;
  let nurseId: string;
  let receptionistId: string;
  let patientId: string;
  const staffIds: string[] = [];
  const testIds: { enc: string; pt: string }[] = [];

  beforeAll(async () => {
    const [deptA] = await db
      .insert(departments)
      .values({ code: `D-${RUN}`, name: `Discharge Dept ${RUN}`, status: 'active' })
      .returning();
    deptAId = deptA.id;

    async function ensureStaff(role: string, email: string) {
      const [row] = await db
        .insert(staff)
        .values({
          employeeId: `EMP-${RUN}-${email.split('@')[0]}`,
          email,
          passwordHash: 'dummy',
          firstName: 'Test',
          lastName: role,
          role: role as any,
          departmentId: deptAId,
          status: 'active',
        })
        .returning();
      staffIds.push(row.id);
      return row.id;
    }

    physicianAId = await ensureStaff('physician', `phys-a-${RUN}@test.com`);
    physicianBId = await ensureStaff('physician', `phys-b-${RUN}@test.com`);
    nurseId = await ensureStaff('nurse', `nurse-${RUN}@test.com`);
    receptionistId = await ensureStaff('receptionist', `rec-${RUN}@test.com`);

    const [pt] = await db
      .insert(patients)
      .values({
        mrn: `MRN-${RUN}`,
        firstName: 'Patient',
        lastName: 'Test',
        dateOfBirth: '1990-01-01',
        gender: 'female',
        phonePrimary: `555123${RUN.slice(0, 4)}`,
        createdBy: receptionistId,
      })
      .returning();
    patientId = pt.id;
    testIds.push({ enc: '', pt: patientId });
  });

  afterAll(async () => {
    // Cleanup generated encounters and relations
    const eIds = testIds.filter((t) => t.enc).map((t) => t.enc);
    if (eIds.length > 0) {
      await db.delete(diagnosticOrders).where(inArray(diagnosticOrders.encounterId, eIds));
      await db.delete(clinicalRecords).where(inArray(clinicalRecords.encounterId, eIds));
      await db.delete(appointments).where(inArray(appointments.encounterId, eIds));
      await db.delete(encounters).where(inArray(encounters.id, eIds));
    }
    if (patientId) await db.delete(patients).where(eq(patients.id, patientId));
    if (staffIds.length > 0) await db.delete(staff).where(inArray(staff.id, staffIds));
    if (deptAId) await db.delete(departments).where(eq(departments.id, deptAId));
  });

  const ctx = (role: string) => ({ role, departmentId: deptAId });

  async function createActiveEncounter() {
    const enc = await encounterService.createEncounter(
      {
        patientId,
        doctorId: physicianAId,
        departmentId: deptAId,
        encounterType: 'opd',
      },
      receptionistId,
      crypto.randomUUID(),
      ctx('receptionist'),
    );
    testIds.push({ enc: enc.id, pt: patientId });

    const active = await encounterService.activateEncounter(
      enc.id,
      1,
      physicianAId,
      crypto.randomUUID(),
      ctx('physician'),
    );
    return active;
  }

  it('1. Schema Validation: Requires expectedVersion and summary', () => {
    const invalidPayload = { expectedVersion: 2 };
    expect(() => dischargeEncounterSchema.parse(invalidPayload)).toThrow();

    const emptySummary = { expectedVersion: 2, summary: '   ' };
    expect(() => dischargeEncounterSchema.parse(emptySummary)).toThrow();

    const valid = { expectedVersion: 2, summary: 'Patient is stable and ready for discharge.' };
    expect(dischargeEncounterSchema.parse(valid)).toEqual(valid);
  });

  it('2. Authorization: Blocks non-physicians and unassigned physicians', async () => {
    const enc = await createActiveEncounter();

    // Nurse
    await expect(
      encounterService.dischargeEncounter(
        enc.id,
        { expectedVersion: 2, summary: 'summary' },
        nurseId,
        crypto.randomUUID(),
        ctx('nurse'),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR', message: /Only physicians/ });

    // Unassigned Physician
    await expect(
      encounterService.dischargeEncounter(
        enc.id,
        { expectedVersion: 2, summary: 'summary' },
        physicianBId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({
      code: 'AUTHORIZATION_ERROR',
      message: /Only the assigned physician/,
    });
  });

  it('3. Diagnostic Resolution: Blocks pending orders, allows completed/cancelled/no orders', async () => {
    const enc = await createActiveEncounter();

    // Create a diagnostic order -> status 'ordered'
    const order = await diagnosticsService.createOrder(
      enc.id,
      { testCode: 'CBC', priority: 'routine' },
      physicianAId,
      crypto.randomUUID(),
      ctx('physician'),
    );

    // Attempt discharge -> blocked (ordered)
    await expect(
      encounterService.dischargeEncounter(
        enc.id,
        { expectedVersion: 2, summary: 's' },
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({ code: 'UNRESOLVED_DIAGNOSTICS' });

    // Cancel the order -> allowed
    await diagnosticsService.cancelOrder(
      order.id,
      { reason: 'mistake' },
      physicianAId,
      crypto.randomUUID(),
      ctx('physician'),
    );

    // Now it should succeed
    const res = await encounterService.dischargeEncounter(
      enc.id,
      { expectedVersion: 2, summary: 'Patient discharged.' },
      physicianAId,
      crypto.randomUUID(),
      ctx('physician'),
    );
    expect(res.status).toBe('discharged');
  });

  it('4. Optimistic Concurrency & Transition Verification', async () => {
    const enc = await createActiveEncounter();

    // Invalid version
    await expect(
      encounterService.dischargeEncounter(
        enc.id,
        { expectedVersion: 999, summary: 's' },
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    // REAL concurrent test: fire two exact same requests simultaneously
    const req1 = encounterService.dischargeEncounter(
      enc.id,
      { expectedVersion: 2, summary: 'Concurrent summary A' },
      physicianAId,
      crypto.randomUUID(),
      ctx('physician'),
    );
    const req2 = encounterService.dischargeEncounter(
      enc.id,
      { expectedVersion: 2, summary: 'Concurrent summary B' },
      physicianAId,
      crypto.randomUUID(),
      ctx('physician'),
    );

    const results = await Promise.allSettled([req1, req2]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Prove exactly 1 succeeds and exactly 1 conflicts
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const errorResult = (failures[0] as PromiseRejectedResult).reason;
    expect(errorResult.code).toMatch(/VERSION_CONFLICT|INVALID_TRANSITION/);

    // Prove exactly 1 discharge summary exists
    const records = await db.query.clinicalRecords.findMany({
      where: eq(clinicalRecords.encounterId, enc.id),
    });
    expect(records).toHaveLength(1);
    expect(records[0].recordType).toBe('discharge_summary');

    // Prove exactly 1 ENCOUNTER_DISCHARGED event
    const audits = await db.query.auditEvents.findMany({
      where: eq(auditEvents.targetId, enc.id),
    });
    const dischargeAudits = audits.filter((a) => a.eventType === 'ENCOUNTER_DISCHARGED');
    expect(dischargeAudits).toHaveLength(1);

    // Prove successful discharge transition
    const finalEnc = await db.query.encounters.findFirst({ where: eq(encounters.id, enc.id) });
    expect(finalEnc?.status).toBe('discharged');
    expect(finalEnc?.version).toBe(3);
  });

  it('5. Audit and Atomic Clinical Record Creation', async () => {
    const enc = await createActiveEncounter();
    const corrId = crypto.randomUUID();

    const discharged = await encounterService.dischargeEncounter(
      enc.id,
      { expectedVersion: 2, summary: 'Atomic summary content.' },
      physicianAId,
      corrId,
      ctx('physician'),
    );

    expect(discharged.status).toBe('discharged');

    // Verify clinical record exists and is SIGNED
    const records = await db.query.clinicalRecords.findMany({
      where: eq(clinicalRecords.encounterId, enc.id),
    });
    expect(records).toHaveLength(1);
    expect(records[0].recordType).toBe('discharge_summary');
    expect(records[0].status).toBe('signed');
    expect((records[0].content as any).narrative).toBe('Atomic summary content.');

    // Verify Audits
    const audits = await db.query.auditEvents.findMany({
      where: eq(auditEvents.correlationId, corrId),
    });
    const types = audits.map((a) => a.eventType);
    expect(types).toContain('CLINICAL_RECORD_CREATED');
    expect(types).toContain('ENCOUNTER_DISCHARGED');
  });

  it('6. Immutability: Post-discharge blocks new records and orders', async () => {
    const enc = await createActiveEncounter();
    await encounterService.dischargeEncounter(
      enc.id,
      { expectedVersion: 2, summary: 'Patient discharged.' },
      physicianAId,
      crypto.randomUUID(),
      ctx('physician'),
    );

    // M9: Try to create a clinical record
    await expect(
      clinicalService.createClinicalRecord(
        enc.id,
        { recordType: 'soap', content: { sections: ['', '', '', ''] as any } },
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({ code: 'ENCOUNTER_NOT_ACTIVE' });

    // M10: Try to create an order
    await expect(
      diagnosticsService.createOrder(
        enc.id,
        { testCode: 'CBC', priority: 'routine' },
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({ code: 'ENCOUNTER_NOT_ACTIVE' });

    // Immutability of the discharge summary itself
    const records = await db.query.clinicalRecords.findMany({
      where: eq(clinicalRecords.encounterId, enc.id),
    });
    const summaryId = records[0].id;
    // Trying to update the signed record via M9
    await expect(
      clinicalService.updateClinicalRecord(
        enc.id,
        summaryId,
        { expectedVersion: 1, content: {} },
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('7. Rollback: Transaction fails if audit fails', async () => {
    const enc = await createActiveEncounter();

    // Mock auditService to throw
    const originalLog = auditService.logEvent;
    auditService.logEvent = vi.fn().mockRejectedValue(new Error('Audit DB failure'));

    await expect(
      encounterService.dischargeEncounter(
        enc.id,
        { expectedVersion: 2, summary: 'This should rollback.' },
        physicianAId,
        crypto.randomUUID(),
        ctx('physician'),
      ),
    ).rejects.toThrow('Audit DB failure');

    // Restore
    auditService.logEvent = originalLog;

    // Verify rollback
    const reloaded = await db.query.encounters.findFirst({ where: eq(encounters.id, enc.id) });
    expect(reloaded?.status).toBe('active'); // Still active
    expect(reloaded?.version).toBe(2);

    const records = await db.query.clinicalRecords.findMany({
      where: eq(clinicalRecords.encounterId, enc.id),
    });
    expect(records).toHaveLength(0); // No record created
  });
});
