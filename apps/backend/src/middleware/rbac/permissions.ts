/**
 * M5 Authorization — Permission Vocabulary & Role-Permission Matrix
 *
 * SOURCE OF TRUTH: security-architecture.md §2.2, §2.3 and api-architecture.md §2.*
 *
 * Permissions follow the resource:action structure.
 * Scope (e.g., :department, :assigned) is NOT evaluated here.
 * M5 answers: "Does this role possess this permission?"
 * M6+ answers: "Is this specific resource within the permitted scope?"
 *
 * IMPORTANT: This is STATIC CODE CONFIGURATION.
 * Do NOT create roles/permissions/role_permissions database tables.
 */

// ---------------------------------------------------------------------------
// Roles — exactly the values defined in the M2 staff_role enum (enums.ts)
// ---------------------------------------------------------------------------
export type StaffRole =
  | 'physician'
  | 'nurse'
  | 'pharmacist'
  | 'lab_technician'
  | 'receptionist'
  | 'hospital_admin'
  | 'security_admin';

/** All valid staff roles as a readonly tuple for runtime validation */
export const VALID_ROLES: readonly StaffRole[] = [
  'physician',
  'nurse',
  'pharmacist',
  'lab_technician',
  'receptionist',
  'hospital_admin',
  'security_admin',
] as const;

// ---------------------------------------------------------------------------
// Permissions — resource:action pairs
// Derived from security-architecture.md §2.3 and api-architecture.md §2.*
// ---------------------------------------------------------------------------
export type Permission =
  // Patient resource
  | 'patient:read'
  | 'patient:create'
  | 'patient:update'
  | 'patient:verify_identity'
  // Clinical record resource
  | 'clinical_record:read'
  | 'clinical_record:write'
  | 'clinical_record:sign'
  // Diagnostic order resource
  | 'diagnostic_order:create'
  | 'diagnostic_order:read'
  | 'diagnostic_order:update'
  | 'diagnostic_order:cancel'
  // Diagnostic result resource
  | 'diagnostic_result:read'
  | 'diagnostic_result:enter'
  | 'diagnostic_result:verify'
  // Encounter resource
  | 'encounter:create'
  | 'encounter:read'
  | 'encounter:update'
  | 'encounter:discharge'
  // Appointment resource
  | 'appointment:create'
  | 'appointment:read'
  | 'appointment:update'
  | 'appointment:cancel'
  // AI interaction resource
  | 'ai_interaction:invoke'
  // Staff management resource
  | 'staff:manage'
  // Audit resource
  | 'audit_event:read'
  // Break-glass resource (workflow belongs to M15; permissions defined here)
  | 'break_glass:activate'
  | 'break_glass:review'
  // Task resource
  | 'task:read'
  | 'task:update'
  // Intelligence resource (M19.1)
  | 'intelligence:read'
  | 'intelligence:analyze'
  | 'intelligence:approve';

/** All valid permissions as a readonly set for runtime validation */
export const VALID_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'patient:read',
  'patient:create',
  'patient:update',
  'patient:verify_identity',
  'clinical_record:read',
  'clinical_record:write',
  'clinical_record:sign',
  'diagnostic_order:create',
  'diagnostic_order:read',
  'diagnostic_order:update',
  'diagnostic_order:cancel',
  'diagnostic_result:read',
  'diagnostic_result:enter',
  'diagnostic_result:verify',
  'encounter:create',
  'encounter:read',
  'encounter:update',
  'encounter:discharge',
  'appointment:create',
  'appointment:read',
  'appointment:update',
  'appointment:cancel',
  'ai_interaction:invoke',
  'staff:manage',
  'audit_event:read',
  'break_glass:activate',
  'break_glass:review',
  'task:read',
  'task:update',
  'intelligence:read',
  'intelligence:analyze',
  'intelligence:approve',
]);

// ---------------------------------------------------------------------------
// Role → Permission Matrix
// SOURCE: security-architecture.md §2.3
//
// Each role receives ONLY the permissions explicitly listed in the
// architecture-defined matrix. There is NO implicit role hierarchy.
// hospital_admin ≠ all permissions, security_admin ≠ all permissions.
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS: Readonly<Record<StaffRole, ReadonlySet<Permission>>> = {
  physician: new Set<Permission>([
    'patient:read',
    'clinical_record:read',
    'clinical_record:write',
    'clinical_record:sign',
    'diagnostic_order:create',
    'diagnostic_order:read',
    // ADR-016 Decision 2: ordering physician, own order, pre-collection only.
    // Service enforces the conditions; this grant enables the capability.
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
    'intelligence:read',
    'intelligence:analyze',
    'intelligence:approve',
  ]),

  nurse: new Set<Permission>([
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
    'intelligence:read',
  ]),

  pharmacist: new Set<Permission>([
    'patient:read',
    'clinical_record:read',
    'diagnostic_result:read',
    'task:read',
    'task:update',
  ]),

  lab_technician: new Set<Permission>([
    'patient:read',
    'clinical_record:read',
    'diagnostic_order:read',
    'diagnostic_order:update',
    'diagnostic_result:read',
    'diagnostic_result:enter',
    'diagnostic_result:verify',
    'task:read',
    'task:update',
  ]),

  receptionist: new Set<Permission>([
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
  ]),

  hospital_admin: new Set<Permission>([
    'patient:read',
    'staff:manage',
    'audit_event:read',
    'appointment:read',
    'encounter:read',
    'task:read',
    'intelligence:read',
    'intelligence:analyze',
    'intelligence:approve',
  ]),

  security_admin: new Set<Permission>(['audit_event:read', 'break_glass:review', 'task:read']),
} as const;
