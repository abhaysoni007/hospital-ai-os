import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { breakGlassSessions } from '../../db/schema/break-glass';
import { patients } from '../../db/schema/patients';
import { encounters } from '../../db/schema/appointments';
import { auditService } from '../audit/audit.service';
import { AuthorizationError, ConflictError, NotFoundError } from 'shared/src/errors/AppError';
import { ROLE_PERMISSIONS, StaffRole } from '../../middleware/rbac/permissions';

type AuthContext = { role: string; departmentId: string };
const BREAK_GLASS_MAX_DURATION_HOURS = 4;

export class BreakGlassService {
  async activateSession(
    payload: { patientId: string; encounterId?: string; reason: 'emergency_care' | 'patient_safety' | 'continuity_of_care'; justification: string },
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    if (!ROLE_PERMISSIONS[authContext.role as StaffRole]?.has('break_glass:activate')) {
      throw new AuthorizationError('You are not authorized to activate break-glass emergency access.');
    }
    
    // Explicitly enforce physician or nurse (per M5) just to be absolutely sure
    if (authContext.role !== 'physician' && authContext.role !== 'nurse') {
      throw new AuthorizationError('Only physicians and nurses may activate break-glass.');
    }

    if (!payload.justification || payload.justification.length < 20 || payload.justification.length > 2000) {
      throw new ConflictError('Justification must be between 20 and 2000 characters.');
    }

    return await db.transaction(async (tx) => {
      // Advisory lock based on actorId and patientId to prevent concurrent activations by same user for same patient
      // Drizzle requires sql`...` to be executed
      await tx.execute(sql`SELECT pg_advisory_xact_lock( hashtext(${actorId} || ${payload.patientId}) )`);

      const patient = await tx.query.patients.findFirst({
        where: eq(patients.id, payload.patientId)
      });
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      if (payload.encounterId) {
        const encounter = await tx.query.encounters.findFirst({
          where: eq(encounters.id, payload.encounterId)
        });
        if (!encounter || encounter.patientId !== payload.patientId) {
          throw new ConflictError('Encounter not found or does not belong to patient.');
        }
      }

      // Check if active session exists
      const activeSession = await tx.query.breakGlassSessions.findFirst({
        where: and(
          eq(breakGlassSessions.staffId, actorId),
          eq(breakGlassSessions.patientId, payload.patientId),
          isNull(breakGlassSessions.revokedAt),
          sql`expires_at > now()`
        )
      });

      if (activeSession) {
        throw new ConflictError('An active break-glass session already exists for this patient.', { code: 'DUPLICATE_ACTIVE_SESSION' });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + BREAK_GLASS_MAX_DURATION_HOURS * 60 * 60 * 1000);

      const [session] = await tx
        .insert(breakGlassSessions)
        .values({
          staffId: actorId,
          patientId: payload.patientId,
          encounterId: payload.encounterId || null,
          reason: payload.reason,
          justification: payload.justification,
          grantedScope: { patientId: payload.patientId, encounterId: payload.encounterId || null, operation: 'read' },
          isActive: true,
          activatedAt: now,
          expiresAt: expiresAt
        })
        .returning();

      // Audit
      await auditService.logEvent(
        {
          eventType: 'BREAK_GLASS_ACTIVATED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'BREAK_GLASS_SESSION',
          targetId: session.id,
          patientId: payload.patientId,
          actionDetail: {
            reason: payload.reason,
            expiresAt: expiresAt.toISOString()
          }
        },
        correlationId,
        tx
      );

      const { justification: _j1, ...sessionPublic } = session;
      return { ...sessionPublic, actorId: session.staffId, staffId: undefined };
    });
  }

  async revokeSession(sessionId: string, actorId: string, correlationId: string, authContext: AuthContext) {
    if (!ROLE_PERMISSIONS[authContext.role as StaffRole]?.has('break_glass:review')) {
      throw new AuthorizationError('You are not authorized to revoke break-glass sessions.');
    }

    return await db.transaction(async (tx) => {
      // Row lock
      const sessionList = await tx.execute(sql`SELECT * FROM break_glass_sessions WHERE id = ${sessionId} FOR UPDATE`);
      if (sessionList.length === 0) {
        throw new NotFoundError('Break-glass session not found.');
      }
      // Raw SQL returns snake_case column names
      const rawSession = sessionList[0] as Record<string, any>;

      if (rawSession.revoked_at) {
        throw new ConflictError('Session is already revoked.', { code: 'ALREADY_REVOKED' });
      }
      
      const now = new Date();
      if (new Date(rawSession.expires_at) <= now) {
        throw new ConflictError('Cannot revoke an expired session.', { code: 'ALREADY_EXPIRED' });
      }

      const [revoked] = await tx
        .update(breakGlassSessions)
        .set({ revokedAt: now })
        .where(eq(breakGlassSessions.id, sessionId))
        .returning();

      const patientIdForAudit = rawSession.patient_id as string;

      await auditService.logEvent(
        {
          eventType: 'BREAK_GLASS_REVOKED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'BREAK_GLASS_SESSION',
          targetId: sessionId,
          patientId: patientIdForAudit
        },
        correlationId,
        tx
      );

      const { justification: _j2, ...revokedPublic } = revoked;
      return { ...revokedPublic, actorId: revoked.staffId, staffId: undefined };
    });
  }

  async reviewSession(sessionId: string, actorId: string, correlationId: string, authContext: AuthContext) {
    if (!ROLE_PERMISSIONS[authContext.role as StaffRole]?.has('break_glass:review')) {
      throw new AuthorizationError('You are not authorized to review break-glass sessions.');
    }

    return await db.transaction(async (tx) => {
      const sessionList = await tx.execute(sql`SELECT * FROM break_glass_sessions WHERE id = ${sessionId} FOR UPDATE`);
      if (sessionList.length === 0) {
        throw new NotFoundError('Break-glass session not found.');
      }
      const rawSessionR = sessionList[0] as Record<string, any>;

      if (rawSessionR.reviewed_at) {
        throw new ConflictError('Session is already reviewed.');
      }

      const now = new Date();
      const [reviewed] = await tx
        .update(breakGlassSessions)
        .set({ reviewedAt: now, reviewedBy: actorId })
        .where(eq(breakGlassSessions.id, sessionId))
        .returning();

      await auditService.logEvent(
        {
          eventType: 'BREAK_GLASS_REVIEWED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'BREAK_GLASS_SESSION',
          targetId: sessionId,
          patientId: rawSessionR.patient_id as string
        },
        correlationId,
        tx
      );

      const { justification: _j3, ...reviewedPublic } = reviewed;
      return { ...reviewedPublic, actorId: reviewed.staffId, staffId: undefined };
    });
  }

  async listSessions(authContext: AuthContext) {
    if (!ROLE_PERMISSIONS[authContext.role as StaffRole]?.has('break_glass:review')) {
      throw new AuthorizationError('You are not authorized to view break-glass sessions.');
    }
    const rows = await db.query.breakGlassSessions.findMany({
      orderBy: [desc(breakGlassSessions.activatedAt)]
    });

    return rows.map(r => {
      const { justification: _jList, staffId: _s, ...rest } = r;
      return { ...rest, actorId: r.staffId };
    });
  }
}

export const breakGlassService = new BreakGlassService();
