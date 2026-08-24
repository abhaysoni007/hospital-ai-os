'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Activity, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';

export default function DiagnosticsPage() {
  return (
    <AppShell
      breadcrumbs={['Clinical', 'Diagnostics & Lab Results']}
      requiredPermission="diagnostic_result:read"
    >
      <EmptyState
        icon={<Activity size={32} />}
        title="Laboratory & Diagnostic Orders"
        description="Pathology tests, panic lab values, radiological imaging, and technician verification queue."
        action={
          <Button variant="primary" size="md" iconLeft={<Plus size={16} />}>
            Order Diagnostic Test
          </Button>
        }
      />
    </AppShell>
  );
}
