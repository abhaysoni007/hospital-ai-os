/**
 * Hospital AI OS — Frontend Authentication & RBAC Types
 * Synced with M4 (Auth) & M5 (RBAC) backend contracts
 */

export type StaffRole =
  | 'physician'
  | 'nurse'
  | 'pharmacist'
  | 'lab_technician'
  | 'receptionist'
  | 'hospital_admin'
  | 'security_admin';

export interface AuthUser {
  id: string;
  email: string;
  role: StaffRole;
  departmentId: string;
  firstName?: string;
  lastName?: string;
  status?: string;
}

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
  // Break-glass resource
  | 'break_glass:activate'
  | 'break_glass:review'
  // Task resource
  | 'task:read'
  | 'task:update'
  // Intelligence resource (M19.1)
  | 'intelligence:read'
  | 'intelligence:analyze'
  | 'intelligence:approve';

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
