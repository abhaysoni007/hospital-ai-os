'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { CheckSquare } from 'lucide-react';

/**
 * M13 — Honest placeholder. The clinical task inbox requires the task module
 * (M14 scope); no task API is implemented. This screen never pretends
 * otherwise and offers no dead actions.
 */
export default function TasksPage() {
  return (
    <AppShell breadcrumbs={['Workspace', 'Tasks']} requiredPermission="task:read">
      <EmptyState
        icon={<CheckSquare size={32} />}
        title="Clinical task inbox — coming in a future release"
        description="Assigned clinical actions and sign-off requests will appear here once the task service is enabled. Critical lab results are already delivered through notifications."
      />
    </AppShell>
  );
}
