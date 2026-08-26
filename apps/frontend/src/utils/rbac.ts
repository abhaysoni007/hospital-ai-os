/**
 * Hospital AI OS — Frontend RBAC & Navigation Helpers
 *
 * NOTE: Frontend RBAC is exclusively for navigation, UX visibility, and client-side
 * affordances. Backend M5 remains the strict, authoritative security boundary.
 *
 * SOURCE OF TRUTH: apps/backend/src/middleware/rbac/permissions.ts & FIGMA_DESIGN_SPECIFICATION.md §7
 */

import { StaffRole, Permission } from '../types/auth';

/**
 * Role to Permission Mapping matching M5 Static Code Configuration
 */
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  physician: [
    'patient:read',
    'clinical_record:read',
    'clinical_record:write',
    'clinical_record:sign',
    'diagnostic_order:create',
    'diagnostic_order:read',
    // ADR-016 Decision 2 (mirror of backend matrix)
    'diagnostic_order:cancel',
    'diagnostic_result:read',
    'encounter:create',
    'encounter:read',
    'encounter:update',
    'encounter:discharge',
    'ai_interaction:invoke',
    'break_glass:activate',
    'task:read',
    'task:update',
  ],
  nurse: [
    'patient:read',
    'clinical_record:read',
    'clinical_record:write',
    'diagnostic_order:read',
    'diagnostic_result:read',
    'encounter:read',
    'encounter:update',
    'ai_interaction:invoke',
    'break_glass:activate',
    'task:read',
    'task:update',
  ],
  pharmacist: [
    'patient:read',
    'clinical_record:read',
    'diagnostic_result:read',
    'task:read',
    'task:update',
  ],
  lab_technician: [
    'patient:read',
    'clinical_record:read',
    'diagnostic_order:read',
    'diagnostic_order:update',
    'diagnostic_result:read',
    'diagnostic_result:enter',
    'diagnostic_result:verify',
    'task:read',
    'task:update',
  ],
  receptionist: [
    'patient:read',
    'patient:create',
    'patient:update',
    'patient:verify_identity',
    'appointment:create',
    'appointment:read',
    'appointment:update',
    'appointment:cancel',
    'encounter:create',
    'encounter:read',
    'task:read',
  ],
  hospital_admin: [
    'patient:read',
    'staff:manage',
    'audit_event:read',
    'appointment:read',
    'encounter:read',
    'task:read',
  ],
  security_admin: ['audit_event:read', 'break_glass:review', 'task:read'],
};

export interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  iconName: string;
  section: 'operations' | 'clinical' | 'workspace' | 'administration';
  requiredPermission?: Permission;
}

/**
 * M13 — Operational navigation contract.
 *
 * Every entry MUST resolve to an implemented, permission-gated backend
 * capability (M6–M12.2). Destinations whose modules are not yet implemented
 * (chart search / tasks inbox / AI workspace index / staff admin / audit
 * viewer / break-glass review — M14/M15/M20 scope) are deliberately absent:
 * an unimplemented screen must never be exposed as an operational destination.
 */
export const ALL_NAV_ITEMS: readonly NavItemConfig[] = [
  // Operations Section
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    iconName: 'LayoutDashboard',
    section: 'operations',
  },
  {
    id: 'patients',
    label: 'Patients',
    href: '/patients',
    iconName: 'Users',
    section: 'operations',
    requiredPermission: 'patient:read',
  },
  {
    id: 'appointments',
    label: 'Appointments',
    href: '/appointments',
    iconName: 'Calendar',
    section: 'operations',
    requiredPermission: 'appointment:read',
  },
  {
    id: 'encounters',
    label: 'Encounters',
    href: '/encounters',
    iconName: 'Stethoscope',
    section: 'operations',
    requiredPermission: 'encounter:read',
  },

  // Clinical Section
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    href: '/diagnostics',
    // Matches the lab-queue page gate AND the GET /diagnostic-orders backend
    // grant. Pharmacists hold result-read only and have no order-facing route,
    // so the nav must not advertise this destination to them.
    iconName: 'Activity',
    section: 'clinical',
    requiredPermission: 'diagnostic_order:read',
  },
] as const;

/**
 * Check if a role possesses a specific permission
 */
export function hasPermission(role: StaffRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Filter navigation items based on the user's role
 */
export function getNavItemsForRole(role: StaffRole | undefined): NavItemConfig[] {
  if (!role) return [];
  return ALL_NAV_ITEMS.filter((item) => {
    if (item.requiredPermission && !hasPermission(role, item.requiredPermission)) {
      return false;
    }
    return true;
  });
}

/**
 * Human-readable formatted role names for UI presentation
 */
export const ROLE_DISPLAY_NAMES: Record<StaffRole, string> = {
  physician: 'Attending Physician',
  nurse: 'Registered Nurse',
  pharmacist: 'Clinical Pharmacist',
  lab_technician: 'Lab Technician',
  receptionist: 'Receptionist / Registrar',
  hospital_admin: 'Hospital Administrator',
  security_admin: 'Security Administrator',
};
