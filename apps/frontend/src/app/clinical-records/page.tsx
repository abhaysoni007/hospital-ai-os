'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { FileText, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';

export default function ClinicalRecordsPage() {
  return (
    <AppShell
      breadcrumbs={['Clinical', 'Clinical Records']}
      requiredPermission="clinical_record:read"
    >
      <EmptyState
        icon={<FileText size={32} />}
        title="Electronic Health Records (EHR)"
        description="Structured SOAP progress notes, surgical reports, telemetry logs, and signed discharge summaries."
        action={
          <Button variant="primary" size="md" iconLeft={<Plus size={16} />}>
            Create Progress Note
          </Button>
        }
      />
    </AppShell>
  );
}
