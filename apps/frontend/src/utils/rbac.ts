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
  badge?: string | number;
  section: 'operations' | 'clinical' | 'workspace' | 'administration';
  requiredPermission?: Permission;
  requiredRoles?: StaffRole[];
}

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
    id: 'clinical-records',
    label: 'Clinical Records',
    href: '/clinical-records',
    iconName: 'FileText',
    section: 'clinical',
    requiredPermission: 'clinical_record:read',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    href: '/diagnostics',
    iconName: 'Activity',
    section: 'clinical',
    requiredPermission: 'diagnostic_result:read',
  },

  // Workspace Section
  {
    id: 'tasks',
    label: 'Tasks',
    href: '/tasks',
    iconName: 'CheckSquare',
    section: 'workspace',
    requiredPermission: 'task:read',
    badge: '6',
  },
  {
    id: 'ai-workspace',
    label: 'AI Workspace',
    href: '/ai-workspace',
    iconName: 'Sparkles',
    section: 'workspace',
    requiredPermission: 'ai_interaction:invoke',
    badge: 'Beta',
  },

  // Administration Section
  {
    id: 'staff-admin',
    label: 'Staff Management',
    href: '/admin/staff',
    iconName: 'UserCheck',
    section: 'administration',
    requiredPermission: 'staff:manage',
  },
  {
    id: 'audit-log',
    label: 'Audit Log',
    href: '/admin/audit',
    iconName: 'ShieldAlert',
    section: 'administration',
    requiredPermission: 'audit_event:read',
  },
  {
    id: 'security',
    label: 'Security & Access',
    href: '/admin/security',
    iconName: 'Lock',
    section: 'administration',
    requiredPermission: 'break_glass:review',
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
    if (item.requiredRoles && !item.requiredRoles.includes(role)) {
      return false;
    }
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
