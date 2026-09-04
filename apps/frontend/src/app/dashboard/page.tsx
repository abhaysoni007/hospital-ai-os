'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { RoleDashboard } from '../../components/dashboard/RoleDashboard';

export default function DashboardPage() {
  return (
    <AppShell breadcrumbs={['Operations', 'Dashboard']}>
      <RoleDashboard />
    </AppShell>
  );
}
