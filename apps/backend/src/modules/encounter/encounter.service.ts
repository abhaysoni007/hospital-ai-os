import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { appointments, encounters } from '../../db/schema/appointments';
import { patients } from '../../db/schema/patients';
import { staff } from '../../db/schema/staff';
import { CreateEncounterRequest, GetEncountersQuery, EncounterListItem } from 'shared';
import { AuthorizationError, ConflictError, NotFoundError } from 'shared/src/errors/AppError';
import { auditService } from '../audit/audit.service';
import type { Permission, StaffRole } from '../../middleware/rbac/permissions';
import { ROLE_PERMISSIONS } from '../../middleware/rbac/permissions';

type AuthContext = { role: string; departmentId: string };

function roleHasPermission(role: string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role as StaffRole] ?? new Set<Permission>()).has(permission);
}

export class EncounterService {
  /**
   * Creates a walk-in encounter (direct registration without appointment).
   * Check-in-created encounters are handled inside the appointment transaction.
   */
  async createEncounter(
    payload: CreateEncounterRequest,
    creatorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    // Scope: receptionists register within their own department only;
    // physicians may create in any department per the M5 matrix.
    if (authContext.role === 'receptionist' && payload.departmentId !== authContext.departmentId) {
      throw new AuthorizationError('Cannot register encounters outside your department.');
    }

    return await db.transaction(async (tx) => {
      const patient = await tx.query.patients.findFirst({
        where: eq(patients.id, payload.patientId),
      });
      if (!patient || patient.status !== 'active') {
        throw new NotFoundError('Patient not found', { code: 'PATIENT_NOT_FOUND' });
      }

      const doctor = await tx.query.staff.findFirst({ where: eq(staff.id, payload.doctorId) });
      if (!doctor || doctor.status !== 'active' || doctor.role !== 'physician') {
        throw new NotFoundError('Doctor not found', { code: 'DOCTOR_NOT_FOUND' });
      }

      const [encounter] = await tx
        .insert(encounters)
        .values({
          patientId: payload.patientId,
          doctorId: payload.doctorId,
          departmentId: payload.departmentId,
          encounterType: payload.encounterType,
          chiefComplaint: payload.chiefComplaint,
          status: 'registered',
          createdBy: creatorId,
        })
        .returning();

      await auditService.logEvent(
        {
          eventType: 'ENCOUNTER_CREATED',
          actorId: creatorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'ENCOUNTER',
          targetId: encounter.id,
          patientId: encounter.patientId,
          actionDetail: { encounterType: encounter.encounterType },
        },
        correlationId,
        tx,
      );

      return encounter;
    });
  }

