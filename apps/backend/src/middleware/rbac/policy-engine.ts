/**
 * M5 Authorization — Policy Engine
 *
 * Pure, deterministic policy evaluator.
 * - No Express dependency
 * - No database access
 * - No network calls
 * - No randomness
 * - No hidden global state
 *
 * FAIL-CLOSED CONTRACT:
 * Any unknown role, unknown permission, undefined/null input, or policy error
 * MUST produce { allowed: false, code: 'DENIED' }.
 * ALLOW is NEVER the fallback. The default security posture is DENY.
 *
 * M5 answers: "Does this authenticated role possess this permission?"
 * M6+ answers: "Is this specific resource within the permitted scope?"
 *
 * PolicyDecision.code is an internal discriminant.
 * It MUST NOT be exposed to API clients (the error-handler returns 403 with
 * the safe M3 AuthorizationError — no internal reason is surfaced).
 */

import { ROLE_PERMISSIONS, VALID_PERMISSIONS, VALID_ROLES } from './permissions';
import type { Permission, StaffRole } from './permissions';
import type { AuthorizationContext } from './authorization-context';

// ---------------------------------------------------------------------------
// PolicyDecision
// ---------------------------------------------------------------------------

/**
 * Result of a policy evaluation.
 *
 * `code` is for INTERNAL use only (e.g., structured logging, test assertions).
 * It MUST NOT be forwarded to API clients. Clients receive only 403 Forbidden
 * via the M3 AuthorizationError / error-handler pipeline.
 */
export interface PolicyDecision {
  readonly allowed: boolean;
  readonly code: 'ALLOWED' | 'DENIED';
}

const ALLOW: PolicyDecision = { allowed: true, code: 'ALLOWED' } as const;
const DENY: PolicyDecision = { allowed: false, code: 'DENIED' } as const;

// ---------------------------------------------------------------------------
// Runtime guards
// ---------------------------------------------------------------------------

function isValidRole(role: unknown): role is StaffRole {
  return typeof role === 'string' && VALID_ROLES.includes(role as StaffRole);
}

function isValidPermission(permission: unknown): permission is Permission {
  return typeof permission === 'string' && VALID_PERMISSIONS.has(permission as Permission);
}

// ---------------------------------------------------------------------------
// Core evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates whether the given authorization context grants the requested
 * permission.
 *
 * Fail-closed: any invalid, unknown, or missing input returns DENY.
 * This function never throws — it returns DENY on any error path.
 */
export function evaluatePermission(
  ctx: AuthorizationContext | null | undefined,
  permission: Permission | null | undefined,
): PolicyDecision {
  try {
    // Guard: missing context → DENY
    if (ctx == null) {
      return DENY;
    }

    // Guard: unknown or invalid role → DENY (fail closed, zero permissions)
    if (!isValidRole(ctx.role)) {
      return DENY;
    }

    // Guard: unknown or invalid permission → DENY
    // Unknown permissions cannot be granted by any role.
    if (!isValidPermission(permission)) {
      return DENY;
    }

    const grantedPermissions = ROLE_PERMISSIONS[ctx.role];

    // Type-narrowed at this point — permission is a valid Permission
    if (grantedPermissions.has(permission)) {
      return ALLOW;
    }

    return DENY;
  } catch {
    // Any unexpected error → fail closed
    return DENY;
  }
}

/**
 * Returns the complete set of permissions granted to a given role.
 * Returns an empty set for unknown/invalid roles (fail-closed).
 * Intended for use in diagnostics and tests — not for policy enforcement.
 */
export function getGrantedPermissions(role: unknown): ReadonlySet<Permission> {
  if (!isValidRole(role)) {
    return new Set<Permission>();
  }
  return ROLE_PERMISSIONS[role];
}
