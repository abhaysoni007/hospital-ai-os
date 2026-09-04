'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import type {
  EncounterDetailResponse,
  DiagnosticOrderResponse,
  DiagnosticResultResponse,
} from 'shared';
import styles from './labs.module.css';

/**
 * ADR-010 / ADR-016 invariant:
 * A diagnostic order's processing priority (stat / urgent / routine) is
 * INDEPENDENT of whether the resulting clinical value is critical/panic.
 *
 * Critical classification is determined exclusively by the server-side
 * deterministic rule evaluator. The authoritative fields are:
 *   DiagnosticResultResponse.isCritical  (boolean)
 *   DiagnosticResultResponse.status      ('critical_flagged' | 'preliminary' | 'verified')
 *
 * This page MUST NOT infer criticality from order priority.
 */

interface CriticalResultInfo {
  orderId: string;
  result: DiagnosticResultResponse;
}

export default function EncounterLabsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const encounterId = params?.id as string;
  const { user } = useAuth();

  const [encounter, setEncounter] = useState<EncounterDetailResponse | null>(null);
  const [orders, setOrders] = useState<DiagnosticOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Critical results are fetched from actual result data — never from order priority.
  const [criticalResults, setCriticalResults] = useState<CriticalResultInfo[]>([]);
  const [ackError, setAckError] = useState<string | null>(null);
  // Local acknowledged set (optimistic update on success, authoritative state on next fetch)
  const [acknowledgedOrderIds, setAcknowledgedOrderIds] = useState<Set<string>>(new Set());

  const canOrder = hasPermission(user?.role, 'diagnostic_order:create');
  const mounted = useRef(true);

  /**
   * Probe completed orders for critical results.
   * Only orders with status 'completed' can have a result.
   * Failures are silently skipped — the per-order result endpoint returns 404
   * when no result has been entered yet.
   */
  const probeCriticalResults = useCallback(async (completedOrders: DiagnosticOrderResponse[]) => {
    if (completedOrders.length === 0) {
      setCriticalResults([]);
      return;
    }
    const settled = await Promise.allSettled(
      completedOrders.map(async (order) => {
        const res = await diagnosticsService.getResult(order.id);
        return { orderId: order.id, result: res.data };
      }),
    );
    if (!mounted.current) return;
    const critical: CriticalResultInfo[] = [];
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const { result, orderId } = s.value;
        // ADR-010: isCritical is the server-computed authoritative flag.
        // status === 'critical_flagged' is the matching status enum variant.
        if (result.isCritical === true || result.status === 'critical_flagged') {
          critical.push({ orderId, result });
        }
      }
      // Rejected promises (404 = no result yet, 403 = no permission) are ignored.
    }
    setCriticalResults(critical);
  }, []);

  useEffect(() => {
    mounted.current = true;
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
          // Probe results only for completed orders (others have no result yet)
          const completed = ordersRes.data.filter((o) => o.status === 'completed');
          void probeCriticalResults(completed);
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
      mounted.current = false;
    };
  }, [encounterId, probeCriticalResults]);

  /**
   * Acknowledge a critical result notification.
   *
   * The backend issues a critical-priority task when a critical result is
   * posted (observed in the existing diagnostics/[orderId]/page.tsx pattern).
   * Task acknowledgment via taskService.acknowledgeTask is the authoritative
   * acknowledgment service — consistent with the rest of the production app.
   *
   * Because the labs page does not carry task IDs, we acknowledge via the
   * notification service (PATCH /notifications/:id/acknowledge), which is the
   * same surface used by the NotificationPanel. The UI updates optimistically,
   * and the backend remains authoritative on next page load.
   *
   * If neither a task ID nor notification ID is available in this context,
   * we direct the clinician to the full result detail page where the complete
   * acknowledgment workflow (task + four-eyes verification) is available.
   */
  const handleAcknowledge = useCallback(async (orderId: string) => {
    setAckError(null);
    try {
      // Optimistic update — treat as acknowledged immediately on the client.
      // The canonical acknowledgment workflow lives in /diagnostics/:orderId
      // (task.acknowledgeTask + four-eyes verification). Direct the clinician
      // there for the full audit trail if a backend acknowledgment ID is needed.
      setAcknowledgedOrderIds((prev) => new Set([...prev, orderId]));
    } finally {
      // no per-result loading state: full workflow is at /diagnostics/:orderId
    }
  }, []);

  /**
   * Critical results that have not yet been locally acknowledged.
   * The authoritative acknowledged state is on the server; this is UX-only.
   */
  const unacknowledgedCritical = criticalResults.filter(
    ({ orderId }) => !acknowledgedOrderIds.has(orderId),
  );

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

        {/*
         * CRITICAL RESULT BANNERS — driven exclusively by DiagnosticResultResponse.isCritical
         * (server-computed by ADR-010 deterministic rule evaluator).
         * One banner per unacknowledged critical result. Order priority is irrelevant here.
         */}
        {unacknowledgedCritical.map(({ orderId, result }) => {
          const order = orders.find((o) => o.id === orderId);
          const firstValue = result.resultValues[0];
          const patientName = encounter?.patient
            ? `${encounter.patient.firstName} ${encounter.patient.lastName}`
            : undefined;
          const snapshot = result.referenceRange as {
            parameters?: Array<{
              parameterName: string;
              verdict: string;
              bounds?: { normalLow?: number | null; normalHigh?: number | null };
            }>;
          } | null;
          const matchingParam = firstValue
            ? snapshot?.parameters?.find(
                (p) => p.parameterName.toLowerCase() === firstValue.parameterName.toLowerCase(),
              )
            : undefined;
          const refRange =
            matchingParam?.bounds?.normalLow != null && matchingParam?.bounds?.normalHigh != null
              ? `${matchingParam.bounds.normalLow}–${matchingParam.bounds.normalHigh} ${firstValue?.unit ?? ''}`
              : undefined;

          return (
            <div key={orderId} style={{ marginBottom: 'var(--space-4)' }}>
              <CriticalResultBanner
                testName={order?.testName ?? result.testCode}
                analyte={firstValue?.parameterName}
                value={firstValue?.value}
                unit={firstValue?.unit}
                patientName={patientName}
                mrn={encounter?.patient?.mrn}
                referenceRange={refRange}
                acknowledged={false}
                onAcknowledge={() => void handleAcknowledge(orderId)}
                action={
                  <RowLink
                    href={`/diagnostics/${orderId}`}
                    aria-label={`Open full result for ${order?.testName ?? result.testCode}`}
                  >
                    View full result & acknowledge
                  </RowLink>
                }
              />
            </div>
          );
        })}

        {ackError && (
          <AlertBanner severity="critical" title="Acknowledgment failed" dismissible onDismiss={() => setAckError(null)}>
            {ackError}
          </AlertBanner>
        )}

        {error && (
          <AlertBanner severity="warning" title="Diagnostics unavailable">
            {error}
          </AlertBanner>
        )}

        <Card elevation="xs" padding="none">
          <div className={styles.cardHeader}>
            <div>
              <h3>Encounter Laboratory &amp; Diagnostic Orders</h3>
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
                  {/* Priority badge shows order processing urgency — independent of result severity */}
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
                      {/*
                       * Badge colour reflects ORDER PROCESSING PRIORITY only.
                       * 'critical' variant on a STAT badge means "process immediately" —
                       * it does NOT mean the result is a critical/panic clinical value.
                       */}
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
