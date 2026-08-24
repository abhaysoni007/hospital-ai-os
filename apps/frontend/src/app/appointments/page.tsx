'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';

export default function AppointmentsPage() {
  return (
    <AppShell breadcrumbs={['Operations', 'Appointments']} requiredPermission="appointment:read">
      <EmptyState
        icon={<Calendar size={32} />}
        title="Outpatient Appointments Queue"
        description="Schedule, verify, and manage clinic appointments across hospital departments."
        action={
          <Button variant="primary" size="md" iconLeft={<Plus size={16} />}>
            Book Appointment
          </Button>
        }
      />
    </AppShell>
  );
}
