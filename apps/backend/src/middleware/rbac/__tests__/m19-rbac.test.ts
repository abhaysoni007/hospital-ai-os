import { describe, it, expect } from 'vitest';
import { evaluatePermission } from '../policy-engine';
import { VALID_PERMISSIONS, StaffRole } from '../permissions';
import type { AuthorizationContext } from '../authorization-context';

function makeCtx(role: StaffRole, staffId = 'staff-m19-test', departmentId = 'dept-m19-test'): AuthorizationContext {
  return { staffId, role, departmentId };
}

describe('M19 RBAC — Hospital Intelligence Permissions', () => {
  it('registers all 3 intelligence permissions in VALID_PERMISSIONS', () => {
    expect(VALID_PERMISSIONS.has('intelligence:read')).toBe(true);
    expect(VALID_PERMISSIONS.has('intelligence:analyze')).toBe(true);
    expect(VALID_PERMISSIONS.has('intelligence:approve')).toBe(true);
  });

  describe('Physician role', () => {
    it('grants intelligence:read, intelligence:analyze, and intelligence:approve', () => {
      const ctx = makeCtx('physician');
      expect(evaluatePermission(ctx, 'intelligence:read')).toEqual({ allowed: true, code: 'ALLOWED' });
      expect(evaluatePermission(ctx, 'intelligence:analyze')).toEqual({ allowed: true, code: 'ALLOWED' });
      expect(evaluatePermission(ctx, 'intelligence:approve')).toEqual({ allowed: true, code: 'ALLOWED' });
    });
  });

  describe('Nurse role (least privilege)', () => {
    it('grants intelligence:read ONLY — CANNOT analyze or approve', () => {
      const ctx = makeCtx('nurse');
      expect(evaluatePermission(ctx, 'intelligence:read')).toEqual({ allowed: true, code: 'ALLOWED' });
      expect(evaluatePermission(ctx, 'intelligence:analyze')).toEqual({ allowed: false, code: 'DENIED' });
      expect(evaluatePermission(ctx, 'intelligence:approve')).toEqual({ allowed: false, code: 'DENIED' });
    });
  });

  describe('Hospital Admin role', () => {
    it('grants intelligence:read, intelligence:analyze, and intelligence:approve', () => {
      const ctx = makeCtx('hospital_admin');
      expect(evaluatePermission(ctx, 'intelligence:read')).toEqual({ allowed: true, code: 'ALLOWED' });
      expect(evaluatePermission(ctx, 'intelligence:analyze')).toEqual({ allowed: true, code: 'ALLOWED' });
      expect(evaluatePermission(ctx, 'intelligence:approve')).toEqual({ allowed: true, code: 'ALLOWED' });
    });
  });

  describe('Non-operational roles (deny-by-default)', () => {
    const nonOperationalRoles: StaffRole[] = [
      'pharmacist',
      'lab_technician',
      'receptionist',
      'security_admin',
    ];

    for (const role of nonOperationalRoles) {
      it(`denies all intelligence permissions to ${role}`, () => {
        const ctx = makeCtx(role);
        expect(evaluatePermission(ctx, 'intelligence:read')).toEqual({ allowed: false, code: 'DENIED' });
        expect(evaluatePermission(ctx, 'intelligence:analyze')).toEqual({ allowed: false, code: 'DENIED' });
        expect(evaluatePermission(ctx, 'intelligence:approve')).toEqual({ allowed: false, code: 'DENIED' });
      });
    }
  });

  describe('Deny-by-default behavior', () => {
    it('denies when role is unrecognized', () => {
      const ctx = { staffId: '1', role: 'unknown_role' as StaffRole, departmentId: '1' };
      expect(evaluatePermission(ctx, 'intelligence:read')).toEqual({ allowed: false, code: 'DENIED' });
    });
  });
});
