'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Sparkles } from 'lucide-react';

/**
 * M13 — Honest placeholder. Governed AI assistance (M12) lives inside the
 * encounter workspace where clinical decisions happen; there is deliberately
 * no standalone chat surface. Chart search arrives with a later milestone.
 */
export default function AiWorkspacePage() {
  return (
    <AppShell
      breadcrumbs={['Workspace', 'AI Assistance']}
      requiredPermission="ai_interaction:invoke"
    >
      <EmptyState
        icon={<Sparkles size={32} />}
        title="AI assistance works inside encounters"
        description="SOURCE-GROUNDED note drafting is available inside an active encounter you are assigned to. There is no separate AI chat — intelligence appears where clinical decisions are made."
      />
    </AppShell>
  );
}
