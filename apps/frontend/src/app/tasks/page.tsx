'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { CheckSquare, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';

export default function TasksPage() {
  return (
    <AppShell breadcrumbs={['Workspace', 'Clinical Tasks']} requiredPermission="task:read">
      <EmptyState
        icon={<CheckSquare size={32} />}
        title="Clinical Task Inbox"
        description="Assigned clinical actions, sign-off requests, urgent lab review items, and ward duties."
        action={
          <Button variant="primary" size="md" iconLeft={<Plus size={16} />}>
            Create Task
          </Button>
        }
      />
    </AppShell>
  );
}
