'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { ShieldAlert, Download } from 'lucide-react';
import { Button } from '../../../components/ui/Button/Button';

export default function AuditPage() {
  return (
    <AppShell
      breadcrumbs={['Administration', 'Audit Log Viewer']}
      requiredPermission="audit_event:read"
    >
      <EmptyState
        icon={<ShieldAlert size={32} />}
        title="HIPAA Audit Trail & Security Logs"
        description="Immutable audit events recording access to patient records, authentication sessions, and system modifications."
        action={
          <Button variant="secondary" size="md" iconLeft={<Download size={16} />}>
            Export Audit Bundle
          </Button>
        }
      />
    </AppShell>
  );
}
