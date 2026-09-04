'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { AppShell } from '../../../../components/layout/AppShell/AppShell';
import { PatientHeader, CriticalResultBanner } from '../../../../components/clinical/LovableClinical';
import { Card, CardContent } from '../../../../components/ui/Card/Card';
import { Badge } from '../../../../components/ui/Badge/Badge';
import { Button } from '../../../../components/ui/Button/Button';
import { Table, THead, TH, TBody, TR, TD, RowLink, TableSkeleton } from '../../../../components/ui/Table/Table';
import { AlertBanner } from '../../../../components/ui/Alert/AlertBanner';
import { encounterService } from '../../../../services/encounter-service';
import { diagnosticsService } from '../../../../services/diagnostics-service';
import { computeAgeYears } from '../../../../utils/dashboard';
import { useAuth } from '../../../../hooks/useAuth';
import { hasPermission } from '../../../../utils/rbac';
import type { EncounterDetailResponse, DiagnosticOrderResponse } from 'shared';
import styles from './labs.module.css';

export default function EncounterLabsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const encounterId = params?.id as string;
  const { user } = useAuth();

  const [encounter, setEncounter] = useState<EncounterDetailResponse | null>(null);
  const [orders, setOrders] = useState<DiagnosticOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canOrder = hasPermission(user?.role, 'diagnostic_order:create');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      encounterService.getEncounterById(encounterId),
      diagnosticsService.getEncounterOrders(encounterId),
    ])
      .then(([encRes, ordersRes]) => {
        if (!cancelled) {
          setEncounter(encRes.data);
          setOrders(ordersRes.data);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load diagnostic orders for this encounter.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [encounterId]);

  const hasCriticalOrder = orders.some((o) => o.priority === 'stat');

  return (
    <AppShell
      breadcrumbs={['Operations', 'Encounters', encounter?.patient?.mrn ?? encounterId, 'Diagnostics']}
      requiredPermission="diagnostic_order:read"
    >
      <div className={styles.container}>
        <div className={styles.navRow}>
          <Link href={`/encounters/${encounterId}`} className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to encounter overview
          </Link>
        </div>

        {encounter?.patient && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <PatientHeader
              patient={{
                name: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
                mrn: encounter.patient.mrn,
                age: computeAgeYears(encounter.patient.dateOfBirth) ?? undefined,
                gender: encounter.patient.gender,
              }}
              actions={
                canOrder && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push(`/encounters/${encounterId}/diagnostics/new`)}
                    iconLeft={<Plus size={14} />}
                  >
                    Order Lab Test
                  </Button>
                )
              }
            />
          </div>
        )}

        {hasCriticalOrder && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <CriticalResultBanner
              testName="STAT Diagnostic Order Flagged"
              parameter="Immediate Clinical Action Required"
              value="CRITICAL"
              unit=""
              referenceRange="Normal"
              acknowledged={false}
            />
          </div>
        )}

        {error && (
          <AlertBanner severity="warning" title="Diagnostics unavailable">
            {error}
          </AlertBanner>
        )}

        <Card elevation="xs" padding="none">
          <div className={styles.cardHeader}>
            <div>
              <h3>Encounter Laboratory & Diagnostic Orders</h3>
              <p>Ordered tests, specimen processing, and verified results</p>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={4} />
          ) : orders.length === 0 ? (
            <CardContent>
              <p className={styles.emptyNote}>
                No diagnostic orders requested for this encounter.
              </p>
            </CardContent>
          ) : (
            <Table ariaLabel="Diagnostic Orders">
              <THead>
                <tr>
                  <TH>Test Name</TH>
                  <TH>Code</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH>Ordered At</TH>
                  <TH align="right">Action</TH>
                </tr>
              </THead>
              <TBody>
                {orders.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <span style={{ fontWeight: 600 }}>{o.testName}</span>
                      {o.clinicalIndication && (
                        <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-neutral-500)' }}>
                          {o.clinicalIndication}
                        </span>
                      )}
                    </TD>
                    <TD>
                      <code style={{ fontSize: '0.8125rem' }}>{o.testCode}</code>
                    </TD>
                    <TD>
                      <Badge variant={o.priority === 'stat' ? 'critical' : o.priority === 'urgent' ? 'urgent' : 'neutral'} size="sm">
                        {o.priority.toUpperCase()}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge variant={o.status === 'completed' ? 'stable' : o.status === 'in_progress' ? 'info' : 'neutral'} size="sm">
                        {o.status.replace('_', ' ')}
                      </Badge>
                    </TD>
                    <TD>{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TD>
                    <TD align="right">
                      <RowLink href={`/diagnostics/${o.id}`} aria-label={`View order ${o.testCode}`}>
                        View Details
                      </RowLink>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
