'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { Lock } from 'lucide-react';

/**
 * M13 — Honest placeholder. Break-glass review belongs to the emergency-access
 * workflow (M15 scope); no review API is implemented. This screen never
 * pretends otherwise.
 */
export default function SecurityAdminPage() {
  return (
    <AppShell breadcrumbs={['Administration', 'Security']} requiredPermission="break_glass:review">
      <EmptyState
        icon={<Lock size={32} />}
        title="Emergency access review — coming in a future release"
        description="Break-glass activation is already audited end to end. The review console for security administrators will be enabled with the emergency-access milestone."
      />
    </AppShell>
  );
}