  /**
   * Lists encounters. Scope enforcement is server-side and cannot be bypassed
   * by query parameters: non-admin roles are forced to their own department.
   */
  async listEncounters(query: GetEncountersQuery, authContext: AuthContext) {
    const page = query.page || 1;
    const limit = query.pageSize || 50;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (authContext.role !== 'hospital_admin') {
      conditions.push(eq(encounters.departmentId, authContext.departmentId));
    }
    if (query.patientId) conditions.push(eq(encounters.patientId, query.patientId));
    if (query.doctorId) conditions.push(eq(encounters.doctorId, query.doctorId));
    if (query.departmentId && authContext.role === 'hospital_admin') {
      conditions.push(eq(encounters.departmentId, query.departmentId));
    }
    if (query.status) conditions.push(eq(encounters.status, query.status));

    const rows = await db.query.encounters.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(encounters.createdAt)],
      limit,
      offset,
    });

    const total = await db.$count(
      encounters,
      conditions.length > 0 ? and(...conditions) : undefined,
    );

    const patientIds = [...new Set(rows.map((r) => r.patientId))];
    const patientRows = patientIds.length
      ? await db.query.patients.findMany({
          where: inArray(patients.id, patientIds),
          columns: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
        })
      : [];
    const patientById = new Map(patientRows.map((p) => [p.id, p]));

    const includeChief = roleHasPermission(authContext.role, 'clinical_record:read');

    const data: EncounterListItem[] = rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      doctorId: r.doctorId,
      departmentId: r.departmentId,
      encounterType: r.encounterType,
      status: r.status,
      startedAt: r.startedAt ? r.startedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      version: r.version,
      ...(includeChief && r.chiefComplaint ? { chiefComplaint: r.chiefComplaint } : {}),
      patient: patientById.get(r.patientId) ?? {
        id: r.patientId,
        mrn: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: 'undisclosed' as const,
      },
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * ADR-013 detail contract: metadata + bounded demographics ONLY.
   * - chiefComplaint present only for callers with clinical_record:read
   * - clinical/diagnostic data is NEVER embedded
   */
  async getEncounterDetail(id: string, authContext: AuthContext) {
    const encounter = await db.query.encounters.findFirst({ where: eq(encounters.id, id) });
    if (!encounter) {
      throw new NotFoundError('Encounter not found', { code: 'ENCOUNTER_NOT_FOUND' });
    }

    if (
      authContext.role !== 'hospital_admin' &&
      encounter.departmentId !== authContext.departmentId
    ) {
      throw new AuthorizationError('Encounter is outside your department.');
    }

    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, encounter.patientId),
      columns: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
      },
    });

    const linkedAppointment = await db.query.appointments.findFirst({
      where: eq(appointments.encounterId, id),
      columns: {
        id: true,
        scheduledDate: true,
        scheduledTime: true,
        tokenNumber: true,
        status: true,
      },
    });

    const includeChief = roleHasPermission(authContext.role, 'clinical_record:read');

    return {
      id: encounter.id,
      patientId: encounter.patientId,
      doctorId: encounter.doctorId,
      departmentId: encounter.departmentId,
      encounterType: encounter.encounterType,
      status: encounter.status,
      startedAt: encounter.startedAt ? encounter.startedAt.toISOString() : null,
      dischargedAt: encounter.dischargedAt ? encounter.dischargedAt.toISOString() : null,
      createdAt: encounter.createdAt.toISOString(),
      updatedAt: encounter.updatedAt.toISOString(),
      version: encounter.version,
      ...(includeChief && encounter.chiefComplaint
        ? { chiefComplaint: encounter.chiefComplaint }
        : {}),
      patient: patient ?? {
        id: encounter.patientId,
        mrn: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: 'undisclosed' as const,
      },
      appointment: linkedAppointment
        ? {
            id: linkedAppointment.id,
            scheduledDate: linkedAppointment.scheduledDate,
            scheduledTime: linkedAppointment.scheduledTime,
            tokenNumber: linkedAppointment.tokenNumber,
            status: linkedAppointment.status,
          }
        : null,
    };
  }

  /**
   * Activates a registered encounter (consultation start).
   * Scope: assigned physician OR same-department nurse.
   * Optimistic concurrency on `version`; stale version → 409 VERSION_CONFLICT.
   */
  async activateEncounter(
    id: string,
    expectedVersion: number,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.encounters.findFirst({ where: eq(encounters.id, id) });
      if (!existing) {
        throw new NotFoundError('Encounter not found', { code: 'ENCOUNTER_NOT_FOUND' });
      }

      // Service-level scope check (M5 deferral contract): assigned physician or
      // same-department nurse only.
      if (authContext.role === 'physician') {
        if (existing.doctorId !== actorId) {
          throw new AuthorizationError('Only the assigned physician may activate this encounter.');
        }
      } else if (authContext.role === 'nurse') {
        if (existing.departmentId !== authContext.departmentId) {
          throw new AuthorizationError('Nurse may only activate encounters in their department.');
        }
      } else {
        throw new AuthorizationError('Not permitted to activate this encounter.');
      }

      // Optimistic concurrency FIRST: attempt the version-guarded transition.
      const now = new Date();
      const updated = await tx
        .update(encounters)
        .set({
          status: 'active',
          startedAt: now,
          updatedAt: now,
          version: existing.version + 1,
        })
        .where(
          and(
            eq(encounters.id, id),
            eq(encounters.version, expectedVersion),
            eq(encounters.status, 'registered'),
          ),
        )
        .returning();

      if (updated.length === 0) {
        // Classify the conflict: a stale version is reported as VERSION_CONFLICT
        // (optimistic concurrency); an out-of-order state request as INVALID_TRANSITION.
        if (existing.version !== expectedVersion) {
          throw new ConflictError('Encounter was modified concurrently.', {
            code: 'VERSION_CONFLICT',
          });
        }
        throw new ConflictError(`Cannot activate an encounter in status '${existing.status}'.`, {
          code: 'INVALID_TRANSITION',
        });
      }

      await auditService.logEvent(
        {
          eventType: 'ENCOUNTER_ACTIVATED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'ENCOUNTER',
          targetId: id,
          patientId: existing.patientId,
          actionDetail: { previousVersion: existing.version, newVersion: existing.version + 1 },
        },
        correlationId,
        tx,
      );

      return updated[0];
    });
  }
}

export const encounterService = new EncounterService();
