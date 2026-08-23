/**
 * M5 Authorization — Policy Engine Matrix Tests
 *
 * MATRIX-DRIVEN: Tests every role × every permission combination.
 * For each role:
 *   1. Every explicitly GRANTED permission → ALLOW
 *   2. Every NOT-granted permission → DENY
 *
 * This proves there is NO accidental privilege expansion.
 *
 * Also covers:
 *   - Fail-closed: unknown/undefined/empty/malformed inputs → DENY
 *   - No fail-open: missing permission → DENY, policy error → DENY
 */

import { describe, it, expect } from 'vitest';
import { evaluatePermission, getGrantedPermissions } from '../policy-engine';
import {
  ROLE_PERMISSIONS,
  VALID_PERMISSIONS,
  VALID_ROLES,
  type Permission,
  type StaffRole,
} from '../permissions';
import type { AuthorizationContext } from '../authorization-context';

// ---------------------------------------------------------------------------
// Helper: build a minimal AuthorizationContext for a role
// ---------------------------------------------------------------------------
function makeCtx(
  role: string,
  staffId = 'staff-test-id',
  departmentId = 'dept-test-id',
): AuthorizationContext {
  return { staffId, role: role as StaffRole, departmentId };
}

// ---------------------------------------------------------------------------
// Matrix: extract all permissions for easy set operations
// ---------------------------------------------------------------------------
const ALL_PERMISSIONS = Array.from(VALID_PERMISSIONS) as Permission[];

