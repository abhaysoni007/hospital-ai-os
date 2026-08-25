import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../db';
import { clinicalRecords } from '../../../db/schema/clinical';
import { encounters } from '../../../db/schema/appointments';
import { patients } from '../../../db/schema/patients';
import { staff, departments } from '../../../db/schema/staff';
import { auditEvents } from '../../../db/schema/audit';
import { clinicalService } from '../clinical.service';
import { encounterService } from '../../encounter/encounter.service';
import { auditService } from '../../audit/audit.service';
import { soapContentSchema } from 'shared';

/**
 * M9 Clinical Module — live-DB integration tests.
 * Covers: creation rules/scope, reads + access audit, draft updates with
 * optimistic concurrency, signing, immutability, audit rollback,
 * and the ADR-015 scope/PHI rulings.
 */

const RUN = crypto.randomUUID().slice(0, 8);

const SOAP_CONTENT = soapContentSchema.parse({
  sections: [
    { heading: 'subjective', content: 'Chest pain for two days.' },
    { heading: 'objective', content: 'BP 140/90. SpO2 97% RA.' },
    { heading: 'assessment', content: 'Suspected unstable angina.' },
    { heading: 'plan', content: 'ECG, troponin, cardiology consult.' },
  ],
});

describe('M9 Clinical Module', () => {
  let deptAId: string;
  let deptBId: string;
  let physicianAId: string;
  let physicianA2Id: string; // same department, NOT assigned
  let physicianBId: string;
  let nurseAId: string;
  let nurseBId: string;
  let receptionistId: string;
  let patientId: string;
  const staffIds: string[] = [];
  const ctx = (role: string, deptId: string) => ({ role, departmentId: deptId });
  const ctxA = (role: string) => ctx(role, deptAId);

  beforeAll(async () => {
    async function ensureDept(code: string): Promise<string> {
      const existing = await db.query.departments.findFirst({ where: eq(departments.code, code) });
      if (existing) return existing.id;
      return (
        await db
          .insert(departments)
          .values({ code, name: `M9 Dept ${code} ${RUN}`, status: 'active' })
          .returning()
      )[0].id;
    }
    deptAId = await ensureDept('M9A');
    deptBId = await ensureDept('M9B');

    async function ensureStaff(
      email: string,
      role: 'physician' | 'receptionist' | 'nurse',
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
          employeeId: `EMP-M9-${email.split('@')[0]}`,
          email,
          passwordHash: 'dummy',
          firstName: 'M9',
          lastName: role,
          role,
          departmentId,
          status: 'active',
        })
        .returning();
      staffIds.push(row.id);
      return row.id;
    }

    physicianAId = await ensureStaff('m9-physician-a@test.hospital', 'physician', deptAId);
    physicianA2Id = await ensureStaff('m9-physician-a2@test.hospital', 'physician', deptAId);
    physicianBId = await ensureStaff('m9-physician-b@test.hospital', 'physician', deptBId);
    nurseAId = await ensureStaff('m9-nurse-a@test.hospital', 'nurse', deptAId);
    nurseBId = await ensureStaff('m9-nurse-b@test.hospital', 'nurse', deptBId);
    receptionistId = await ensureStaff('m9-receptionist@test.hospital', 'receptionist', deptAId);

    patientId = (
      await db
        .insert(patients)
        .values({
          mrn: `MRN-M9-${RUN.slice(0, 5)}C`,
          firstName: 'Clinical',
          lastName: 'Nine',
          dateOfBirth: '1978-07-07',
          gender: 'male',
          phonePrimary: `88${RUN.replace(/\D/g, '').padEnd(8, '4').slice(0, 8)}`,
          createdBy: receptionistId,
        })
        .returning()
    )[0].id;
  });

  afterAll(async () => {
    // FK order: records → encounters → patients. Staff retained (audit FK).
    await db.delete(clinicalRecords).where(inArray(clinicalRecords.createdBy, staffIds));
    await db.delete(encounters).where(inArray(encounters.createdBy, staffIds));
    await db.delete(patients).where(eq(patients.createdBy, receptionistId));
  });

  /** Creates an ACTIVE encounter assigned to the given physician. */
  async function makeActiveEncounter(physicianId: string, deptId: string) {
    const enc = await encounterService.createEncounter(
      {
        patientId,
        doctorId: physicianId,
        departmentId: deptId,
        encounterType: 'opd',
      },
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

  // -------------------------------------------------------------------------
  it('A. Physician creates SOAP draft on assigned active encounter → v1 + CREATED audit', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);
    const correlationId = crypto.randomUUID();

    const record = await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'soap', content: SOAP_CONTENT },
      physicianAId,
      correlationId,
      ctxA('physician'),
    );

    expect(record.status).toBe('draft');
    expect(record.version).toBe(1);
    expect(record.patientId).toBe(patientId);
    expect(record.signedBy).toBeNull();

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(audit?.eventType).toBe('CLINICAL_RECORD_CREATED');
    expect(JSON.stringify(audit?.actionDetail)).not.toContain('Chest pain'); // no PHI in payload
  });

  it('B. Creation requires encounter ACTIVE (registered encounter → ENCOUNTER_NOT_ACTIVE)', async () => {
    const enc = await encounterService.createEncounter(
      {
        patientId,
        doctorId: physicianAId,
        departmentId: deptAId,
        encounterType: 'opd',
      },
      receptionistId,
      crypto.randomUUID(),
      ctxA('receptionist'),
    );

    await expect(
      clinicalService.createClinicalRecord(
        enc.id,
        { recordType: 'soap', content: SOAP_CONTENT },
        physicianAId,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ).rejects.toMatchObject({ code: 'ENCOUNTER_NOT_ACTIVE' });
  });

  it('C. Create scope: non-assigned physician → 403; nurse vitals OK; nurse SOAP → 403; cross-dept nurse → 403', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);

    // Same-department but NOT assigned physician
    await expect(
      clinicalService.createClinicalRecord(
        enc.id,
        { recordType: 'soap', content: SOAP_CONTENT },
        physicianA2Id,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    // Nurse (same dept) may create vital_signs
    const vitalsRecord = await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'vital_signs', vitals: validVitals(), content: { note: 'on admission' } },
      nurseAId,
      crypto.randomUUID(),
      ctxA('nurse'),
    );
    expect(vitalsRecord.recordType).toBe('vital_signs');

    // Nurse may NOT create SOAP
    await expect(
      clinicalService.createClinicalRecord(
        enc.id,
        { recordType: 'soap', content: SOAP_CONTENT },
        nurseAId,
        crypto.randomUUID(),
        ctxA('nurse'),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    // Cross-department nurse denied even for vitals
    await expect(
      clinicalService.createClinicalRecord(
        enc.id,
        { recordType: 'vital_signs', vitals: validVitals() },
        nurseBId,
        crypto.randomUUID(),
        ctx('nurse', deptBId),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    // Invalid vitals value rejected by ADR-015 range validation
    await expect(
      clinicalService.createClinicalRecord(
        enc.id,
        { recordType: 'vital_signs', vitals: { pulse_bpm: 500 } },
        nurseAId,
        crypto.randomUUID(),
        ctxA('nurse'),
      ),
    ).rejects.toThrow();
  });

  function validVitals() {
    return {
      temperature_c: 36.8,
      pulse_bpm: 82,
      resp_rate: 18,
      bp_systolic: 122,
      bp_diastolic: 78,
      spo2_pct: 99,
      weight_kg: 64,
      height_cm: 168,
    };
  }

  it('D. List: scoped read + exactly ONE CLINICAL_RECORD_ACCESSED event per request', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);
    await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'soap', content: SOAP_CONTENT },
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );

    const correlationId = crypto.randomUUID();
    const list = await clinicalService.listClinicalRecords(
      enc.id,
      { page: 1, pageSize: 50 },
      physicianAId,
      correlationId,
      ctxA('physician'),
    );
    expect(list.data.length).toBeGreaterThanOrEqual(1);

    const accessEvents = await db.query.auditEvents.findMany({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(accessEvents).toHaveLength(1); // per-request granularity (ADR-015 Decision 6)
    expect(accessEvents[0].eventType).toBe('CLINICAL_RECORD_ACCESSED');

    // Roles without clinical_record:read are denied at service level too
    for (const role of ['receptionist', 'hospital_admin', 'security_admin']) {
      await expect(
        clinicalService.listClinicalRecords(
          enc.id,
          { page: 1, pageSize: 50 },
          receptionistId,
          crypto.randomUUID(),
          ctxA(role),
        ),
      ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
    }

    // Cross-department physician denied
    await expect(
      clinicalService.listClinicalRecords(
        enc.id,
        { page: 1, pageSize: 50 },
        physicianBId,
        crypto.randomUUID(),
        ctx('physician', deptBId),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    // Temporary ADR-015 interpretation: pharmacist/lab_technician get dept read
    void nurseBId;
  });

  it('E. Single read: record must belong to :encounterId → otherwise 404', async () => {
    const enc1 = await makeActiveEncounter(physicianAId, deptAId);
    const rec = await clinicalService.createClinicalRecord(
      enc1.id,
      { recordType: 'soap', content: SOAP_CONTENT },
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );
    const enc2 = await makeActiveEncounter(physicianAId, deptAId);

    await expect(
      clinicalService.getClinicalRecord(
        enc2.id,
        rec.id,
        physicianAId,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ).rejects.toMatchObject({ code: 'CLINICAL_RECORD_NOT_FOUND' });

    const fetched = await clinicalService.getClinicalRecord(
      enc1.id,
      rec.id,
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );
    expect(fetched.id).toBe(rec.id);
  });

  it('F. Update draft: author edit bumps version + DRAFT_UPDATED audit; author-only enforced', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);
    const rec = await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'soap', content: SOAP_CONTENT },
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );
    const correlationId = crypto.randomUUID();

    const updated = await clinicalService.updateClinicalRecord(
      enc.id,
      rec.id,
      { expectedVersion: 1, content: SOAP_CONTENT },
      physicianAId,
      correlationId,
      ctxA('physician'),
    );
    expect(updated.version).toBe(2);

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(audit?.eventType).toBe('CLINICAL_RECORD_DRAFT_UPDATED');

    // Non-author physician (even same dept) cannot edit someone else's draft
    await expect(
      clinicalService.updateClinicalRecord(
        enc.id,
        rec.id,
        { expectedVersion: 2, content: SOAP_CONTENT },
        physicianA2Id,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });
  });

  it('G. Optimistic concurrency: stale version → VERSION_CONFLICT; signed → INVALID_TRANSITION', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);
    const rec = await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'soap', content: SOAP_CONTENT },
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );

    await clinicalService.updateClinicalRecord(
      enc.id,
      rec.id,
      { expectedVersion: 1, content: SOAP_CONTENT },
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    ); // now v2

    // Stale attempt with v1
    await expect(
      clinicalService.updateClinicalRecord(
        enc.id,
        rec.id,
        { expectedVersion: 1, content: SOAP_CONTENT },
        physicianAId,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    // Sign at v2, then attempt update at v2 (matches version but signed)
    await clinicalService.signClinicalRecord(
      enc.id,
      rec.id,
      2,
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );
    await expect(
      clinicalService.updateClinicalRecord(
        enc.id,
        rec.id,
        { expectedVersion: 3, content: SOAP_CONTENT },
        physicianAId,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('H. Sign: author physician only; sets signedBy/signedAt; version+1; NOTE_SIGNED audit', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);
    const rec = await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'progress_note', content: { narrative: 'Patient stable after review.' } },
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );
    const correlationId = crypto.randomUUID();

    // Nurse cannot sign (no permission)
    await expect(
      clinicalService.signClinicalRecord(
        enc.id,
        rec.id,
        1,
        nurseAId,
        crypto.randomUUID(),
        ctxA('nurse'),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    // Non-author physician cannot sign
    await expect(
      clinicalService.signClinicalRecord(
        enc.id,
        rec.id,
        1,
        physicianA2Id,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORIZATION_ERROR' });

    const signed = await clinicalService.signClinicalRecord(
      enc.id,
      rec.id,
      1,
      physicianAId,
      correlationId,
      ctxA('physician'),
    );
    expect(signed.status).toBe('signed');
    expect(signed.signedBy).toBe(physicianAId);
    expect(signed.signedAt).not.toBeNull();
    expect(signed.version).toBe(2);

    const audit = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(audit?.eventType).toBe('CLINICAL_NOTE_SIGNED');
  });

  it('I. Immutability: rejected mutation leaves signed content byte-equivalent, version unchanged', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);
    const rec = await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'soap', content: SOAP_CONTENT },
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );
    await clinicalService.signClinicalRecord(
      enc.id,
      rec.id,
      1,
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );

    const before = await db.query.clinicalRecords.findFirst({
      where: eq(clinicalRecords.id, rec.id),
    });
    const beforeJson = JSON.stringify(before?.content);

    await expect(
      clinicalService.updateClinicalRecord(
        enc.id,
        rec.id,
        { expectedVersion: 2, content: SOAP_CONTENT }, // even "matching" version fails: status guard
        physicianAId,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    const after = await db.query.clinicalRecords.findFirst({
      where: eq(clinicalRecords.id, rec.id),
    });
    expect(JSON.stringify(after?.content)).toBe(beforeJson);
    expect(after?.version).toBe(before?.version);
    expect(after?.status).toBe('signed');
  });

  it('J. CONCURRENCY: 20 parallel updates, same expectedVersion → exactly 1 success, 19 VERSION_CONFLICT', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);
    const rec = await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'vital_signs', vitals: validVitals() },
      nurseAId,
      crypto.randomUUID(),
      ctxA('nurse'),
    );

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        clinicalService.updateClinicalRecord(
          enc.id,
          rec.id,
          { expectedVersion: 1, vitals: { pulse_bpm: 80 + i } },
          nurseAId,
          crypto.randomUUID(),
          ctxA('nurse'),
        ),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(19);
    for (const f of failed as PromiseRejectedResult[]) {
      expect((f.reason as { code?: string }).code).toBe('VERSION_CONFLICT');
    }
    expect((succeeded[0] as PromiseFulfilledResult<{ version: number }>).value.version).toBe(2);
  });

  it('K. RACE: PATCH vs SIGN on same draft → exactly one wins deterministically', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);
    const rec = await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'soap', content: SOAP_CONTENT },
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );

    const [updateRes, signRes] = await Promise.allSettled([
      clinicalService.updateClinicalRecord(
        enc.id,
        rec.id,
        { expectedVersion: 1, content: SOAP_CONTENT },
        physicianAId,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
      clinicalService.signClinicalRecord(
        enc.id,
        rec.id,
        1,
        physicianAId,
        crypto.randomUUID(),
        ctxA('physician'),
      ),
    ]);

    const finalRow = await db.query.clinicalRecords.findFirst({
      where: eq(clinicalRecords.id, rec.id),
    });

    if (updateRes.status === 'fulfilled') {
      // Update won → still draft, version 2, unsigned
      expect(signRes.status).toBe('rejected');
      expect(finalRow?.status).toBe('draft');
      expect(finalRow?.version).toBe(2);
      expect(finalRow?.signedBy).toBeNull();
    } else {
      // Sign won → signed, version 2
      expect(finalRow?.status).toBe('signed');
      expect(finalRow?.version).toBe(2);
      expect(finalRow?.signedBy).toBe(physicianAId);
    }
    expect(finalRow?.version).toBe(2); // single monotonic increment either way
  });

  it('L. Audit failure → full rollback: no row change, no audit row, no version drift', async () => {
    const enc = await makeActiveEncounter(physicianAId, deptAId);
    const rec = await clinicalService.createClinicalRecord(
      enc.id,
      { recordType: 'progress_note', content: { narrative: 'Initial note.' } },
      physicianAId,
      crypto.randomUUID(),
      ctxA('physician'),
    );
    const correlationId = crypto.randomUUID();

    const auditSpy = vi
      .spyOn(auditService, 'logEvent')
      .mockRejectedValueOnce(new Error('INTENTIONAL_AUDIT_FAILURE'));

    let threw = false;
    try {
      await clinicalService.updateClinicalRecord(
        enc.id,
        rec.id,
        { expectedVersion: 1, content: { narrative: 'Edited note that must roll back.' } },
        physicianAId,
        correlationId,
        ctxA('physician'),
      );
    } catch (e) {
      threw = true;
      expect(String(e)).toContain('INTENTIONAL_AUDIT_FAILURE');
    }
    auditSpy.mockRestore();
    expect(threw).toBe(true);

    const row = await db.query.clinicalRecords.findFirst({
      where: eq(clinicalRecords.id, rec.id),
    });
    expect(row?.version).toBe(1);
    expect((row?.content as { narrative: string }).narrative).toBe('Initial note.');

    const orphanAudit = await db.query.auditEvents.findMany({
      where: eq(auditEvents.correlationId, correlationId),
    });
    expect(orphanAudit).toHaveLength(0);
  });

  it('M. PHI: no audit payload ever contains clinical narrative or vitals values', async () => {
    const events = await db.query.auditEvents.findMany({
      where: inArray(auditEvents.eventType, [
        'CLINICAL_RECORD_CREATED',
        'CLINICAL_RECORD_DRAFT_UPDATED',
        'CLINICAL_NOTE_SIGNED',
        'CLINICAL_RECORD_ACCESSED',
      ]),
    });
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      const raw = JSON.stringify(e.actionDetail ?? {});
      expect(raw).not.toContain('Chest pain');
      expect(raw).not.toContain('angina');
      expect(raw).not.toContain('narrative');
      expect(raw).not.toContain('sections');
      expect(raw.toLowerCase()).not.toContain('"temperature_c"');
    }
  });
});
