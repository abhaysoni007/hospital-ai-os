'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import { AlertBanner } from '../../components/ui/Alert/AlertBanner';
import { TestTubes, AlertTriangle, CheckCircle2, Clock, FlaskConical } from 'lucide-react';
import { diagnosticsService } from '../../services/diagnostics-service';
import type { DiagnosticOrderResponse } from 'shared';
import styles from './diagnostics.module.css';
import { useAuth } from '../../hooks/useAuth';
import {
  canCollectSamples,
  canEnterResults,
  ORDER_STATUS_LABELS,
  PRIORITY_META,
} from '../../utils/diagnostics';
import { StaffRole } from '../../types/auth';

export default function DiagnosticsQueuePage() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role as StaffRole | undefined;

  const [orders, setOrders] = useState<DiagnosticOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [date, setDate] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);

  const canCollect = canCollectSamples(role);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await diagnosticsService.getLabQueue({
        page: 1,
        pageSize: 100,
        status: (status || undefined) as never,
        priority: (priority || undefined) as never,
        date: date || undefined,
      });
      setOrders(res.data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [status, priority, date]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleCollect = async (orderId: string) => {
    if (!window.confirm('Confirm sample collection. Collection can only be performed once.'))
      return;
    setActingId(orderId);
    setConflictId(null);
    try {
      await diagnosticsService.collectSample(orderId);
      await fetchQueue();
    } catch (err) {
      const apiErr = err as Error & { statusCode?: number };
      if (apiErr.statusCode === 409) {
        setConflictId(orderId); // another technician already collected it
        await fetchQueue();
      } else {
        setError(apiErr);
      }
    } finally {
      setActingId(null);
    }
  };

  return (
    <AppShell breadcrumbs={['Operations', 'Lab Queue']} requiredPermission="diagnostic_order:read">
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <FlaskConical size={22} aria-hidden="true" /> Lab Queue
          </h1>
        </div>

        <div className={styles.filters}>
          <label className={styles.filterField}>
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            <span>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">All</option>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </select>
          </label>
          <label className={styles.filterField}>
            <span>Ordered on</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        {error && !loading && (
          <ErrorState
            title="Could not load the lab queue"
            message={error.message}
            onRetry={fetchQueue}
          />
        )}

        {conflictId && (
          <AlertBanner
            severity="warning"
            title="Sample already collected"
            dismissible
            onDismiss={() => setConflictId(null)}
          >
            Another technician collected this sample first. The queue shows the current state.
          </AlertBanner>
        )}

        <div className={styles.tableContainer}>
          {loading ? (
            <div style={{ padding: 24 }}>
              <Skeleton variant="rectangular" height={220} />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<TestTubes size={32} />}
              title="No diagnostic orders"
              description="Orders placed by physicians appear here for collection and result entry."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ordered</th>
                  <th scope="col">Collected</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const pm = PRIORITY_META[o.priority];
                  return (
                    <tr
                      key={o.id}
                      className={`${styles.row} ${o.priority === 'stat' ? styles.rowStat : ''}`}
                      onClick={() => router.push(`/diagnostics/${o.id}`)}
                    >
                      <td>
                        <span className={styles.testName}>{o.testName}</span>
                        <span className={styles.code}>{o.testCode}</span>
                      </td>
                      <td>
                        <span className={`${styles.priorityChip} ${styles[`priority_${pm.tone}`]}`}>
                          <span aria-hidden="true">{pm.icon}</span> {pm.label}
                        </span>
                      </td>
                      <td>
                        <Badge variant={o.status === 'ordered' ? 'stable' : 'neutral'}>
                          {ORDER_STATUS_LABELS[o.status] ?? o.status}
                        </Badge>
                      </td>
                      <td>{new Date(o.createdAt).toLocaleString()}</td>
                      <td>
                        {o.collectedAt ? (
                          <span className={styles.collected}>
                            <CheckCircle2 size={13} aria-hidden="true" />{' '}
                            {new Date(o.collectedAt).toLocaleTimeString()}
                          </span>
                        ) : (
                          <span className={styles.pending}>
                            <Clock size={13} aria-hidden="true" /> Awaiting collection
                          </span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {canCollect && o.status === 'ordered' ? (
                          <Button
                            variant="primary"
                            size="md"
                            disabled={actingId === o.id}
                            onClick={() => handleCollect(o.id)}
                          >
                            {actingId === o.id ? 'Collecting…' : 'Collect Sample'}
                          </Button>
                        ) : o.status === 'sample_collected' || o.status === 'in_progress' ? (
                          canEnterResults(role) ? (
                            <Button
                              variant="secondary"
                              size="md"
                              iconLeft={<AlertTriangle size={14} />}
                              onClick={() => router.push(`/diagnostics/${o.id}/result/new`)}
                            >
                              Enter Result
                            </Button>
                          ) : null
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
