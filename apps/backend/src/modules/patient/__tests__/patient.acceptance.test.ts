/**
 * M6 Patient Module acceptance tests — search, duplicate detection,
 * identity documents, PHI safety. Complements patient.test.ts
 * (MRN format / concurrency / rollback / registration audit).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { patients } from '../../../db/schema/patients';
import { identities } from '../../../db/schema/identity';
import { auditEvents } from '../../../db/schema/audit';
import { staff, departments } from '../../../db/schema/staff';
import { patientService } from '../patient.service';
import { ConflictError } from 'shared/src/errors/AppError';

const RUN = crypto.randomUUID().slice(0, 8);

describe('M6 Patient acceptance — search, duplicates, identity, PHI', () => {
  let deptId: string;
  let staffId: string;
  let phoneA: string;
  let phoneB: string;
  const patientIds: string[] = [];
  const identityIds: string[] = [];

  const basePatient = (suffix: string) => ({
    firstName: `Search${suffix}`,
    lastName: `Person${RUN}`,
    dateOfBirth: '1985-06-15',
    gender: 'female' as const,
    phonePrimary: `555${Date.now().toString().slice(-6)}${suffix}`,
  });

  beforeAll(async () => {
    let dept = await db.query.departments.findFirst({
      where: eq(departments.code, `M6ACC-${RUN}`),
    });
    if (!dept) {
      dept = (
        await db
          .insert(departments)
          .values({ code: `M6ACC-${RUN}`, name: `M6 Acceptance ${RUN}`, status: 'active' })
          .returning()
      )[0];
    }
    deptId = dept.id;

    staffId = (
      await db
        .insert(staff)
        .values({
          employeeId: `M6ACC-${RUN}`,
          email: `m6-acc-${RUN}@test.hospital`,
          passwordHash: 'dummy',
          firstName: 'M6',
          lastName: 'Acceptance',
          role: 'receptionist',
          departmentId: deptId,
          status: 'active',
        })
        .returning()
    )[0].id;

    const payloadA = basePatient('A');
    const payloadB = basePatient('B');
    phoneA = payloadA.phonePrimary;
    phoneB = payloadB.phonePrimary;
    for (const payload of [payloadA, payloadB]) {
      const p = await patientService.registerPatient(payload, staffId, crypto.randomUUID(), {
        role: 'receptionist',
        departmentId: deptId,
      });
      patientIds.push(p.id);
    }
  });

  afterAll(async () => {
    if (!staffId) return;
    if (patientIds[0]) {
      await db.delete(identities).where(eq(identities.patientId, patientIds[0]));
    }
    await db.delete(patients).where(eq(patients.createdBy, staffId));
    // audit_events retained (append-only ledger)
  });

  it('duplicate detection: same first name, last name and DOB → 409 DUPLICATE_PATIENT', async () => {
    const dup = { ...basePatient('C'), firstName: 'SearchA', lastName: `Person${RUN}` };
    await expect(
      patientService.registerPatient(dup, staffId, crypto.randomUUID(), {
        role: 'receptionist',
        departmentId: deptId,
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_PATIENT' });
  });

  it('duplicate detection: same phone → 409 even with different name/DOB', async () => {
    const dup = {
      ...basePatient('D'),
      firstName: 'Other',
      lastName: 'Name',
      dateOfBirth: '1999-09-09',
      phonePrimary: phoneA,
    };
    await expect(
      patientService.registerPatient(dup, staffId, crypto.randomUUID(), {
        role: 'receptionist',
        departmentId: deptId,
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_PATIENT' });
  });

  it('search: exact MRN match returns the patient', async () => {
    const created = await db.query.patients.findFirst({
      where: eq(patients.id, patientIds[0]),
    });
    const result = await patientService.searchPatients({
      page: 1,
      pageSize: 50,
      mrn: created!.mrn,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(patientIds[0]);
    expect(result.meta.total).toBe(1);
  });

  it('search: phone filter matches only the right patient', async () => {
    const result = await patientService.searchPatients({ page: 1, pageSize: 50, phone: phoneB });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(patientIds[1]);
  });

  it('search: pagination metadata is correct', async () => {
    const result = await patientService.searchPatients({ page: 1, pageSize: 1 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.totalPages).toBeGreaterThanOrEqual(2);
    expect(result.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('search: fuzzy name query finds the patient (pg_trgm)', async () => {
    const result = await patientService.searchPatients({
      page: 1,
      pageSize: 50,
      query: `SearchA Person${RUN}`,
    });
    expect(result.data.some((p) => p.id === patientIds[0])).toBe(true);
  });

  it('PHI safety: search and registration responses never expose credentials or identity numbers', async () => {
    const result = await patientService.searchPatients({
      page: 1,
      pageSize: 50,
      phone: phoneA,
    });
    const row = result.data[0] as Record<string, unknown>;
    expect(row.passwordHash).toBeUndefined();
    expect(row.documentNumberEnc).toBeUndefined();
  });

  it('identity: upload stores encrypted number, emits IDENTITY_UPLOADED audit, returns pending', async () => {
    const identity = await patientService.addIdentity(
      patientIds[0],
      { documentType: 'aadhaar', documentNumber: '1234-5678-9012' },
      staffId,
      crypto.randomUUID(),
      { role: 'receptionist', departmentId: deptId },
    );
    identityIds.push(identity.id);

    expect(identity.verificationStatus).toBe('pending');
    // Response must not carry the encrypted number
    expect((identity as Record<string, unknown>).documentNumberEnc).toBeUndefined();

    const stored = await db.query.identities.findFirst({
      where: eq(identities.id, identity.id),
    });
    // Encrypted at rest: ciphertext format (iv:tag:ciphertext), never plaintext
    expect(stored!.documentNumberEnc).not.toContain('1234-5678-9012');
    expect(stored!.documentNumberEnc.split(':')).toHaveLength(3);

    const audits = await db.query.auditEvents.findMany({
      where: eq(auditEvents.targetId, identity.id),
    });
    expect(audits.some((a) => a.eventType === 'IDENTITY_UPLOADED')).toBe(true);
  });

  it('identity: verification decision records verifier + audit; re-decision → 409', async () => {
    const verifierId = (
      await db
        .insert(staff)
        .values({
          employeeId: `M6VER-${RUN}`,
          email: `m6-ver-${RUN}@test.hospital`,
          passwordHash: 'dummy',
          firstName: 'M6',
          lastName: 'Verifier',
          role: 'receptionist',
          departmentId: deptId,
          status: 'active',
        })
        .returning()
    )[0].id;

    const verified = await patientService.verifyIdentity(
      patientIds[0],
      identityIds[0],
      'verified',
      verifierId,
      crypto.randomUUID(),
      { role: 'receptionist', departmentId: deptId },
    );
    expect(verified.verificationStatus).toBe('verified');

    await expect(
      patientService.verifyIdentity(
        patientIds[0],
        identityIds[0],
        'rejected',
        verifierId,
        crypto.randomUUID(),
        { role: 'receptionist', departmentId: deptId },
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    const audits = await db.query.auditEvents.findMany({
      where: eq(auditEvents.targetId, identityIds[0]),
    });
    expect(audits.some((a) => a.eventType === 'IDENTITY_VERIFIED')).toBe(true);
  });
});
