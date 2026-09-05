import { describe, expect, it } from 'vitest';

import { ALL_NAV_ITEMS, getNavItemsForRole, hasPermission } from '../rbac';
import type { StaffRole } from '../../types/auth';

/**
 * M13 — navigation contract tests.
 * The sidebar must ONLY advertise destinations that are implemented AND
 * permitted for the role. Unimplemented modules (tasks inbox, AI workspace
 * index, staff admin, audit viewer, break-glass review) must never appear,
 * regardless of role.
 */
describe('M13 navigation contract', () => {
  const IMPLEMENTED_PREFIXES = [
    '/dashboard',
    '/patients',
    '/appointments',
    '/encounters',
    '/intelligence',
    '/diagnostics',
    '/tasks',
  ];

  it('every nav item resolves to an implemented destination', () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(IMPLEMENTED_PREFIXES.some((p) => item.href.startsWith(p))).toBe(true);
    }
  });

  it('exposes no fake badges or counts', () => {
    for (const item of ALL_NAV_ITEMS) {
      expect((item as unknown as { badge?: string | number }).badge).toBeUndefined();
    }
  });

  const roles: StaffRole[] = [
    'physician',
    'nurse',
    'pharmacist',
    'lab_technician',
    'receptionist',
    'hospital_admin',
    'security_admin',
  ];

  it('every role sees at least the dashboard', () => {
    for (const role of roles) {
      const items = getNavItemsForRole(role);
      expect(items.map((i) => i.href)).toContain('/dashboard');
    }
  });

  it('lab queue requires diagnostic_order:read — pharmacists are never shown it', () => {
    const diagnosticsItem = ALL_NAV_ITEMS.find((i) => i.id === 'diagnostics');
    expect(diagnosticsItem?.requiredPermission).toBe('diagnostic_order:read');

    expect(hasPermission('pharmacist', 'diagnostic_result:read')).toBe(true);
    expect(hasPermission('pharmacist', 'diagnostic_order:read')).toBe(false);

    const pharmacistItems = getNavItemsForRole('pharmacist').map((i) => i.href);
    expect(pharmacistItems).not.toContain('/diagnostics');
  });

  it('intelligence requires intelligence:read — receptionists and pharmacists are never shown it', () => {
    const intelligenceItem = ALL_NAV_ITEMS.find((i) => i.id === 'intelligence');
    expect(intelligenceItem?.requiredPermission).toBe('intelligence:read');

    expect(hasPermission('receptionist', 'intelligence:read')).toBe(false);
    expect(hasPermission('pharmacist', 'intelligence:read')).toBe(false);
    expect(hasPermission('physician', 'intelligence:read')).toBe(true);
    expect(hasPermission('nurse', 'intelligence:read')).toBe(true);
    expect(hasPermission('hospital_admin', 'intelligence:read')).toBe(true);

    const receptionistItems = getNavItemsForRole('receptionist').map((i) => i.href);
    expect(receptionistItems).not.toContain('/intelligence');

    const physicianItems = getNavItemsForRole('physician').map((i) => i.href);
    expect(physicianItems).toContain('/intelligence');
  });

  it('receptionists see scheduling surfaces but not clinical AI or lab internals', () => {
    const items = getNavItemsForRole('receptionist').map((i) => i.href);
    expect(items).toEqual(expect.arrayContaining(['/patients', '/appointments', '/encounters']));
    expect(items).not.toContain('/diagnostics');
  });

  it('physicians see the full operational surface', () => {
    const items = getNavItemsForRole('physician').map((i) => i.href);
    expect(items).toEqual(expect.arrayContaining(['/patients', '/encounters', '/diagnostics']));
  });

  it('security_admin sees only honest, implemented destinations', () => {
    const items = getNavItemsForRole('security_admin').map((i) => i.href);
    expect(items).toEqual(['/dashboard', '/tasks']);
  });

  it('returns empty nav for unauthenticated users rather than leaking structure', () => {
    expect(getNavItemsForRole(undefined)).toEqual([]);
  });

  describe('strict least-privilege RBAC matrix', () => {
    it('appointment:create is granted ONLY to receptionist', () => {
      expect(hasPermission('receptionist', 'appointment:create')).toBe(true);
      expect(hasPermission('physician', 'appointment:create')).toBe(false);
      expect(hasPermission('nurse', 'appointment:create')).toBe(false);
      expect(hasPermission('lab_technician', 'appointment:create')).toBe(false);
      expect(hasPermission('pharmacist', 'appointment:create')).toBe(false);
      expect(hasPermission('hospital_admin', 'appointment:create')).toBe(false);
      expect(hasPermission('security_admin', 'appointment:create')).toBe(false);
    });

    it('diagnostic_order:read is granted ONLY to clinical order consumers', () => {
      expect(hasPermission('physician', 'diagnostic_order:read')).toBe(true);
      expect(hasPermission('nurse', 'diagnostic_order:read')).toBe(true);
      expect(hasPermission('lab_technician', 'diagnostic_order:read')).toBe(true);

      // Non-clinical or non-ordering roles must NEVER hold diagnostic_order:read
      expect(hasPermission('hospital_admin', 'diagnostic_order:read')).toBe(false);
      expect(hasPermission('security_admin', 'diagnostic_order:read')).toBe(false);
      expect(hasPermission('pharmacist', 'diagnostic_order:read')).toBe(false);
      expect(hasPermission('receptionist', 'diagnostic_order:read')).toBe(false);
    });

    it('security_admin never holds clinical read permissions', () => {
      expect(hasPermission('security_admin', 'audit_event:read')).toBe(true);
      expect(hasPermission('security_admin', 'break_glass:review')).toBe(true);
      expect(hasPermission('security_admin', 'task:read')).toBe(true);

      expect(hasPermission('security_admin', 'diagnostic_order:read')).toBe(false);
      expect(hasPermission('security_admin', 'encounter:read')).toBe(false);
      expect(hasPermission('security_admin', 'clinical_record:read')).toBe(false);
      expect(hasPermission('security_admin', 'appointment:create')).toBe(false);
    });

    it('hospital_admin holds operational oversight but not clinical ordering or booking creation', () => {
      expect(hasPermission('hospital_admin', 'appointment:read')).toBe(true);
      expect(hasPermission('hospital_admin', 'encounter:read')).toBe(true);
      expect(hasPermission('hospital_admin', 'staff:manage')).toBe(true);

      expect(hasPermission('hospital_admin', 'appointment:create')).toBe(false);
      expect(hasPermission('hospital_admin', 'diagnostic_order:read')).toBe(false);
    });
  });
});
