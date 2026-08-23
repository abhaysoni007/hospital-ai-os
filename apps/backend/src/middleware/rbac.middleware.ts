/**
 * M5 Authorization — RBAC Middleware
 *
 * Provides requirePermission(permission) — a factory that returns an Express
 * RequestHandler enforcing a single permission check.
 *
 * Request pipeline position:
 *   M4 authMiddleware (sets req.user)
 *     → M5 requirePermission(...) (this file)
 *       → [Controller Handler]
 *
 * Authorization semantics:
 *   - req.user absent          → 401 (authMiddleware should have caught this first;
 *                                      defensive guard added here)
 *   - req.user present, DENY  → 403 AuthorizationError (→ error-handler → 403)
 *   - req.user present, ALLOW → next()
 *
 * Security invariants:
 *   - Reads ONLY from req.user (set by M4 JWT validation).
 *   - Does NOT read role/staffId/departmentId from req.body, req.query,
 *     req.params, or any custom header.
 *   - Does NOT decode JWTs.
 *   - Does NOT implement authentication.
 *   - Does NOT expose PolicyDecision internals to clients.
 *   - Fails closed: any missing/invalid state → deny, never allow.
 *
 * Logging:
 *   - Uses M3 logger exclusively.
 *   - Logs ONLY: role, permission, allowed (boolean).
 *   - Does NOT log: staffId, departmentId, PHI, tokens, passwords, headers.
 *   - Log level: 'warn' on denial (security event), 'debug' on allow.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthorizationError } from 'shared';
import { logger } from '../logger';
import { toAuthorizationContext } from './rbac/authorization-context';
import { evaluatePermission } from './rbac/policy-engine';
import type { Permission } from './rbac/permissions';

export type { Permission } from './rbac/permissions';
export { requirePermission };

function requirePermission(permission: Permission): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Defensive guard: req.user must be set by M4 authMiddleware.
    // If it is absent, the authentication boundary was not applied.
    // Return 401 — this is an authentication failure, not authorization.
    if (!req.user) {
      _res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const ctx = toAuthorizationContext(req.user);
    const decision = evaluatePermission(ctx, permission);

    if (!decision.allowed) {
      // Log minimal safe metadata: role + permission + outcome.
      // No staffId, no departmentId, no tokens, no PHI.
      logger.warn({ role: ctx.role, permission, allowed: false }, 'Authorization denied');

      // Throw via M3 error pipeline → 403 Forbidden.
      // Client receives only the safe AuthorizationError response.
      // PolicyDecision internals (code) are never surfaced.
      next(new AuthorizationError('Insufficient permissions'));
      return;
    }

    // Log allow at debug level (high-frequency path — avoid info-level noise)
    logger.debug({ role: ctx.role, permission, allowed: true }, 'Authorization granted');

    next();
  };
}
