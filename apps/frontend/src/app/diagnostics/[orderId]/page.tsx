'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Button } from '../../../components/ui/Button/Button';
import { Card } from '../../../components/ui/Card/Card';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState/ErrorState';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog';
import { PageHeader } from '../../../components/ui/PageHeader/PageHeader';
import { PatientContextHeader } from '../../../components/clinical/PatientContextHeader/PatientContextHeader';
import {
  OrderStatusBadge,
  PriorityBadge,
  ResultStatusBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from '../../../components/ui/SemanticBadges/SemanticBadges';
import { usePatient } from '../../../hooks/usePatient';
import { Lock, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { diagnosticsService } from '../../../services/diagnostics-service';
import { getStaffIdentities } from '../../../services/staff-service';
import { taskService } from '../../../services/task-service';
import type { DiagnosticOrderResponse, DiagnosticResultResponse, TaskResponse } from 'shared';
import styles from './order-detail.module.css';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/rbac';
import { canEnterResults, canVerifyResults, canCollectSamples, canAcknowledgeCritical } from '../../../utils/diagnostics';
import { DiagnosticTrend } from '../../../components/intelligence/DiagnosticTrend';

export default function DiagnosticOrderDetailPage() {
  return (
    <AppShell
      breadcrumbs={['Operations', 'Diagnostics']}
      requiredPermission="diagnostic_order:read"
    >
      <Suspense
        fallback={
          <div className={styles.container}>
            <Skeleton variant="rectangular" height={280} />
          </div>
        }
      >
        <OrderDetailContent />
      </Suspense>
    </AppShell>
  );
}

function OrderDetailContent() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams?.get('taskId');
  const orderId = params?.orderId;
  const { user } = useAuth();
  const role = user?.role;

  const [order, setOrder] = useState<DiagnosticOrderResponse | null>(null);
  const [result, setResult] = useState<DiagnosticResultResponse | null>(null);
  // M12.2 Part D — human-readable staff identity (server-projected).
  const [enteredByName, setEnteredByName] = useState<string | null>(null);
  const [verifiedByName, setVerifiedByName] = useState<string | null>(null);
  const [acknowledgedByName, setAcknowledgedByName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [taskAssigneeName, setTaskAssigneeName] = useState<string | null>(null);
  const [taskActionLoading, setTaskActionLoading] = useState<string | null>(null);
  const [taskActionError, setTaskActionError] = useState<string | null>(null);

  // M17 — patient identity band; the order payload only carries patientId.
  const { patient, error: patientError, reload: reloadPatient } = usePatient(order?.patientId);

  const canReadDx =
    hasPermission(role, 'diagnostic_order:read') || hasPermission(role, 'diagnostic_result:read');

  const fetchData = useCallback(async () => {
    if (!orderId) return;
    if (!canReadDx) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Fetch order + result in parallel — cuts one full round-trip from the waterfall.
      const [orderRes, resultRes] = await Promise.all([
        diagnosticsService.getOrder(orderId),
        diagnosticsService.getResult(orderId).catch(() => null),
      ]);
      setOrder(orderRes.data);

      let fetchedTask: TaskResponse | null = null;
      if (taskId) {
        try {
          fetchedTask = await taskService.getTask(taskId);
          setTask(fetchedTask);
        } catch {
          // Task context is supplementary — the order detail stays usable
          // without it; the related-task card is simply not shown.
        }
      }

      if (resultRes) {
        setResult(resultRes.data);

        const idsToFetch = [resultRes.data.enteredBy, resultRes.data.verifiedBy, resultRes.data.acknowledgedBy];
        if (fetchedTask?.assignedTo) {
          idsToFetch.push(fetchedTask.assignedTo);
        }

        const ids = await getStaffIdentities(
          idsToFetch.filter((id): id is string => typeof id === 'string'),
        );
        setEnteredByName(ids.get(resultRes.data.enteredBy)?.displayName ?? null);
        setVerifiedByName(
          resultRes.data.verifiedBy ? (ids.get(resultRes.data.verifiedBy)?.displayName ?? null) : null,
        );
        setAcknowledgedByName(
          resultRes.data.acknowledgedBy ? (ids.get(resultRes.data.acknowledgedBy)?.displayName ?? null) : null,
        );
        if (fetchedTask?.assignedTo) {
          setTaskAssigneeName(ids.get(fetchedTask.assignedTo)?.displayName ?? null);
        }
      } else {
        setResult(null);
        if (fetchedTask?.assignedTo) {
          const ids = await getStaffIdentities([fetchedTask.assignedTo]);
          setTaskAssigneeName(ids.get(fetchedTask.assignedTo)?.displayName ?? null);
        }
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orderId, taskId, canReadDx]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await diagnosticsService.verifyResult(orderId!);
      setResult(res.data);
      await fetchData(); // refresh order status (completed)
      setConfirmVerify(false);
    } catch (err) {
      const apiErr = err as Error & { code?: string; statusCode?: number };
      if (apiErr.statusCode === 409 || apiErr.code === 'INVALID_TRANSITION') {
        setConflict(true); // someone verified first
        await fetchData();
      } else if (apiErr.statusCode === 403) {
        setVerifyError(
          'Independent verification required — the enterer cannot verify their own result.',
        );
      } else {
        setVerifyError(apiErr.message || 'Verification failed.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleCollectSample = async () => {
    setCollecting(true);
    setError(null);
    try {
      await diagnosticsService.collectSample(orderId!);
      await fetchData();
    } catch (err) {
      setError(err as Error);
    } finally {
      setCollecting(false);
    }
  };

  const handleAcknowledgeTask = async () => {
    if (!task) return;
    setTaskActionLoading('acknowledge');
    setTaskActionError(null);
    try {
      const res = await taskService.acknowledgeTask(task.id);
      setTask(res);
    } catch (err) {
      setTaskActionError((err as Error).message || 'Failed to acknowledge task');
    } finally {
      setTaskActionLoading(null);
    }
  };

  const handleCompleteTask = async () => {
    if (!task) return;
    setTaskActionLoading('complete');
    setTaskActionError(null);
    try {
      const res = await taskService.completeTask(task.id);
      setTask(res);
    } catch (err) {
      setTaskActionError((err as Error).message || 'Failed to complete task');
    } finally {
      setTaskActionLoading(null);
    }
  };

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    setAcknowledgeError(null);
    try {
      const res = await diagnosticsService.acknowledgeResult(orderId!);
      setResult(res.data);
      // Optimistically set the name from the current logged-in user.
      const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
      setAcknowledgedByName(fullName || null);
    } catch (err) {
      setAcknowledgeError((err as Error).message || 'Failed to acknowledge result.');
    } finally {
      setAcknowledging(false);
    }
  };

  const critical = result?.isCritical === true || (result?.status as string) === 'critical_flagged';
  const verified = result?.status === 'verified';
  const isEnterer = !!result && user?.id === result.enteredBy;
  const showVerify = canVerifyResults(role) && !verified && !!result && !isEnterer;
  const acknowledged = !!result?.acknowledgedBy;
  const showAcknowledge = canAcknowledgeCritical(role) && !!result && !acknowledged;

  const snapshot = (result?.referenceRange ?? null) as {
    parameters?: Array<{
      parameterName: string;
      verdict: string;
      reason?: string;
      bounds?: Record<string, number | null>;
    }>;
  } | null;

  return (
    <div className={styles.container}>
        {loading ? (
          <Skeleton variant="rectangular" height={280} />
        ) : error || !order ? (
          <ErrorState
            title="This order is no longer available"
            message={error?.message ?? 'It may not exist or your role may not permit access.'}
            onRetry={fetchData}
          />
        ) : (
          <>
            <PatientContextHeader
              patient={patient}
              loading={Boolean(order && !patient && !patientError)}
          error={patientError}
          onRetry={reloadPatient}
        />

        <PageHeader
          title={order.testName}
          description={`Test code ${order.testCode}`}
          meta={
            <>
              <PriorityBadge priority={order.priority} size="sm" />
              <OrderStatusBadge status={order.status} size="sm" />
              {result && <ResultStatusBadge status={result.status} size="sm" />}
            </>
          }
        />

        {critical && (
          <div className={styles.criticalBanner} role="alert">
            <AlertTriangle size={20} aria-hidden="true" className={styles.criticalIcon} />
            <div>
              <p className={styles.criticalTitle}>CRITICAL RESULT</p>
              <p className={styles.criticalText}>
                This result was flagged by deterministic critical-value rules and requires clinical
                attention.
                {!verified && ' Independent verification is pending.'}
                {verified && ' It has been independently verified and locked.'}
              </p>
            </div>
          </div>
        )}

        {taskActionError && (
          <AlertBanner
            severity="critical"
            title="Task Action Failed"
            dismissible
            onDismiss={() => setTaskActionError(null)}
          >
            {taskActionError}
          </AlertBanner>
        )}

        {task && (
          <Card>
            <div className={styles.taskCard}>
              <div className={styles.taskInfo}>
                <h3 className={styles.taskTitle}>
                  {task.priority === 'critical' && <AlertTriangle size={16} aria-hidden="true" />}
                  Related task: {task.title}
                </h3>
                <div className={styles.metaGrid}>
                  <div className={styles.taskMeta}>
                    <span className={styles.metaLabel}>Type</span>
                    <span>{task.taskType.replace('_', ' ')}</span>
                  </div>
                  <div className={styles.taskMeta}>
                    <span className={styles.metaLabel}>Priority</span>
                    <TaskPriorityBadge priority={task.priority} size="sm" />
                  </div>
                  <div className={styles.taskMeta}>
                    <span className={styles.metaLabel}>Status</span>
                    <TaskStatusBadge status={task.status} size="sm" />
                  </div>
                  <div className={styles.taskMeta}>
                    <span className={styles.metaLabel}>Assignee</span>
                    {taskAssigneeName ?? task.assignedTo?.slice(0, 8) ?? 'Unassigned'}
                  </div>
                </div>
              </div>

              {task.assignedTo === user?.id && (
                <div className={styles.taskActions}>
                  {task.status === 'created' && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={taskActionLoading === 'acknowledge'}
                      onClick={() => void handleAcknowledgeTask()}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {task.status === 'in_progress' && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={taskActionLoading === 'complete'}
                      onClick={() => void handleCompleteTask()}
                    >
                      Complete task
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {conflict && (
          <AlertBanner
            severity="warning"
            title="Already verified"
            dismissible
            onDismiss={() => setConflict(false)}
            action={
              <Button
                variant="secondary"
                size="md"
                iconLeft={<RefreshCw size={14} />}
                onClick={fetchData}
              >
                Refresh
              </Button>
            }
          >
            Another verifier completed verification first. Showing the current state.
          </AlertBanner>
        )}
        {verifyError && (
          <AlertBanner
            severity="critical"
            title="Verification failed"
            dismissible
            onDismiss={() => setVerifyError(null)}
          >
            {verifyError}
          </AlertBanner>
        )}

        <Card>
          <div className={styles.metaGrid}>
            <div>
              <span className={styles.metaLabel}>Ordered</span>
              {new Date(order.createdAt).toLocaleString()}
            </div>
            <div>
              <span className={styles.metaLabel}>Collected</span>
              {order.collectedAt ? new Date(order.collectedAt).toLocaleString() : '—'}
            </div>
          </div>
        </Card>

        {result ? (
          <>
            <Card>
              <h2 className={styles.sectionTitle}>Measured values</h2>
              <table className={styles.valueTable}>
                <thead>
                  <tr>
                    <th scope="col">Parameter</th>
                    <th scope="col">Value</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Evaluation</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    result.resultValues as Array<{
                      parameterName: string;
                      value: number;
                      unit: string;
                    }>
                  ).map((v, i) => {
                    const p = snapshot?.parameters?.find(
                      (sp) => sp.parameterName.toLowerCase() === v.parameterName.toLowerCase(),
                    );
                    const verdict = p?.verdict ?? 'unevaluated';
                    const isCrit = verdict === 'critical';
                    const bounds = p?.bounds;
                    return (
                      <tr key={i} className={isCrit ? styles.criticalRow : ''}>
                        <td>{v.parameterName}</td>
                        <td className={styles.valueCell}>{v.value}</td>
                        <td>{v.unit}</td>
                        <td>
                          <span className={`${styles.verdict} ${styles[`verdict_${verdict}`]}`}>
                            {isCrit && <AlertTriangle size={12} aria-hidden="true" />}
                            {verdict}
                          </span>
                          {p?.reason && (
                            <span className={styles.reason}>
                              {' '}
                              ({p.reason.replaceAll('_', ' ').toLowerCase()})
                            </span>
                          )}
                          {bounds && (verdict === 'critical' || verdict === 'abnormal') && (
                            <span className={styles.bounds}>
                              {' '}
                              · limits{' '}
                              {[
                                bounds.criticalLow != null && `low ${bounds.criticalLow}`,
                                bounds.normalLow != null && `normal ≥ ${bounds.normalLow}`,
                                bounds.normalHigh != null && `normal ≤ ${bounds.normalHigh}`,
                                bounds.criticalHigh != null && `high ${bounds.criticalHigh}`,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            <DiagnosticTrend patientId={order.patientId} testCode={order.testCode} />

            <Card>
              <h2 className={styles.sectionTitle}>Lifecycle</h2>
              <div className={styles.metaGrid}>
                <div>
                  <span className={styles.metaLabel}>Entered by</span>
                  {enteredByName ?? (
                    <span className={styles.mono}>{result.enteredBy.slice(0, 8)}…</span>
                  )}
                </div>
                <div>
                  <span className={styles.metaLabel}>Entered at</span>
                  {new Date(result.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className={styles.metaLabel}>Verified by</span>
                  {result.verifiedBy
                    ? (verifiedByName ?? `${result.verifiedBy.slice(0, 8)}…`)
                    : 'Pending independent verification'}
                </div>
                <div>
                  <span className={styles.metaLabel}>Verified at</span>
                  {result.verifiedAt ? new Date(result.verifiedAt).toLocaleString() : '—'}
                </div>
                <div>
                  <span className={styles.metaLabel}>Acknowledged by</span>
                  {result.acknowledgedBy
                    ? <span className={styles.mono}>{result.acknowledgedBy.slice(0, 8)}…</span>
                    : <span style={{ color: 'var(--text-tertiary)' }}>Not yet acknowledged</span>}
                </div>
                <div>
                  <span className={styles.metaLabel}>Acknowledged at</span>
                  {result.acknowledgedAt ? new Date(result.acknowledgedAt).toLocaleString() : '—'}
                </div>
              </div>
            </Card>

            {verified && (
              <div className={styles.lockedNotice} role="status">
                <Lock size={16} aria-hidden="true" />
                <span>
                  VERIFIED &amp; LOCKED — this result is final, independently verified, and cannot
                  be modified.
                </span>
              </div>
            )}

            {acknowledged && (
              <div className={styles.acknowledgedNotice} role="status">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>
                  CLINICALLY ACKNOWLEDGED —{' '}
                  {acknowledgedByName ?? 'a clinician'} has reviewed this result and confirmed
                  appropriate clinical action has been taken.
                  {result.acknowledgedAt && (
                    <> ({new Date(result.acknowledgedAt).toLocaleString()})</>
                  )}
                </span>
              </div>
            )}

            {acknowledgeError && (
              <AlertBanner
                severity="critical"
                title="Acknowledgement failed"
                dismissible
                onDismiss={() => setAcknowledgeError(null)}
              >
                {acknowledgeError}
              </AlertBanner>
            )}

            {showVerify && (
              <ConfirmDialog
                isOpen={confirmVerify}
                title="Verify this result?"
                confirmLabel="Confirm verification"
                isLoading={verifying}
                onConfirm={() => void handleVerify()}
                onCancel={() => setConfirmVerify(false)}
              >
                Verification certifies the values as accurate and complete under your identity and
                locks the result permanently.
              </ConfirmDialog>
            )}

            <div className={styles.actionsBar}>
              {showVerify && !confirmVerify && (
                <Button variant="primary" onClick={() => setConfirmVerify(true)}>
                  Verify result
                </Button>
              )}
              {showAcknowledge && (
                <Button
                  variant={critical ? 'danger' : 'primary'}
                  isLoading={acknowledging}
                  iconLeft={<CheckCircle2 size={16} />}
                  onClick={() => void handleAcknowledge()}
                >
                  {critical ? 'Acknowledge critical result' : 'Acknowledge result'}
                </Button>
              )}
              {!showVerify && !verified && result.status !== 'verified' && isEnterer && (
                <span className={styles.fourEyesNote}>
                  Independent verification required — the entering technician cannot verify this
                  result.
                </span>
              )}
            </div>
          </>
        ) : (
          <Card>
            <h2 className={styles.sectionTitle}>Result</h2>
            {order.status === 'ordered' ? (
              <>
                <p className={styles.pendingNote}>
                  Sample has not been collected yet. Collect the sample before entering results.
                </p>
                {canCollectSamples(role) && (
                  <Button
                    variant="primary"
                    onClick={() => void handleCollectSample()}
                    isLoading={collecting}
                  >
                    Collect sample
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className={styles.pendingNote}>
                  No result entered yet. Values become available after the laboratory enters them.
                </p>
                {canEnterResults(role) && (
                  <Button
                    variant="primary"
                    onClick={() => router.push(`/diagnostics/${orderId}/result/new`)}
                  >
                    Enter result
                  </Button>
                )}
              </>
            )}
          </Card>
        )}
          </>
        )}
      </div>
  );
}
