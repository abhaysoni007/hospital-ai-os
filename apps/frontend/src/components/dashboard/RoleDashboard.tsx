'use client';

import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PhysicianDashboard } from './PhysicianDashboard';
import { NursingDashboard } from './NursingDashboard';
import { PharmacistDashboard } from './PharmacistDashboard';
import { LabTechnicianDashboard } from './LabTechnicianDashboard';
import { ReceptionistDashboard } from './ReceptionistDashboard';
import { HospitalAdminDashboard } from './HospitalAdminDashboard';
import { SecurityAdminDashboard } from './SecurityAdminDashboard';

/**
 * Role-aware clinical and operational dashboard.
 * Selects the tailored dashboard view based exclusively on the authenticated user.role.
 * No synthetic data, no demo role switcher.
 */
export function RoleDashboard() {
  const { user } = useAuth();
  const role = user?.role;

  switch (role) {
    case 'lab_technician':
      return <LabTechnicianDashboard />;
    case 'receptionist':
      return <ReceptionistDashboard />;
    case 'security_admin':
      return <SecurityAdminDashboard />;
    case 'nurse':
      return <NursingDashboard />;
    case 'pharmacist':
      return <PharmacistDashboard />;
    case 'hospital_admin':
      return <HospitalAdminDashboard />;
    case 'physician':
      return <PhysicianDashboard />;
    default:
      return null;
  }
}

/** Backward-compatible alias for existing imports and tests */
export const DashboardShell = RoleDashboard;
