import { db } from '../../db';
import { patients } from '../../db/schema/patients';
import { identities } from '../../db/schema/identity';
import { desc, ilike, or, eq, and, sql } from 'drizzle-orm';
import {
  RegisterPatientRequest,
  GetPatientsQuery,
  UpdatePatientRequest,
  CreateIdentityRequest,
} from 'shared';
import { ConflictError, NotFoundError } from 'shared/src/errors/AppError';
import { auditService } from '../audit/audit.service';
import { encryptField } from '../../utils/encryption';

export class PatientService {
  /**
   * Generates a unique Medical Record Number (MRN).
   * Format: MRN-YYYY-XXXXX
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generateMRN(tx?: any): Promise<string> {
    const year = new Date().getUTCFullYear();
    const seqName = `patient_mrn_seq_${year}`;
    const client = tx || db;

    try {
      const result = await client.execute(sql.raw(`SELECT nextval('${seqName}') as seq`));
      // Drizzle raw execute returns an array of rows
      const seqValue = Number((result as unknown as Array<{ seq: number }>)[0].seq);

      // Format: MRN-YYYY-NNNNN. If we exceed 99,999 patients, padStart won't truncate,
      // it will just produce MRN-2026-100000 (safe rollover).
      return `MRN-${year}-${String(seqValue).padStart(5, '0')}`;
    } catch (error) {
      // Lazy creation fallback (42P01 = undefined_table) in case we cross into a new year
      // and a DBA/migration hasn't created the sequence yet.
      const pgCode = (error as { code?: string }).code;
      if (pgCode === '42P01') {
        await client.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1`));
        const result = await client.execute(sql.raw(`SELECT nextval('${seqName}') as seq`));
        const retrySeqValue = Number((result as unknown as Array<{ seq: number }>)[0].seq);
        return `MRN-${year}-${String(retrySeqValue).padStart(5, '0')}`;
      }
      throw error;
    }
  }

  /**
   * Registers a new patient, generating an MRN and logging the action.
   */
  async registerPatient(
    payload: RegisterPatientRequest,
    creatorId: string,
    correlationId: string,
    authContext: { role: string; departmentId: string },
  ) {
    return await db.transaction(async (tx) => {
      // Basic duplicate check (exact match on name and DOB or phone)
      const existing = await tx.query.patients.findFirst({
        where: or(
          and(
            ilike(patients.firstName, payload.firstName),
            ilike(patients.lastName, payload.lastName),
            eq(patients.dateOfBirth, payload.dateOfBirth),
          ),
          eq(patients.phonePrimary, payload.phonePrimary),
        ),
      });

      if (existing) {
        throw new ConflictError(
          'A patient with similar details or same phone number already exists.',
          { code: 'DUPLICATE_PATIENT' },
        );
      }

      const mrn = await this.generateMRN(tx);

      const [newPatient] = await tx
        .insert(patients)
        .values({
          mrn,
          firstName: payload.firstName,
          lastName: payload.lastName,
          dateOfBirth: payload.dateOfBirth,
          gender: payload.gender,
          phonePrimary: payload.phonePrimary,
          phoneEmergency: payload.phoneEmergency,
          emergencyContactName: payload.emergencyContactName,
          addressLine1: payload.addressLine1,
          addressCity: payload.addressCity,
          addressState: payload.addressState,
          addressPostalCode: payload.addressPostalCode,
          createdBy: creatorId,
        })
        .returning();

      // Log the audit event synchronously within the same transaction
      await auditService.logEvent(
        {
          eventType: 'PATIENT_REGISTERED',
          actorId: creatorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'PATIENT',
          targetId: newPatient.id,
          patientId: newPatient.id,
          actionDetail: { mrn },
        },
        correlationId,
        tx,
      );

      return newPatient;
    });
  }

  /**
   * Searches for patients using trigram indices if a fuzzy query is provided.
   */
  async searchPatients(query: GetPatientsQuery) {
    const page = query.page || 1;
    const limit = query.pageSize || 50;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.status) {
      conditions.push(eq(patients.status, query.status));
    }

    if (query.mrn) {
      conditions.push(eq(patients.mrn, query.mrn));
    }

    if (query.phone) {
      conditions.push(eq(patients.phonePrimary, query.phone));
    }

    // True Fuzzy search using pg_trgm
    if (query.query) {
      conditions.push(
        or(
          sql`(${patients.firstName} || ' ' || ${patients.lastName}) % ${query.query}`,
          eq(patients.mrn, query.query),
        ),
      );
    }

