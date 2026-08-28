'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Button } from '../../../components/ui/Button/Button';
import { Card } from '../../../components/ui/Card/Card';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState/ErrorState';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog';
import { PageHeader } from '../../../components/ui/PageHeader/PageHeader';
import {
  OrderStatusBadge,
  PriorityBadge,
  ResultStatusBadge,
} from '../../../components/ui/SemanticBadges/SemanticBadges';
import { Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import { diagnosticsService } from '../../../services/diagnostics-service';
import { getStaffIdentities } from '../../../services/staff-service';
import { taskService } from '../../../services/task-service';
import type { DiagnosticOrderResponse, DiagnosticResultResponse, TaskResponse } from 'shared';
import styles from './order-detail.module.css';
import { useAuth } from '../../../hooks/useAuth';
import { canEnterResults, canVerifyResults, canCollectSamples } from '../../../utils/diagnostics';

export default function DiagnosticOrderDetailPage() {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [collecting, setCollecting] = useState(false);

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [taskAssigneeName, setTaskAssigneeName] = useState<string | null>(null);
  const [taskActionLoading, setTaskActionLoading] = useState<string | null>(null);
  const [taskActionError, setTaskActionError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const orderRes = await diagnosticsService.getOrder(orderId);
      setOrder(orderRes.data);
      
      let fetchedTask: TaskResponse | null = null;
      if (taskId) {
        try {
          fetchedTask = await taskService.getTask(taskId);
          setTask(fetchedTask);
        } catch (e) {
          console.error('Failed to fetch task context', e);
        }
      }

      try {
        const resRes = await diagnosticsService.getResult(orderId);
        setResult(resRes.data); // result may legitimately not exist yet
        
        const idsToFetch = [resRes.data.enteredBy, resRes.data.verifiedBy];
        if (fetchedTask?.assignedTo) {
          idsToFetch.push(fetchedTask.assignedTo);
        }

        const ids = await getStaffIdentities(
          idsToFetch.filter((id): id is string => typeof id === 'string'),
        );
        setEnteredByName(ids.get(resRes.data.enteredBy)?.displayName ?? null);
        setVerifiedByName(
          resRes.data.verifiedBy ? (ids.get(resRes.data.verifiedBy)?.displayName ?? null) : null,
        );
        if (fetchedTask?.assignedTo) {
          setTaskAssigneeName(ids.get(fetchedTask.assignedTo)?.displayName ?? null);
        }
      } catch {
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
  }, [orderId, taskId]);

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

  if (loading) {
    return (
      <AppShell
        breadcrumbs={['Operations', 'Diagnostics']}
        requiredPermission="diagnostic_order:read"
      >
        <div className={styles.container}>
          <Skeleton variant="rectangular" height={280} />
        </div>
      </AppShell>
    );
  }

  if (error || !order) {
    return (
      <AppShell
        breadcrumbs={['Operations', 'Diagnostics']}
        requiredPermission="diagnostic_order:read"
      >
        <div className={styles.container}>
          <ErrorState
            title="This order is no longer available"
            message={error?.message ?? 'It may not exist or your role may not permit access.'}
            onRetry={fetchData}
          />
        </div>
      </AppShell>
    );
  }

  const critical = result?.isCritical === true || (result?.status as string) === 'critical_flagged';
  const verified = result?.status === 'verified';
  const isEnterer = !!result && user?.id === result.enteredBy;
  const showVerify = canVerifyResults(role) && !verified && !!result && !isEnterer;

  const snapshot = (result?.referenceRange ?? null) as {
    parameters?: Array<{
      parameterName: string;
      verdict: string;
      reason?: string;
      bounds?: Record<string, number | null>;
    }>;
  } | null;

  return (
    <AppShell
      breadcrumbs={['Operations', 'Diagnostics', order.testCode]}
      requiredPermission="diagnostic_order:read"
    >
      <div className={styles.container}>
        <PageHeader
          title={order.testName}
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
            <span className={styles.criticalIcon} aria-hidden="true">
              ⚠
            </span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {task.priority === 'critical' && <AlertTriangle size={16} color="var(--color-critical-600)" />}
                  Related Task: {task.title}
                </h3>
                <div className={styles.metaGrid} style={{ marginTop: '0.5rem' }}>
                  <div>
                    <span className={styles.metaLabel}>Type</span>
                    <span style={{ textTransform: 'capitalize' }}>{task.taskType.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Priority</span>
                    <span style={{ textTransform: 'capitalize' }}>{task.priority}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Status</span>
                    <span style={{ textTransform: 'capitalize' }}>{task.status.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Assignee</span>
                    {taskAssigneeName ?? task.assignedTo?.slice(0,8) ?? 'Unassigned'}
                  </div>
                </div>
              </div>
              
              {task.assignedTo === user?.id && (
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  {task.status === 'created' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleAcknowledgeTask()}
                      disabled={taskActionLoading !== null}
                    >
                      {taskActionLoading === 'acknowledge' ? 'Acknowledging...' : 'Acknowledge'}
                    </Button>
                  )}
                  {task.status === 'in_progress' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleCompleteTask()}
                      disabled={taskActionLoading !== null}
                    >
                      {taskActionLoading === 'complete' ? 'Completing...' : 'Complete Task'}
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
                    disabled={collecting}
                  >
                    {collecting ? 'Collecting...' : 'Collect sample'}
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
      </div>
    </AppShell>
  );
}
