/**
 * M5 Authorization — rbac module public API
 */

export type { Permission, StaffRole } from './permissions';
export { ROLE_PERMISSIONS, VALID_PERMISSIONS, VALID_ROLES } from './permissions';

export type { AuthorizationContext } from './authorization-context';
export { toAuthorizationContext } from './authorization-context';

export type { PolicyDecision } from './policy-engine';
export { evaluatePermission, getGrantedPermissions } from './policy-engine';
