'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { AppShell } from '../../../../components/layout/AppShell/AppShell';
import { PatientHeader, CriticalResultBanner } from '../../../../components/clinical/LovableClinical';
import { EncounterNavTabs } from '../../../../components/clinical/EncounterNavTabs';
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
import {
  isCriticalResult,
  matchAuthoritativeTask,
  isTaskAcknowledgedOnServer,
  determineCriticalAction,
  executeAuthoritativeAcknowledgment,
  classifyProbeError,
  resolveAuthoritativeCriticalTasks,
  CRITICAL_TASK_RESOLUTION_ERROR,
} from '../../../../utils/critical-result-acknowledgment';
import type {
  EncounterDetailResponse,
  DiagnosticOrderResponse,
  DiagnosticResultResponse,
  TaskResponse,
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
 *
 * Acknowledgment invariant:
 * A critical result MUST NOT be dismissed solely through local React state.
 * Acknowledgment MUST be server-authoritative via taskService.acknowledgeTask(taskId),
 * and the acknowledged presentation is derived ONLY from the server-returned task state.
 * When the task lookup RESOLVES with no authoritative critical-alert task for the current
 * user, the action is strictly navigation-only ('Review Critical Result' -> /diagnostics/[orderId]).
 * When the task lookup FAILS (403/500/network/malformed), the page fails closed: the banner
 * remains visible, unacknowledged, with a task-resolution error and retry — never navigation-only.
 */

interface CriticalResultInfo {
  orderId: string;
  result: DiagnosticResultResponse;
  authoritativeTask?: TaskResponse;
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
  const [probeError, setProbeError] = useState<string | null>(null);
  // Fail-closed task resolution: a failed lookup is NEVER presented as "no task".
  const [taskResolutionFailed, setTaskResolutionFailed] = useState(false);
  // Server-derived acknowledgment truth: only responses returned by
  // taskService.acknowledgeTask() are stored here. Local state never creates
  // an acknowledged presentation on its own.
  const [serverAcknowledgedTasks, setServerAcknowledgedTasks] = useState<
    Record<string, TaskResponse>
  >({});
  const [, setAckLoadingOrderId] = useState<string | null>(null);

  const canOrder = hasPermission(user?.role, 'diagnostic_order:create');
  const canReadDx = hasPermission(user?.role, 'diagnostic_order:read');
  const mounted = useRef(true);

  /**
   * Probe completed orders for critical results and attribute authoritative critical-alert tasks.
   * Only orders with status 'completed' can have a result.
   *
   * Error semantics:
   * - 404 (NOT_FOUND): Benign — no result entered yet for this order.
   * - 403 / 500 / network: Service failure — must NOT silently present as "no critical result".
   */
  const probeCriticalResults = useCallback(async (completedOrders: DiagnosticOrderResponse[]) => {
    if (!canReadDx && !hasPermission(user?.role, 'diagnostic_result:read')) {
      return;
    }
    if (completedOrders.length === 0) {
      setCriticalResults([]);
      setProbeError(null);
      setTaskResolutionFailed(false);
      return;
    }

    // Fail-safe resolution of the current clinician's authoritative critical-alert tasks.
    // A lookup failure (403/500/network/malformed) sets state 'failed' and MUST NOT be
    // interpreted as "there is no task" — navigation-only fallback is then forbidden.
    const resolution = await resolveAuthoritativeCriticalTasks();
    if (!mounted.current) return;
    const userTasks = resolution.state === 'resolved' ? resolution.tasks : [];
    setTaskResolutionFailed(resolution.state === 'failed');

    const settled = await Promise.allSettled(
      completedOrders.map(async (order) => {
        const res = await diagnosticsService.getResult(order.id);
        return { orderId: order.id, result: res.data };
      }),
    );
    if (!mounted.current) return;

    const critical: CriticalResultInfo[] = [];
    let hasServiceFailure = false;

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const { result, orderId } = s.value;
        // ADR-010: isCritical is the server-computed authoritative flag.
        // status === 'critical_flagged' is the matching status enum variant.
        if (isCriticalResult(result)) {
          const matchedTask = matchAuthoritativeTask(orderId, user?.id, userTasks);
          critical.push({ orderId, result, authoritativeTask: matchedTask });
        }
      } else {
        // Distinguish benign 404 from service/network failure
        const errorKind = classifyProbeError(s.reason);
        if (errorKind === 'SERVICE_FAILURE') {
          hasServiceFailure = true;
        }
      }
    }

    setCriticalResults(critical);
    if (hasServiceFailure) {
      setProbeError(
        'Some diagnostic results could not be checked. Please review the diagnostic workspace.',
      );
    } else {
      setProbeError(null);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!canReadDx) {
      setLoading(false);
      return;
    }
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
  }, [encounterId, canReadDx, probeCriticalResults]);

  /**
   * Acknowledge a critical result using the server-authoritative task acknowledgment service.
   *
   * Invariant: A critical result MUST NOT be dismissed locally without confirmed server transition.
   * If the server call fails, the banner remains visible and an error is shown.
   *
   * Presentation truth: only the TaskResponse returned by the server is stored; the UI
   * derives "acknowledged" from that server state via isTaskAcknowledgedOnServer().
   */
  const handleAcknowledge = useCallback(async (orderId: string, taskId: string) => {
    setAckError(null);
    setAckLoadingOrderId(orderId);
    try {
      const updatedTask = await executeAuthoritativeAcknowledgment(taskId);
      setServerAcknowledgedTasks((prev) => ({ ...prev, [taskId]: updatedTask }));
    } catch (err) {
      setAckError(
        (err as Error).message ||
          'Failed to acknowledge critical result on the server. The result remains unacknowledged.',
      );
    } finally {
      setAckLoadingOrderId(null);
    }
  }, []);

  /** Re-run the critical-result probe after a failed task resolution. */
  const handleRetryTaskResolution = useCallback(() => {
    void probeCriticalResults(orders.filter((o) => o.status === 'completed'));
  }, [orders, probeCriticalResults]);

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
                name: `${encounter.patient.firstName} ${encounter.patient.lastName}`.trim(),
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

        <EncounterNavTabs encounterId={encounterId} />

        {/*
         * CRITICAL RESULT BANNERS — driven exclusively by DiagnosticResultResponse.isCritical
         * (server-computed by ADR-010 deterministic rule evaluator).
         * Order priority is NEVER inspected here.
         *
         * Actions:
         * 1. Authoritative Task exists for current user (lookup resolved):
         *    - Explicit server acknowledgment via taskService.acknowledgeTask(taskId).
         *    - Banner remains visible if acknowledgment fails.
         * 2. Lookup resolved, no authoritative task exists for current user:
         *    - Strictly navigation-only ('Review Critical Result' -> /diagnostics/[orderId]).
         *    - NO local dismiss button is rendered.
         * 3. Task lookup FAILED (403/500/network/malformed):
         *    - Fail closed: banner remains visible and UNACKNOWLEDGED.
         *    - Task-resolution error is surfaced with retry; navigation-only is forbidden.
         */}
        {criticalResults.map(({ orderId, result, authoritativeTask }) => {
          const order = orders.find((o) => o.id === orderId);
          const firstValue = result.resultValues[0];
          const patientName = encounter?.patient
            ? `${encounter.patient.firstName} ${encounter.patient.lastName}`.trim()
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

          const effectiveTask = authoritativeTask
            ? serverAcknowledgedTasks[authoritativeTask.id] ?? authoritativeTask
            : undefined;
          const isAcknowledged = isTaskAcknowledgedOnServer(effectiveTask);

          const criticalAction = determineCriticalAction({
            orderId,
            isCritical: true,
            authoritativeTaskId: authoritativeTask?.id,
            taskResolution: taskResolutionFailed ? 'failed' : 'resolved',
          });

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
                acknowledged={isAcknowledged}
                onAcknowledge={
                  criticalAction.type === 'authoritative_acknowledge' && !isAcknowledged
                    ? () => void handleAcknowledge(orderId, criticalAction.taskId)
                    : undefined
                }
                action={
                  criticalAction.type === 'authoritative_acknowledge' ? (
                    <RowLink
                      href={criticalAction.reviewHref}
                      aria-label={`Open full result for ${order?.testName ?? result.testCode}`}
                    >
                      {isAcknowledged ? 'View verified result & audit trail' : 'Review Critical Result'}
                    </RowLink>
                  ) : criticalAction.type === 'navigation_only' ? (
                    <RowLink
                      href={criticalAction.href}
                      aria-label={`Review critical result for ${order?.testName ?? result.testCode}`}
                    >
                      Review Critical Result
                    </RowLink>
                  ) : criticalAction.type === 'task_resolution_failed' ? (
                    <Button variant="secondary" size="sm" onClick={handleRetryTaskResolution}>
                      Retry
                    </Button>
                  ) : null
                }
              />
            </div>
          );
        })}

        {taskResolutionFailed && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <AlertBanner
              severity="critical"
              title="Task resolution failed"
              action={
                <Button variant="secondary" size="sm" onClick={handleRetryTaskResolution}>
                  Retry
                </Button>
              }
            >
              {CRITICAL_TASK_RESOLUTION_ERROR}
            </AlertBanner>
          </div>
        )}

        {probeError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <AlertBanner
              severity="critical"
              title="Result Check Warning"
              dismissible
              onDismiss={() => setProbeError(null)}
            >
              {probeError}
            </AlertBanner>
          </div>
        )}

        {ackError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <AlertBanner
              severity="critical"
              title="Acknowledgment failed"
              dismissible
              onDismiss={() => setAckError(null)}
            >
              {ackError}
            </AlertBanner>
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
