'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { Lock, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/Button/Button';

export default function SecurityPage() {
  return (
    <AppShell
      breadcrumbs={['Administration', 'Security & Emergency Access']}
      requiredPermission="break_glass:review"
    >
      <EmptyState
        icon={<Lock size={32} />}
        title="Break-Glass & Security Review"
        description="Monitor emergency privilege escalations, active overrides, and system-wide security anomalies."
        action={
          <Button variant="danger" size="md" iconLeft={<AlertTriangle size={16} />}>
            Review Active Overrides
          </Button>
        }
      />
    </AppShell>
  );
}
