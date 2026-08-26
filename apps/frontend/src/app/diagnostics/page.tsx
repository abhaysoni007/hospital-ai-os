'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Button } from '../../components/ui/Button/Button';
import { Select } from '../../components/ui/Input/Select';
import { Input } from '../../components/ui/Input/Input';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import { AlertBanner } from '../../components/ui/Alert/AlertBanner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { Table, THead, TH, TBody, TR, TD, TableSkeleton } from '../../components/ui/Table/Table';
import { OrderStatusBadge, PriorityBadge } from '../../components/ui/SemanticBadges/SemanticBadges';
import { TestTubes, CheckCircle2, Clock, FlaskConical } from 'lucide-react';
import { diagnosticsService } from '../../services/diagnostics-service';
import type { DiagnosticOrderResponse, DiagnosticOrderStatus, OrderPriority } from 'shared';
import styles from './diagnostics.module.css';
import { useAuth } from '../../hooks/useAuth';
import { canCollectSamples, canEnterResults } from '../../utils/diagnostics';

/**
 * M13 — Lab work queue. STAT orders are unmistakable (icon + text + left
 * rail + row tint); collection is confirmed explicitly; conflicts surface
 * as recoverable warnings.
 */
export default function DiagnosticsQueuePage() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role;

  const [orders, setOrders] = useState<DiagnosticOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [date, setDate] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [collectTarget, setCollectTarget] = useState<DiagnosticOrderResponse | null>(null);
  const [showConflict, setShowConflict] = useState(false);

  const canCollect = canCollectSamples(role);
  const canEnter = canEnterResults(role);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await diagnosticsService.getLabQueue({
        page: 1,
        pageSize: 100,
        status: (status || undefined) as DiagnosticOrderStatus | undefined,
        priority: (priority || undefined) as OrderPriority | undefined,
        date: date || undefined,
      });
      setOrders(res.data);
    } catch {
      setError('The lab service did not respond. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [status, priority, date]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const handleCollect = async () => {
    if (!collectTarget) return;
    setActingId(collectTarget.id);
    try {
      await diagnosticsService.collectSample(collectTarget.id);
      setCollectTarget(null);
      await fetchQueue();
    } catch (err) {
      const apiErr = err as Error & { statusCode?: number };
      setCollectTarget(null);
      if (apiErr.statusCode === 409 || apiErr.message?.includes('INVALID_TRANSITION')) {
        setShowConflict(true);
        await fetchQueue();
      } else {
        setError('Sample collection failed. Try again.');
      }
    } finally {
      setActingId(null);
    }
  };

  const statCount = orders.filter((o) => o.priority === 'stat').length;

  return (
    <AppShell
      breadcrumbs={['Operations', 'Diagnostics']}
      requiredPermission="diagnostic_order:read"
    >
      <div className={styles.container}>
        <PageHeader
          title="Lab queue"
          description="Collection, processing, and result entry for diagnostic orders."
          meta={
            <>
              <span className={styles.queueNote} aria-live="polite">
                {loading ? '' : `${orders.length} order${orders.length === 1 ? '' : 's'}`}
              </span>
              {statCount > 0 && <PriorityBadge priority="stat" size="sm" />}
              {statCount > 0 && (
                <span className={styles.queueStatNote}>
                  {statCount} STAT in queue — process first
                </span>
              )}
            </>
          }
        />

        <div className={styles.filters}>
          <Select
            id="dx-status"
            label="Status"
            placeholder="All statuses"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'ordered', label: 'Ordered' },
              { value: 'sample_collected', label: 'Sample collected' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <Select
            id="dx-priority"
            label="Priority"
            placeholder="All priorities"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            options={[
              { value: 'routine', label: 'Routine' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'stat', label: 'STAT' },
            ]}
          />
          <Input
            id="dx-date"
            label="Ordered on"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {error && !loading && (
          <ErrorState
            title="Could not load the lab queue"
            message={error}
            onRetry={() => void fetchQueue()}
          />
        )}

        {showConflict && (
          <AlertBanner
            severity="warning"
            title="Sample already collected"
            dismissible
            onDismiss={() => setShowConflict(false)}
          >
            Another technician collected this sample first. The queue shows the current state.
          </AlertBanner>
        )}

        {loading ? (
          <TableSkeleton rows={6} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<TestTubes size={32} />}
            title="No diagnostic orders"
            description={
              status || priority || date
                ? 'No orders match the current filters.'
                : 'Orders placed by physicians appear here for collection and result entry.'
            }
          />
        ) : (
          <Table ariaLabel="Diagnostic orders queue">
            <THead>
              <tr>
                <TH>Test</TH>
                <TH width="120px">Priority</TH>
                <TH width="170px">Status</TH>
                <TH width="160px">Collected</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {orders.map((o) => (
                <TR
                  key={o.id}
                  interactive
                  onClick={() => router.push(`/diagnostics/${o.id}`)}
                  className={o.priority === 'stat' ? styles.rowStat : ''}
                  aria-label={`Open order ${o.testName}`}
                >
                  <TD>
                    <div className={styles.testCell}>
                      <span className={styles.testName}>{o.testName}</span>
                      <span className={styles.code}>{o.testCode}</span>
                    </div>
                  </TD>
                  <TD>
                    <PriorityBadge priority={o.priority} size="sm" />
                  </TD>
                  <TD>
                    <OrderStatusBadge status={o.status} size="sm" />
                  </TD>
                  <TD>
                    {o.collectedAt ? (
                      <span className={styles.collected}>
                        <CheckCircle2 size={13} aria-hidden="true" />
                        {new Date(o.collectedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span className={styles.pending}>
                        <Clock size={13} aria-hidden="true" /> Awaiting
                      </span>
                    )}
                  </TD>
                  <TD align="right">
                    <div className={styles.rowActions}>
                      {canCollect && o.status === 'ordered' && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={actingId === o.id}
                          onClick={() => setCollectTarget(o)}
                        >
                          Collect sample
                        </Button>
                      )}
                      {(o.status === 'sample_collected' || o.status === 'in_progress') &&
                        canEnter && (
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<FlaskConical size={13} />}
                            onClick={() => router.push(`/diagnostics/${o.id}/result/new`)}
                          >
                            Enter result
                          </Button>
                        )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        isOpen={collectTarget !== null}
        title="Confirm sample collection"
        confirmLabel="Confirm collection"
        isLoading={actingId !== null}
        onConfirm={() => void handleCollect()}
        onCancel={() => setCollectTarget(null)}
      >
        Collection is recorded once with your identity and timestamp for order{' '}
        <strong>{collectTarget?.testCode}</strong> and can never be repeated.
      </ConfirmDialog>
    </AppShell>
  );
}