    const results = await db.query.patients.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(patients.createdAt), desc(patients.id)],
      limit,
      offset,
    });

    const totalResult = await db.$count(
      patients,
      conditions.length > 0 ? and(...conditions) : undefined,
    );

    return {
      data: results,
      meta: {
        total: totalResult,
        page,
        limit,
        totalPages: Math.ceil(totalResult / limit),
      },
    };
  }

  async getPatientById(
    id: string,
    accessedBy?: string,
    authContext?: { role: string; departmentId: string },
    correlationId?: string,
  ) {
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, id),
    });

    if (!patient) {
      throw new NotFoundError('Patient not found', { code: 'PATIENT_NOT_FOUND' });
    }

    if (accessedBy && authContext && correlationId) {
      await auditService.logEvent(
        {
          eventType: 'PATIENT_ACCESSED',
          actorId: accessedBy,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'PATIENT',
          targetId: id,
          patientId: id,
        },
        correlationId,
      );
    }

    return patient;
  }

  /**
   * Updates patient demographics. Runs in one transaction with the PATIENT_UPDATED audit event.
   * Optimistic concurrency: when the client supplies `expectedVersion`, the write is
   * guarded by a version predicate — a stale version fails with VERSION_CONFLICT
   * instead of silently overwriting newer demographics (M18).
   */
  async updatePatient(
    id: string,
    payload: UpdatePatientRequest,
    updaterId: string,
    correlationId: string,
    authContext: { role: string; departmentId: string },
  ) {
    const { expectedVersion, ...fields } = payload;

    return await db.transaction(async (tx) => {
      const existing = await tx.query.patients.findFirst({ where: eq(patients.id, id) });
      if (!existing) {
        throw new NotFoundError('Patient not found', { code: 'PATIENT_NOT_FOUND' });
      }

      if (fields.phonePrimary && fields.phonePrimary !== existing.phonePrimary) {
        const duplicate = await tx.query.patients.findFirst({
          where: eq(patients.phonePrimary, fields.phonePrimary),
        });
        if (duplicate) {
          throw new ConflictError('A patient with this phone number already exists.', {
            code: 'DUPLICATE_PATIENT',
          });
        }
      }

      const guarded =
        expectedVersion !== undefined
          ? and(eq(patients.id, id), eq(patients.version, expectedVersion))
          : eq(patients.id, id);

      const [updated] = await tx
        .update(patients)
        .set({ ...fields, version: existing.version + 1, updatedAt: new Date() })
        .where(guarded)
        .returning();

      if (!updated) {
        throw new ConflictError('Patient was modified concurrently.', {
          code: 'VERSION_CONFLICT',
        });
      }

      await auditService.logEvent(
        {
          eventType: 'PATIENT_UPDATED',
          actorId: updaterId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'PATIENT',
          targetId: id,
          patientId: id,
          actionDetail: {
            updatedFields: Object.keys(fields),
            previousVersion: existing.version,
            newVersion: existing.version + 1,
          },
        },
        correlationId,
        tx,
      );

      return updated;
    });
  }

  /**
   * Registers an identity document for a patient. The document number is
   * encrypted at rest (AES-256-GCM) and never returned to clients.
   */
  async addIdentity(
    patientId: string,
    payload: CreateIdentityRequest,
    actorId: string,
    correlationId: string,
    authContext: { role: string; departmentId: string },
  ) {
    return await db.transaction(async (tx) => {
      const patient = await tx.query.patients.findFirst({ where: eq(patients.id, patientId) });
      if (!patient) {
        throw new NotFoundError('Patient not found', { code: 'PATIENT_NOT_FOUND' });
      }

      const [identity] = await tx
        .insert(identities)
        .values({
          patientId,
          documentType: payload.documentType,
          documentNumberEnc: encryptField(payload.documentNumber),
        })
        .returning();

      await auditService.logEvent(
        {
          eventType: 'IDENTITY_UPLOADED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'IDENTITY',
          targetId: identity.id,
          patientId,
          actionDetail: { documentType: payload.documentType },
        },
        correlationId,
        tx,
      );

      return {
        id: identity.id,
        patientId: identity.patientId,
        documentType: identity.documentType,
        verificationStatus: identity.verificationStatus,
        createdAt: identity.createdAt,
      };
    });
  }

  /**
   * Verifies or rejects a patient identity document.
   */
  async verifyIdentity(
    patientId: string,
    identityId: string,
    decision: 'verified' | 'rejected',
    verifierId: string,
    correlationId: string,
    authContext: { role: string; departmentId: string },
  ) {
    return await db.transaction(async (tx) => {
      const identity = await tx.query.identities.findFirst({
        where: and(eq(identities.id, identityId), eq(identities.patientId, patientId)),
      });
      if (!identity) {
        throw new NotFoundError('Identity document not found', { code: 'IDENTITY_NOT_FOUND' });
      }
      if (identity.verificationStatus !== 'pending') {
        throw new ConflictError(
          `Identity document has already been ${identity.verificationStatus}.`,
          { code: 'IDENTITY_ALREADY_RESOLVED' },
        );
      }

      // Status predicate is the authoritative guard: a concurrent verify/reject
      // commits first, this UPDATE matches zero rows and fails deterministically
      // instead of flipping a resolved document.
      const [updated] = await tx
        .update(identities)
        .set({ verificationStatus: decision, verifiedBy: verifierId })
        .where(
          and(eq(identities.id, identityId), eq(identities.verificationStatus, 'pending')),
        )
        .returning();

      if (!updated) {
        throw new ConflictError('Identity document has already been resolved.', {
          code: 'IDENTITY_ALREADY_RESOLVED',
        });
      }

      await auditService.logEvent(
        {
          eventType: 'IDENTITY_VERIFIED',
          actorId: verifierId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'IDENTITY',
          targetId: identityId,
          patientId,
          actionDetail: { decision },
        },
        correlationId,
        tx,
      );

      return {
        id: updated.id,
        patientId: updated.patientId,
        documentType: updated.documentType,
        verificationStatus: updated.verificationStatus,
        verifiedBy: updated.verifiedBy,
        createdAt: updated.createdAt,
      };
    });
  }
}

export const patientService = new PatientService();
