import { db } from '../../db';
import { patients } from '../../db/schema/patients';
import { desc, ilike, or, eq, and, sql } from 'drizzle-orm';
import { RegisterPatientRequest, GetPatientsQuery } from 'shared';
import { ConflictError, NotFoundError } from 'shared/src/errors/AppError';
import { auditService } from '../audit/audit.service';

export class PatientService {
  /**
   * Generates a unique Medical Record Number (MRN).
   * Format: MRN-YYYY-XXXXX
   */
  private async generateMRN(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `MRN-${year}-`;

    const latestPatient = await db.query.patients.findFirst({
      where: ilike(patients.mrn, `${prefix}%`),
      orderBy: [desc(patients.mrn)],
    });

    let sequence = 1;
    if (latestPatient && latestPatient.mrn) {
      const lastSequenceStr = latestPatient.mrn.split('-')[2];
      const lastSequence = parseInt(lastSequenceStr, 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    const paddedSequence = sequence.toString().padStart(5, '0');
    return `${prefix}${paddedSequence}`;
  }

  /**
   * Registers a new patient, generating an MRN and logging the action.
   */
  async registerPatient(payload: RegisterPatientRequest, creatorId: string, correlationId: string) {
    // Basic duplicate check (exact match on name and DOB or phone)
    const existing = await db.query.patients.findFirst({
      where: or(
        and(
          ilike(patients.firstName, payload.firstName),
          ilike(patients.lastName, payload.lastName),
          eq(patients.dateOfBirth, payload.dateOfBirth)
        ),
        eq(patients.phonePrimary, payload.phonePrimary)
      ),
    });

    if (existing) {
      throw new ConflictError(
        'A patient with similar details or same phone number already exists.',
        { code: 'DUPLICATE_PATIENT' }
      );
    }

    const mrn = await this.generateMRN();

    const [newPatient] = await db.insert(patients).values({
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
    }).returning();

    // Log the audit event synchronously
    await auditService.logEvent({
      eventType: 'PATIENT_REGISTERED',
      actorId: creatorId,
      actorRole: 'SYSTEM_USER', // In a real flow, this comes from the auth context
      actorDepartment: 'ADMISSIONS', // From auth context
      targetType: 'PATIENT',
      targetId: newPatient.id,
      patientId: newPatient.id,
      actionDetail: { mrn },
    }, correlationId);

    return newPatient;
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

    // Fuzzy search using pg_trgm (we'll simulate SIMILARITY for now if standard OR)
    if (query.query) {
      conditions.push(
        or(
          ilike(patients.firstName, `%${query.query}%`),
          ilike(patients.lastName, `%${query.query}%`),
          ilike(patients.mrn, `%${query.query}%`)
        )
      );
    }

    const results = await db.query.patients.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(patients.createdAt)],
      limit,
      offset,
    });

    const totalResult = await db.$count(
      patients,
      conditions.length > 0 ? and(...conditions) : undefined
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

  async getPatientById(id: string) {
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, id),
    });

    if (!patient) {
      throw new NotFoundError('Patient not found', { code: 'PATIENT_NOT_FOUND' });
    }

    return patient;
  }
}

export const patientService = new PatientService();