// ---------------------------------------------------------------------------
// 1. Full matrix tests — all 7 roles × all 29 permissions
// ---------------------------------------------------------------------------
describe('Policy Engine — Role/Permission Matrix', () => {
  for (const role of VALID_ROLES) {
    describe(`Role: ${role}`, () => {
      const grantedSet = ROLE_PERMISSIONS[role];

      // Positive: explicitly granted permissions → ALLOW
      const grantedPermissions = Array.from(grantedSet) as Permission[];
      if (grantedPermissions.length > 0) {
        it(`grants ${grantedPermissions.length} explicit permissions`, () => {
          for (const permission of grantedPermissions) {
            const decision = evaluatePermission(makeCtx(role), permission);
            expect(decision, `${role} should be ALLOWED for ${permission}`).toEqual({
              allowed: true,
              code: 'ALLOWED',
            });
          }
        });
      }

      // Negative: permissions NOT in the role's set → DENY
      const deniedPermissions = ALL_PERMISSIONS.filter((p) => !grantedSet.has(p));
      if (deniedPermissions.length > 0) {
        it(`denies ${deniedPermissions.length} non-granted permissions`, () => {
          for (const permission of deniedPermissions) {
            const decision = evaluatePermission(makeCtx(role), permission);
            expect(decision, `${role} should be DENIED for ${permission}`).toEqual({
              allowed: false,
              code: 'DENIED',
            });
          }
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Privilege escalation tests (explicit cross-role)
// ---------------------------------------------------------------------------
describe('Policy Engine — Privilege Escalation Prevention', () => {
  it('physician CANNOT perform hospital_admin-only: staff:manage', () => {
    expect(evaluatePermission(makeCtx('physician'), 'staff:manage')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('nurse CANNOT perform physician-only: clinical_record:sign', () => {
    expect(evaluatePermission(makeCtx('nurse'), 'clinical_record:sign')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('nurse CANNOT perform physician-only: diagnostic_order:create', () => {
    expect(evaluatePermission(makeCtx('nurse'), 'diagnostic_order:create')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('nurse CANNOT perform physician-only: encounter:discharge', () => {
    expect(evaluatePermission(makeCtx('nurse'), 'encounter:discharge')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('receptionist CANNOT perform clinical_record:write', () => {
    expect(evaluatePermission(makeCtx('receptionist'), 'clinical_record:write')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('receptionist CANNOT perform clinical_record:sign', () => {
    expect(evaluatePermission(makeCtx('receptionist'), 'clinical_record:sign')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('pharmacist CANNOT perform diagnostic_result:enter', () => {
    expect(evaluatePermission(makeCtx('pharmacist'), 'diagnostic_result:enter')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('pharmacist CANNOT perform diagnostic_order:create', () => {
    expect(evaluatePermission(makeCtx('pharmacist'), 'diagnostic_order:create')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('hospital_admin does NOT automatically receive all clinical permissions', () => {
    const clinicalPermissions: Permission[] = [
      'clinical_record:write',
      'clinical_record:sign',
      'diagnostic_order:create',
      'diagnostic_result:enter',
      'encounter:discharge',
      'break_glass:activate',
    ];
    for (const perm of clinicalPermissions) {
      expect(
        evaluatePermission(makeCtx('hospital_admin'), perm),
        `hospital_admin should NOT have ${perm}`,
      ).toEqual({ allowed: false, code: 'DENIED' });
    }
  });

  it('security_admin does NOT automatically receive all permissions', () => {
    const adminPermissions: Permission[] = [
      'patient:create',
      'patient:update',
      'clinical_record:read',
      'clinical_record:write',
      'clinical_record:sign',
      'diagnostic_order:create',
      'encounter:create',
      'encounter:discharge',
      'staff:manage',
      'break_glass:activate',
      'ai_interaction:invoke',
    ];
    for (const perm of adminPermissions) {
      expect(
        evaluatePermission(makeCtx('security_admin'), perm),
        `security_admin should NOT have ${perm}`,
      ).toEqual({ allowed: false, code: 'DENIED' });
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Fail-closed tests
// ---------------------------------------------------------------------------
describe('Policy Engine — Fail-Closed (unknown/invalid inputs)', () => {
  // Unknown roles
  it('unknown role → DENY', () => {
    expect(evaluatePermission(makeCtx('unknown_role'), 'patient:read')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('empty string role → DENY', () => {
    expect(evaluatePermission(makeCtx(''), 'patient:read')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('malformed role (PHYSICIAN uppercase) → DENY', () => {
    expect(evaluatePermission(makeCtx('PHYSICIAN'), 'patient:read')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('malformed role (Physician mixed case) → DENY', () => {
    expect(evaluatePermission(makeCtx('Physician'), 'patient:read')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('role with whitespace → DENY', () => {
    expect(evaluatePermission(makeCtx(' physician '), 'patient:read')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('role with sql injection attempt → DENY', () => {
    expect(evaluatePermission(makeCtx("physician'; DROP TABLE staff; --"), 'patient:read')).toEqual(
      {
        allowed: false,
        code: 'DENIED',
      },
    );
  });

  // Unknown/invalid permissions
  it('unknown permission → DENY even for physician', () => {
    expect(evaluatePermission(makeCtx('physician'), 'patient:delete' as Permission)).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('empty permission string → DENY', () => {
    expect(evaluatePermission(makeCtx('physician'), '' as Permission)).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('malformed permission (no colon) → DENY', () => {
    expect(evaluatePermission(makeCtx('physician'), 'patientread' as Permission)).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('permission with extra scope token → DENY', () => {
    expect(
      evaluatePermission(makeCtx('physician'), 'patient:read:department' as Permission),
    ).toEqual({ allowed: false, code: 'DENIED' });
  });

  it('null permission → DENY', () => {
    expect(evaluatePermission(makeCtx('physician'), null)).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('undefined permission → DENY', () => {
    expect(evaluatePermission(makeCtx('physician'), undefined)).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  // Null/undefined context
  it('null context → DENY', () => {
    expect(evaluatePermission(null, 'patient:read')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  it('undefined context → DENY', () => {
    expect(evaluatePermission(undefined, 'patient:read')).toEqual({
      allowed: false,
      code: 'DENIED',
    });
  });

  // Malformed department ID — should not affect base RBAC (departmentId not used in M5)
  it('malformed departmentId does not affect base RBAC evaluation', () => {
    // physician with valid perm should still be ALLOWED regardless of departmentId format
    const ctxBadDept = makeCtx('physician', 'staff-id', 'not-a-uuid');
    expect(evaluatePermission(ctxBadDept, 'patient:read')).toEqual({
      allowed: true,
      code: 'ALLOWED',
    });
  });

  it('empty departmentId does not affect base RBAC evaluation', () => {
    const ctxEmptyDept = makeCtx('physician', 'staff-id', '');
    expect(evaluatePermission(ctxEmptyDept, 'patient:read')).toEqual({
      allowed: true,
      code: 'ALLOWED',
    });
  });
});

// ---------------------------------------------------------------------------
// 4. No implicit role hierarchy tests
// ---------------------------------------------------------------------------
describe('Policy Engine — No Implicit Role Hierarchy', () => {
  it('every role receives ONLY explicitly listed permissions (no extras)', () => {
    for (const role of VALID_ROLES) {
      const granted = getGrantedPermissions(role);
      const expected = ROLE_PERMISSIONS[role];

      // The sets must be identical
      expect(granted.size, `${role}: granted set size mismatch`).toBe(expected.size);
      for (const perm of expected) {
        expect(granted.has(perm), `${role}: should have ${perm}`).toBe(true);
      }
    }
  });

  it('unknown role has ZERO permissions', () => {
    const granted = getGrantedPermissions('super_admin');
    expect(granted.size).toBe(0);
  });

  it('undefined role has ZERO permissions', () => {
    const granted = getGrantedPermissions(undefined);
    expect(granted.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. PolicyDecision structure tests
// ---------------------------------------------------------------------------
describe('Policy Engine — PolicyDecision structure', () => {
  it('ALLOW decision has correct shape', () => {
    const result = evaluatePermission(makeCtx('physician'), 'patient:read');
    expect(result).toHaveProperty('allowed', true);
    expect(result).toHaveProperty('code', 'ALLOWED');
    // Must NOT expose internal reason strings
    expect(result).not.toHaveProperty('reason');
  });

  it('DENY decision has correct shape', () => {
    const result = evaluatePermission(makeCtx('receptionist'), 'clinical_record:sign');
    expect(result).toHaveProperty('allowed', false);
    expect(result).toHaveProperty('code', 'DENIED');
    // Must NOT expose internal reason strings
    expect(result).not.toHaveProperty('reason');
  });
});
