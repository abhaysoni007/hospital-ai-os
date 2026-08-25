'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../../components/layout/AppShell/AppShell';
import { Button } from '../../../../../components/ui/Button/Button';
import { Card } from '../../../../../components/ui/Card/Card';
import { Input } from '../../../../../components/ui/Input/Input';
import { AlertBanner } from '../../../../../components/ui/Alert/AlertBanner';
import { ErrorState } from '../../../../../components/ui/ErrorState/ErrorState';
import { Skeleton } from '../../../../../components/ui/Skeleton/Skeleton';
import { Badge } from '../../../../../components/ui/Badge/Badge';
import { PRIORITY_META, buildResultPayload } from '../../../../../utils/diagnostics';
import { diagnosticsService } from '../../../../../services/diagnostics-service';
import type { DiagnosticOrderResponse } from 'shared';
import styles from './result-entry.module.css';

interface Row {
  parameterName: string;
  value: string;
  unit: string;
}

const EMPTY_ROW: Row = { parameterName: '', value: '', unit: '' };

export default function ResultEntryPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId = params?.orderId;

  const [order, setOrder] = useState<DiagnosticOrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [enteredResultId, setEnteredResultId] = useState<string | null>(null);
  const [enteredCritical, setEnteredCritical] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    diagnosticsService
      .getOrder(orderId)
      .then((res) => setOrder(res.data))
      .catch((err) => setError(err as Error))
      .finally(() => setLoading(false));
  }, [orderId]);

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const startReview = () => {
    setSubmitError(null);
    const check = buildResultPayload(rows);
    if (!check.ok) {
      setRowErrors(check.errors);
      return;
    }
    setRowErrors({});
    setReviewing(true);
  };

  const handleEnterResult = async () => {
    const check = buildResultPayload(rows);
    if (!check.ok) {
      setReviewing(false);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await diagnosticsService.enterResult(orderId!, check.payload);
      setEnteredResultId(res.data.id);
      // Critical results get their own unmistakable state — never a generic toast.
      setEnteredCritical(res.data.isCritical);
    } catch (err) {
      const apiErr = err as Error & { code?: string; statusCode?: number };
      if (apiErr.code === 'RESULT_ALREADY_EXISTS' || apiErr.statusCode === 409) {
        setSubmitError(
          'A result has already been entered for this order by someone else. Redirecting to the existing result…',
        );
        setTimeout(() => router.push(`/diagnostics/${orderId}`), 1800);
      } else if (apiErr.statusCode === 403) {
        setSubmitError('You are not authorized to enter results for this order.');
      } else {
        setSubmitError(apiErr.message || 'Failed to enter the result.');
      }
      setReviewing(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell
        breadcrumbs={['Operations', 'Lab Queue', 'Result Entry']}
        requiredPermission="diagnostic_result:enter"
      >
        <div className={styles.container}>
          <Skeleton variant="rectangular" height={260} />
        </div>
      </AppShell>
    );
  }

  if (error || !order) {
    return (
      <AppShell
        breadcrumbs={['Operations', 'Lab Queue', 'Result Entry']}
        requiredPermission="diagnostic_result:enter"
      >
        <div className={styles.container}>
          <ErrorState
            title="Could not load order"
            message={error?.message ?? 'Order not found.'}
            onRetry={() => router.refresh()}
          />
        </div>
      </AppShell>
    );
  }

  // Post-submission states — critical is its own unmistakable screen.
  if (enteredResultId) {
    return (
      <AppShell
        breadcrumbs={['Operations', 'Lab Queue', 'Result Entry']}
        requiredPermission="diagnostic_result:enter"
      >
        <div className={styles.container}>
          {enteredCritical ? (
            <div className={`${styles.criticalBanner}`} role="alert">
              <span className={styles.criticalIcon} aria-hidden="true">
                ⚠
              </span>
              <div>
                <h1 className={styles.criticalTitle}>CRITICAL RESULT</h1>
                <p>
                  {order.testName} was flagged <strong>critical</strong> by the deterministic rule
                  evaluation. The ordering physician has been notified.
                </p>
                <p className={styles.criticalMeta}>
                  This result now requires clinical attention and independent verification before it
                  becomes final.
                </p>
              </div>
            </div>
          ) : (
            <AlertBanner severity="info" title="Result recorded">
              Result saved with status <strong>preliminary</strong>. Independent verification is
              required before it becomes final.
            </AlertBanner>
          )}
          <Button variant="primary" onClick={() => router.push(`/diagnostics/${orderId}`)}>
            Open result
          </Button>
        </div>
      </AppShell>
    );
  }

  const pm = PRIORITY_META[order.priority];

  return (
    <AppShell
      breadcrumbs={['Operations', 'Lab Queue', 'Result Entry']}
      requiredPermission="diagnostic_result:enter"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Enter Result</h1>
          <Badge variant="stable">{ORDER_STATUS_LABEL(order.status)}</Badge>
        </div>

        <Card>
          <div className={styles.meta}>
            <div>
              <span className={styles.metaLabel}>Test</span>
              <strong>{order.testName}</strong>
            </div>
            <div>
              <span className={styles.metaLabel}>Priority</span>
              <span>{pm.label}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Sample collected</span>
              <span>{order.collectedAt ? new Date(order.collectedAt).toLocaleString() : '—'}</span>
            </div>
          </div>
        </Card>

        {submitError && (
          <AlertBanner
            severity="critical"
            title="Could not enter result"
            dismissible
            onDismiss={() => setSubmitError(null)}
          >
            {submitError}
          </AlertBanner>
        )}

        {!reviewing ? (
          <>
            <Card>
              <p className={styles.evaluationNote}>
                Values are evaluated automatically against configured critical-value rules after
                submission. Do not enter qualitative or non-numeric observations here.
              </p>
              {rows.map((row, idx) => (
                <div key={idx} className={styles.paramRow}>
                  <Input
                    id={`param-${idx}`}
                    label={`Parameter ${idx + 1} name`}
                    value={row.parameterName}
                    onChange={(e) => updateRow(idx, { parameterName: e.target.value })}
                    error={rowErrors[idx]}
                  />
                  <Input
                    id={`value-${idx}`}
                    label="Numeric value"
                    type="number"
                    step="any"
                    value={row.value}
                    onChange={(e) => updateRow(idx, { value: e.target.value })}
                    error={undefined}
                  />
                  <Input
                    id={`unit-${idx}`}
                    label="Unit"
                    value={row.unit}
                    onChange={(e) => updateRow(idx, { unit: e.target.value })}
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeRow}
                      aria-label={`Remove parameter ${idx + 1}`}
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className={styles.addRow}
                onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW }])}
              >
                + Add parameter
              </button>
            </Card>

            <div className={styles.actions}>
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button variant="primary" onClick={startReview}>
                Review & Enter
              </Button>
            </div>
          </>
        ) : (
          <>
            <Card>
              <h2 className={styles.reviewTitle}>Review before entering</h2>
              <dl className={styles.reviewList}>
                <div>
                  <dt>Test</dt>
                  <dd>
                    {order.testName} ({order.testCode})
                  </dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>{pm.label}</dd>
                </div>
                {rows
                  .filter((r) => r.parameterName.trim())
                  .map((r, i) => (
                    <div key={i}>
                      <dt>{r.parameterName}</dt>
                      <dd>
                        {r.value} {r.unit}
                      </dd>
                    </div>
                  ))}
              </dl>
              <p className={styles.reviewNote}>
                After entering, the system evaluates these values against configured critical-value
                rules. Critical findings are flagged immediately and the ordering physician is
                notified.
              </p>
            </Card>
            <div className={styles.actions}>
              <Button variant="outline" onClick={() => setReviewing(false)} disabled={submitting}>
                Back to editing
              </Button>
              <Button variant="primary" onClick={handleEnterResult} disabled={submitting}>
                {submitting ? 'Entering…' : 'Enter Result'}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ORDER_STATUS_LABEL(status: string): string {
  const labels: Record<string, string> = {
    ordered: 'Ordered',
    sample_collected: 'Sample collected',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status;
}
