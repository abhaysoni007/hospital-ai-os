'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Activity } from 'lucide-react';

/**
 * M19.1 — Honest placeholder. Hospital Intelligence Center arrives with M19.4.
 * Signals and recommendations are currently in foundation stage.
 */
export default function IntelligencePage() {
  return (
    <AppShell
      breadcrumbs={['Operations', 'Intelligence']}
      requiredPermission="intelligence:read"
    >
      <EmptyState
        icon={<Activity size={32} />}
        title="Hospital Intelligence Center"
        description="Deterministic workflow bottleneck detection and governed AI assistance foundation is established. Full operational analytics dashboard arrives with M19.4."
      />
    </AppShell>
  );
}
