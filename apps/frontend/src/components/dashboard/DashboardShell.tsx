'use client';

import React from 'react';
import { RoleDashboard } from './RoleDashboard';

/**
 * DashboardShell is the authoritative role dashboard shell.
 * It renders the appropriate Lovable-designed role workspace based on user.role.
 */
export function DashboardShell() {
  return <RoleDashboard />;
}

export default DashboardShell;
