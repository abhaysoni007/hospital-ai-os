import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { clinicalRecords } from '../../db/schema/clinical';
import { encounters } from '../../db/schema/appointments';
import {
  CreateClinicalRecordRequest,
  UpdateClinicalRecordRequest,
  GetClinicalRecordsQuery,
  contentSchemasByType,
  vitalsSchema,
  ClinicalRecordResponse,
} from 'shared';
import { AuthorizationError, ConflictError, NotFoundError } from 'shared/src/errors/AppError';
import { auditService } from '../audit/audit.service';
import type { ClinicalStatus } from './clinical.state-machine';

type AuthContext = { role: string; departmentId: string };

const CLINICAL_READ_ROLES = new Set(['physician', 'nurse', 'pharmacist', 'lab_technician']);

/** ADR-015 Decision 4 (temporary): pharmacist/lab-tech read = department scope. */
function readScopeOk(encounterDeptId: string, ctx: AuthContext): boolean {
  return CLINICAL_READ_ROLES.has(ctx.role) && encounterDeptId === ctx.departmentId;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResponse(row: any): ClinicalRecordResponse {
  return {
    id: row.id,
    encounterId: row.encounterId,
    patientId: row.patientId,
    recordType: row.recordType,
    status: row.status,
    version: row.version,
    content: row.content,
    vitals: row.vitals ?? null,
    signedBy: row.signedBy ?? null,
    signedAt: row.signedAt ? row.signedAt.toISOString() : null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class ClinicalService {
  /**
   * Creates a clinical record on an ACTIVE encounter.
   * Physician: assigned doctor; soap/progress_note only.
   * Nurse: same department; vital_signs only.
   * patientId is taken from the encounter — never from client input.
   */
  async createClinicalRecord(
    encounterId: string,
    payload: CreateClinicalRecordRequest,
    authorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    const encounter = await db.query.encounters.findFirst({
      where: eq(encounters.id, encounterId),
    });
    if (!encounter) {
      throw new NotFoundError('Encounter not found', { code: 'ENCOUNTER_NOT_FOUND' });
    }

    if (authContext.role === 'physician') {
      if (encounter.doctorId !== authorId) {
        throw new AuthorizationError('Only the assigned physician may document on this encounter.');
      }
      if (payload.recordType === 'vital_signs') {
        throw new AuthorizationError('Physicians document notes; vital signs are nurse-entered.');
      }
    } else if (authContext.role === 'nurse') {
      if (encounter.departmentId !== authContext.departmentId) {
        throw new AuthorizationError('Nurses may only document within their department.');
      }
      // ADR-015 Decision 7: nurses create vital_signs ONLY.
      if (payload.recordType !== 'vital_signs') {
        throw new AuthorizationError('Nurses may only record vital_signs records.');
      }
    } else {
      throw new AuthorizationError('Not permitted to write clinical records.');
    }

    if (encounter.status !== 'active') {
      throw new ConflictError(
        `Clinical records can only be created on active encounters (current: ${encounter.status}).`,
        { code: 'ENCOUNTER_NOT_ACTIVE' },
      );
    }

    // Defense-in-depth: validate vitals ranges even when called directly.
    if (payload.recordType === 'vital_signs') {
      const parsed = vitalsSchema.safeParse(payload.vitals);
      if (!parsed.success) {
        throw new ConflictError('Invalid vital sign values.', { code: 'VALIDATION_ERROR' });
      }
    }

    const insertValues: {
      encounterId: string;
      patientId: string;
      recordType: typeof payload.recordType;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vitals?: any;
      status: 'draft';
      version: number;
      createdBy: string;
    } = {
      encounterId,
      patientId: encounter.patientId, // server-side linkage only
      recordType: payload.recordType,
      content: payload.recordType === 'vital_signs' ? (payload.content ?? {}) : payload.content,
      status: 'draft',
      version: 1,
      createdBy: authorId,
    };
    if (payload.recordType === 'vital_signs') {
      insertValues.vitals = payload.vitals;
    }

    return await db.transaction(async (tx) => {
      const [record] = await tx.insert(clinicalRecords).values(insertValues).returning();

      await auditService.logEvent(
        {
          eventType: 'CLINICAL_RECORD_CREATED',
          actorId: authorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'CLINICAL_RECORD',
          targetId: record.id,
          patientId: record.patientId,
          actionDetail: {
            encounterId,
            recordType: record.recordType,
            resultingVersion: record.version,
          },
        },
        correlationId,
        tx,
      );

      return toResponse(record);
    });
  }

  /** Lists records for an encounter. ONE access event per request (ADR-015 Decision 6). */
  async listClinicalRecords(
    encounterId: string,
    query: GetClinicalRecordsQuery,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    const encounter = await db.query.encounters.findFirst({
      where: eq(encounters.id, encounterId),
    });
    if (!encounter) {
      throw new NotFoundError('Encounter not found', { code: 'ENCOUNTER_NOT_FOUND' });
    }
    if (!readScopeOk(encounter.departmentId, authContext)) {
      throw new AuthorizationError('Not permitted to read clinical records for this encounter.');
    }

    const page = query.page || 1;
    const limit = query.pageSize || 50;
    const offset = (page - 1) * limit;

    const rows = await db.query.clinicalRecords.findMany({
      where: eq(clinicalRecords.encounterId, encounterId),
      orderBy: [desc(clinicalRecords.createdAt)],
      limit,
      offset,
    });

    const total = await db.$count(clinicalRecords, eq(clinicalRecords.encounterId, encounterId));

    await this.logAccess(
      'LIST',
      encounterId,
      undefined,
      encounter.patientId,
      actorId,
      correlationId,
      authContext,
    );

    return {
      data: rows.map(toResponse),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Single read. Record MUST belong to :encounterId. One access event per request. */
  async getClinicalRecord(
    encounterId: string,
    recordId: string,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    const encounter = await db.query.encounters.findFirst({
      where: eq(encounters.id, encounterId),
    });
    if (!encounter) {
      throw new NotFoundError('Encounter not found', { code: 'ENCOUNTER_NOT_FOUND' });
    }
    if (!readScopeOk(encounter.departmentId, authContext)) {
      throw new AuthorizationError('Not permitted to read clinical records for this encounter.');
    }

    const record = await db.query.clinicalRecords.findFirst({
      where: and(eq(clinicalRecords.id, recordId), eq(clinicalRecords.encounterId, encounterId)),
    });
    if (!record) {
      throw new NotFoundError('Clinical record not found', { code: 'CLINICAL_RECORD_NOT_FOUND' });
    }

    await this.logAccess(
      'READ',
      encounterId,
      recordId,
      record.patientId,
      actorId,
      correlationId,
      authContext,
    );

    return toResponse(record);
  }

  /**
   * Updates a DRAFT record. Author-only (both roles); physician must be the
   * assigned doctor; nurse restricted to own-department vital_signs drafts.
   * Guarded predicate enforces draft-status + expectedVersion.
   */
  async updateClinicalRecord(
    encounterId: string,
    recordId: string,
    payload: UpdateClinicalRecordRequest,
    editorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    const encounter = await db.query.encounters.findFirst({
      where: eq(encounters.id, encounterId),
    });
    if (!encounter) {
      throw new NotFoundError('Encounter not found', { code: 'ENCOUNTER_NOT_FOUND' });
    }

    const existing = await db.query.clinicalRecords.findFirst({
      where: and(eq(clinicalRecords.id, recordId), eq(clinicalRecords.encounterId, encounterId)),
    });
    if (!existing) {
      throw new NotFoundError('Clinical record not found', { code: 'CLINICAL_RECORD_NOT_FOUND' });
    }

    // Author-only editing (ADR-015 Decision 7), both roles.
    if (existing.createdBy !== editorId) {
      throw new AuthorizationError('Only the record author may edit a draft.');
    }
    if (authContext.role === 'physician') {
      if (encounter.doctorId !== editorId) {
        throw new AuthorizationError('Only the assigned physician may edit this record.');
      }
    } else if (authContext.role === 'nurse') {
      if (encounter.departmentId !== authContext.departmentId) {
        throw new AuthorizationError('Nurses may only edit within their department.');
      }
      if (existing.recordType !== 'vital_signs') {
        throw new AuthorizationError('Nurses may only edit vital_signs records.');
      }
    } else {
      throw new AuthorizationError('Not permitted to edit clinical records.');
    }

    // Validate provided content against the STORED record type (ADR-015).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let validatedContent: any = undefined;
    if (payload.content !== undefined) {
      const schema = contentSchemasByType[existing.recordType];
      const parsed = schema.safeParse(payload.content);
      if (!parsed.success) {
        throw new ConflictError('Provided content does not match the record type.', {
          code: 'VALIDATION_ERROR',
        });
      }
      validatedContent = parsed.data;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let validatedVitals: any = undefined;
    if (payload.vitals !== undefined) {
      if (existing.recordType !== 'vital_signs') {
        throw new ConflictError('Vitals values are only valid on vital_signs records.', {
          code: 'VALIDATION_ERROR',
        });
      }
      const parsed = vitalsSchema.safeParse(payload.vitals);
      if (!parsed.success) {
        throw new ConflictError('Invalid vital sign values.', { code: 'VALIDATION_ERROR' });
      }
      validatedVitals = parsed.data;
    }

    return await db.transaction(async (tx) => {
      const now = new Date();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setValues: Record<string, any> = {
        updatedAt: now,
        version: existing.version + 1,
      };
      if (validatedContent !== undefined) setValues.content = validatedContent;
      if (validatedVitals !== undefined) setValues.vitals = validatedVitals;

      const updated = await tx
        .update(clinicalRecords)
        .set(setValues)
        .where(
          and(
            eq(clinicalRecords.id, recordId),
            eq(clinicalRecords.version, payload.expectedVersion),
            eq(clinicalRecords.status, 'draft'), // immutability guard
          ),
        )
        .returning();

      if (updated.length === 0) {
        // Classify against a FRESH in-tx read (the snapshot may be stale).
        const fresh = await tx.query.clinicalRecords.findFirst({
          where: eq(clinicalRecords.id, recordId),
        });
        if (!fresh || fresh.version !== payload.expectedVersion) {
          throw new ConflictError('Record was modified concurrently.', {
            code: 'VERSION_CONFLICT',
          });
        }
        throw new ConflictError(
          `Cannot update a record in status '${fresh.status}' — signed records are immutable.`,
          { code: 'INVALID_TRANSITION' },
        );
      }

      await auditService.logEvent(
        {
          eventType: 'CLINICAL_RECORD_DRAFT_UPDATED',
          actorId: editorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'CLINICAL_RECORD',
          targetId: recordId,
          patientId: existing.patientId,
          actionDetail: {
            encounterId,
            recordType: existing.recordType,
            resultingVersion: existing.version + 1,
          },
        },
        correlationId,
        tx,
      );

      return toResponse(updated[0]);
    });
  }

  /**
   * Signs a DRAFT record. Physician + record author only.
   * Sign increments version (ADR-015 Decision 5); signed records immutable.
   */
  async signClinicalRecord(
    encounterId: string,
    recordId: string,
    expectedVersion: number,
    signerId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    if (authContext.role !== 'physician') {
      throw new AuthorizationError('Only physicians may sign clinical records.');
    }

    const existing = await db.query.clinicalRecords.findFirst({
      where: and(eq(clinicalRecords.id, recordId), eq(clinicalRecords.encounterId, encounterId)),
    });
    if (!existing) {
      throw new NotFoundError('Clinical record not found', { code: 'CLINICAL_RECORD_NOT_FOUND' });
    }
    if (existing.createdBy !== signerId) {
      throw new AuthorizationError('Only the record author may sign their draft.');
    }

    return await db.transaction(async (tx) => {
      const now = new Date();
      const signed = await tx
        .update(clinicalRecords)
        .set({
          status: 'signed',
          signedBy: signerId,
          signedAt: now,
          updatedAt: now,
          version: existing.version + 1,
        })
        .where(
          and(
            eq(clinicalRecords.id, recordId),
            eq(clinicalRecords.version, expectedVersion),
            eq(clinicalRecords.status, 'draft'), // immutability guard
          ),
        )
        .returning();

      if (signed.length === 0) {
        // Classify against a FRESH in-tx read (the snapshot may be stale).
        const fresh = await tx.query.clinicalRecords.findFirst({
          where: eq(clinicalRecords.id, recordId),
        });
        if (!fresh || fresh.version !== expectedVersion) {
          throw new ConflictError('Record was modified concurrently.', {
            code: 'VERSION_CONFLICT',
          });
        }
        throw new ConflictError(`Cannot sign a record in status '${fresh.status}'.`, {
          code: 'INVALID_TRANSITION',
        });
      }

      await auditService.logEvent(
        {
          eventType: 'CLINICAL_NOTE_SIGNED',
          actorId: signerId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'CLINICAL_RECORD',
          targetId: recordId,
          patientId: existing.patientId,
          actionDetail: {
            encounterId,
            recordType: existing.recordType,
            resultingVersion: existing.version + 1,
          },
        },
        correlationId,
        tx,
      );

      return toResponse(signed[0]);
    });
  }

  /** Access logging: own transaction, one event per request, metadata only. */
  private async logAccess(
    action: 'LIST' | 'READ',
    encounterId: string,
    recordId: string | undefined,
    patientId: string,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ): Promise<void> {
    await auditService.logEvent(
      {
        eventType: 'CLINICAL_RECORD_ACCESSED',
        actorId,
        actorRole: authContext.role,
        actorDepartment: authContext.departmentId,
        targetType: 'CLINICAL_RECORD',
        targetId: recordId,
        patientId,
        actionDetail: { action, encounterId },
      },
      correlationId,
    );
  }
}

export type { ClinicalStatus };

export const clinicalService = new ClinicalService();
