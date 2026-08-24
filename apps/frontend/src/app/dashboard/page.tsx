'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { DashboardShell } from '../../components/dashboard/DashboardShell';

export default function DashboardPage() {
  return (
    <AppShell breadcrumbs={['Operations', 'Dashboard']}>
      <DashboardShell />
    </AppShell>
  );
}
