'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Button } from '../../../components/ui/Button/Button';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Card } from '../../../components/ui/Card/Card';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState/ErrorState';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { Lock, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { diagnosticsService } from '../../../services/diagnostics-service';
import type { DiagnosticOrderResponse, DiagnosticResultResponse } from 'shared';
import styles from './order-detail.module.css';
import { useAuth } from '../../../hooks/useAuth';
import { canVerifyResults, RESULT_STATUS_LABELS } from '../../../utils/diagnostics';
import { StaffRole } from '../../../types/auth';

export default function DiagnosticOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId = params?.orderId;
  const { user } = useAuth();
  const role = user?.role as StaffRole | undefined;

  const [order, setOrder] = useState<DiagnosticOrderResponse | null>(null);
  const [result, setResult] = useState<DiagnosticResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const fetchData = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const orderRes = await diagnosticsService.getOrder(orderId);
      setOrder(orderRes.data);
      try {
        const resRes = await diagnosticsService.getResult(orderId);
        setResult(resRes.data); // result may legitimately not exist yet
      } catch {
        setResult(null);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

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

  if (loading) {
    return (
      <AppShell
        breadcrumbs={['Operations', 'Lab Queue', 'Order']}
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
        breadcrumbs={['Operations', 'Lab Queue', 'Order']}
        requiredPermission="diagnostic_order:read"
      >
        <div className={styles.container}>
          <ErrorState
            title="Could not load diagnostic order"
            message={error?.message ?? 'Not found.'}
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
      breadcrumbs={['Operations', 'Lab Queue', 'Order']}
      requiredPermission="diagnostic_order:read"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{order.testName}</h1>
          <span
            className={`${styles.orderChip} ${order.priority === 'stat' ? styles.orderChipStat : ''}`}
          >
            {order.priority.toUpperCase()}
          </span>
        </div>

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
                {verified && ' It has been independently verified.'}
              </p>
            </div>
          </div>
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
              <span className={styles.metaLabel}>Status</span>
              <Badge variant={order.status === 'ordered' ? 'stable' : 'neutral'}>
                {order.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div>
              <span className={styles.metaLabel}>Ordered</span>
              {new Date(order.createdAt).toLocaleString()}
            </div>
            <div>
              <span className={styles.metaLabel}>Collected</span>
              {order.collectedAt ? new Date(order.collectedAt).toLocaleString() : '—'}
            </div>
            {result && (
              <div>
                <span className={styles.metaLabel}>Result status</span>
                <strong style={{ textTransform: 'capitalize' }}>
                  {(RESULT_STATUS_LABELS[result.status] ?? result.status).split('—')[0].trim()}
                </strong>
              </div>
            )}
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
                  <span className={styles.mono}>{result.enteredBy.slice(0, 8)}…</span>
                </div>
                <div>
                  <span className={styles.metaLabel}>Entered at</span>
                  {new Date(result.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className={styles.metaLabel}>Verified by</span>
                  {result.verifiedBy
                    ? `${result.verifiedBy.slice(0, 8)}…`
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
                <ShieldCheck size={16} aria-hidden="true" />
                VERIFIED &amp; LOCKED — this result is final and cannot be modified.
              </div>
            )}

            <div className={styles.actionsBar}>
              {showVerify &&
                (!confirmVerify ? (
                  <Button variant="primary" onClick={() => setConfirmVerify(true)}>
                    Verify Result
                  </Button>
                ) : (
                  <>
                    <span className={styles.confirmText} role="status">
                      Verify this diagnostic result as accurate and complete?
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmVerify(false)}
                      disabled={verifying}
                    >
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleVerify} disabled={verifying}>
                      {verifying ? 'Verifying…' : 'Confirm Verification'}
                    </Button>
                  </>
                ))}
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
            <p className={styles.pendingNote}>
              No result entered yet. Values become available after the laboratory enters them.
            </p>
            {canVerifyResults(role) && role === 'lab_technician' && (
              <Button
                variant="primary"
                onClick={() => router.push(`/diagnostics/${orderId}/result/new`)}
              >
                Enter Result
              </Button>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
