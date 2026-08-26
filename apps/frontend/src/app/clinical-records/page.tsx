'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { FileText, Lock } from 'lucide-react';

/**
 * M13 — Honest placeholder. Encounter-scoped clinical documentation lives
 * inside each encounter workspace; a cross-encounter record index is not part
 * of any implemented backend capability (M9 scope). No fake data, no dead CTAs.
 */
export default function ClinicalRecordsPage() {
  return (
    <AppShell breadcrumbs={['Clinical', 'Records']} requiredPermission="clinical_record:read">
      <EmptyState
        icon={<FileText size={32} />}
        title="Clinical records live inside encounters"
        description="SOAP notes, progress notes, and vitals are documented within each encounter workspace. Open a patient's active encounter to view or continue documentation."
      />
      <p className="sr-only">
        <Lock aria-hidden="true" /> Signed records are immutable.
      </p>
    </AppShell>
  );
}
