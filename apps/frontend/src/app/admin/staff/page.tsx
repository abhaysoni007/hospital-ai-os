'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { UserCheck, UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button/Button';

export default function StaffAdminPage() {
  return (
    <AppShell
      breadcrumbs={['Administration', 'Staff Management']}
      requiredPermission="staff:manage"
    >
      <EmptyState
        icon={<UserCheck size={32} />}
        title="Staff & Role Administration"
        description="Provision accounts, assign departmental roles, and manage hospital workforce credentials."
        action={
          <Button variant="primary" size="md" iconLeft={<UserPlus size={16} />}>
            Add Staff Member
          </Button>
        }
      />
    </AppShell>
  );
}
