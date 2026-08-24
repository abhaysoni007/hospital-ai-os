'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Stethoscope, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';

export default function EncountersPage() {
  return (
    <AppShell breadcrumbs={['Operations', 'Encounters']} requiredPermission="encounter:read">
      <EmptyState
        icon={<Stethoscope size={32} />}
        title="Clinical Encounters"
        description="Active inpatient admissions, emergency consultations, and outpatient visits."
        action={
          <Button variant="primary" size="md" iconLeft={<Plus size={16} />}>
            Start New Encounter
          </Button>
        }
      />
    </AppShell>
  );
}
