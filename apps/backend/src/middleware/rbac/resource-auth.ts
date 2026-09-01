import { db } from '../../db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { breakGlassSessions } from '../../db/schema/break-glass';
import { AuthorizationError } from 'shared/src/errors/AppError';

type AuthContext = { id: string; role: string; departmentId: string };

/**
 * Validates resource access with a fallback to Break-Glass emergency access.
 *
 * Flow:
 * 1. Attempt normal resource authorization scope.
 * 2. If scope denied, check for active Break-Glass session.
 * 3. Break-Glass is only allowed for READ operations.
 */
export async function authorizeBreakGlassResourceAccess(
  actor: AuthContext,
  patientId: string,
  operation: 'read' | 'write',
  normalScopeCheck: () => Promise<boolean> | boolean,
  encounterId?: string,
): Promise<{ authorized: boolean; breakGlassSessionId?: string }> {
  // 1. Attempt normal resource scope check
  try {
    const scopeAllowed = await normalScopeCheck();
    if (scopeAllowed) {
      return { authorized: true };
    }
  } catch (err) {
    if (!(err instanceof AuthorizationError)) {
      throw err;
    }
    // Fall through to Break-Glass on AuthorizationError
  }

  // 2. Normal scope denied. Is this operation eligible for Break-Glass?
  if (operation !== 'read') {
    throw new AuthorizationError(
      'Scope denied. Break-glass emergency access is strictly limited to read-only operations.',
    );
  }

  // 3. Check for active break-glass session
  const activeSession = await db.query.breakGlassSessions.findFirst({
    where: and(
      eq(breakGlassSessions.staffId, actor.id),
      eq(breakGlassSessions.patientId, patientId),
      isNull(breakGlassSessions.revokedAt),
      sql`expires_at > now()`,
    ),
  });

  if (activeSession) {
    if (encounterId && activeSession.encounterId && activeSession.encounterId !== encounterId) {
      throw new AuthorizationError('Break-glass session encounter mismatch.');
    }
    return { authorized: true, breakGlassSessionId: activeSession.id };
  }

  throw new AuthorizationError(
    'Access denied. Resource is outside your authorized scope and no active emergency access session exists.',
    [{ field: 'patientId', message: patientId }],
  );
}
