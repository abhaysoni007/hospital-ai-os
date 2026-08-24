'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Sparkles, Bot } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';

export default function AIWorkspacePage() {
  return (
    <AppShell
      breadcrumbs={['Workspace', 'AI Clinical Workspace']}
      requiredPermission="ai_interaction:invoke"
    >
      <EmptyState
        icon={<Sparkles size={32} />}
        title="AI Clinical Intelligence Workspace"
        description="Side-by-side clinical documentation drafting, telemetry synthesis, and chart search assistance."
        action={
          <Button variant="primary" size="md" iconLeft={<Bot size={16} />}>
            Start New AI Note Draft
          </Button>
        }
      />
    </AppShell>
  );
}
