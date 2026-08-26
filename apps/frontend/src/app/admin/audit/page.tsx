'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { ShieldAlert } from 'lucide-react';

/**
 * M13 — Honest placeholder. The hash-chained audit ledger exists (M7), but a
 * reader-facing audit viewer endpoint is not implemented (M20 scope). This
 * screen never pretends otherwise.
 */
export default function AuditPage() {
  return (
    <AppShell breadcrumbs={['Administration', 'Audit']} requiredPermission="audit_event:read">
      <EmptyState
        icon={<ShieldAlert size={32} />}
        title="Audit log viewer — coming in a future release"
        description="Every clinical and security action is already recorded in the tamper-evident audit ledger. A searchable viewer will be enabled with the administration milestone."
      />
    </AppShell>
  );
}
