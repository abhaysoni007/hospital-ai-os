/**
 * M5 Authorization — Authorization Context
 *
 * AuthorizationContext carries only the minimum fields required for policy
 * evaluation. It is derived from the M4 AuthenticatedPrincipal (req.user).
 *
 * IMPORTANT:
 * - departmentId is retained for downstream resource/scope checks (M6+).
 * - departmentId MUST NOT be treated as proof that a resource belongs to the
 *   user's permitted department. M5 does NOT perform resource-to-department
 *   authorization. That check remains in M6+ service/controller layers.
 * - The context is sourced exclusively from M4's authenticated principal.
 *   Client-supplied role, staffId, or departmentId MUST NOT be trusted.
 */

import type { AuthenticatedPrincipal } from '../../modules/auth/auth.service';
import type { StaffRole } from './permissions';

export interface AuthorizationContext {
  /** Staff identifier — sourced from M4 JWT sub claim */
  readonly staffId: string;
  /** Role — sourced from M4 JWT role claim; used for RBAC evaluation */
  readonly role: StaffRole;
  /**
   * Department identifier — retained from M4 JWT for downstream M6+ scope checks.
   * NOT used by M5 policy engine for resource-level department filtering.
   */
  readonly departmentId: string;
}

/**
 * Constructs an AuthorizationContext from the M4 AuthenticatedPrincipal.
 *
 * Trusts only the authenticated principal produced by M4's authMiddleware.
 * Does NOT read or trust anything from req.body, req.query, req.params,
 * or any custom request header.
 */
export function toAuthorizationContext(principal: AuthenticatedPrincipal): AuthorizationContext {
  return {
    staffId: principal.staffId,
    role: principal.role as StaffRole,
    departmentId: principal.departmentId,
  };
}
