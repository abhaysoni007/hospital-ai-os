'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { UserCheck } from 'lucide-react';

/**
 * M13 — Honest placeholder. Staff administration endpoints are M20 scope;
 * no staff-management API is implemented beyond the read-only identity
 * projection. This screen never pretends otherwise.
 */
export default function StaffAdminPage() {
  return (
    <AppShell
      breadcrumbs={['Administration', 'Staff Management']}
      requiredPermission="staff:manage"
    >
      <EmptyState
        icon={<UserCheck size={32} />}
        title="Staff administration — coming in a future release"
        description="Account provisioning and role assignment will be available once the administration service is enabled."
      />
    </AppShell>
  );
}
