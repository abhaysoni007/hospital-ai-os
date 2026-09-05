'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import type { DiagnosticOrderResponse } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { diagnosticsService } from '../../services/diagnostics-service';
import { Badge } from '../ui/Badge/Badge';
import { Table, THead, TH, TBody, TR, TD, RowLink, TableSkeleton } from '../ui/Table/Table';
import { CriticalResultBanner } from '../clinical/LovableClinical';
import {
  RoleIntro,
  DateRangeFilter,
  useDateRange,
  MetricGrid,
  RoleMetricCard,
  DashboardGrid,
  ChartCard,
} from './RoleComponents';
import styles from './DashboardShell.module.css';

function formatStartedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function LabTechnicianDashboard() {
  const { user } = useAuth();
  const { range, setRange } = useDateRange('7d');
  const notifications = useNotifications(40);
  const [orders, setOrders] = useState<DiagnosticOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ ordered: 0, sample_collected: 0, in_progress: 0, completed: 0 });
  const mounted = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRes, orderedRes, collectedRes, inProgressRes, completedRes] = await Promise.all([
        diagnosticsService.getLabQueue({ page: 1, pageSize: 25 }),
        diagnosticsService.getLabQueue({ page: 1, status: 'ordered', pageSize: 1 }),
        diagnosticsService.getLabQueue({ page: 1, status: 'sample_collected', pageSize: 1 }),
        diagnosticsService.getLabQueue({ page: 1, status: 'in_progress', pageSize: 1 }),
        diagnosticsService.getLabQueue({ page: 1, status: 'completed', pageSize: 1 }),
      ]);
      if (!mounted.current) return;
      setOrders(Array.isArray(allRes?.data) ? allRes.data : []);
      setCounts({
        ordered: typeof orderedRes?.meta?.total === 'number' ? orderedRes.meta.total : 0,
        sample_collected: typeof collectedRes?.meta?.total === 'number' ? collectedRes.meta.total : 0,
        in_progress: typeof inProgressRes?.meta?.total === 'number' ? inProgressRes.meta.total : 0,
        completed: typeof completedRes?.meta?.total === 'number' ? completedRes.meta.total : 0,
      });
    } catch {
      if (!mounted.current) return;
      setError('Could not load laboratory queue from the diagnostic service.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadData();
    return () => {
      mounted.current = false;
    };
  }, [loadData]);

  const criticalItems = notifications.items.filter(
    (n) => n.priority === 'critical' && n.status !== 'acknowledged',
  );
  const techName = user?.firstName ? `${user.firstName} ${user.lastName ?? ''}` : 'Technician';

  return (
    <div className="space-y-4">
      <RoleIntro
        title="Laboratory workspace"
        subtitle={`${techName} · Core Laboratory · specimen throughput, verification and critical escalation.`}
        aside={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {/* Critical alerts banner */}
      {!notifications.isLoading && criticalItems.length > 0 && (
        <CriticalResultBanner
          testName={criticalItems[0].title}
          value={criticalItems[0].body}
          patientName="Urgent Lab Escalation"
          action={
            criticalItems[0].relatedOrderId ? (
              <Link
                href={`/diagnostics/${criticalItems[0].relatedOrderId}`}
                className={styles.criticalCta}
              >
                Review and acknowledge
              </Link>
            ) : undefined
          }
        />
      )}

      {error && (
        <div role="alert" className={styles.quietEmpty} style={{ color: 'var(--color-danger-main)' }}>
          {error}
        </div>
      )}

      {/* 4-Card Metric Grid */}
      <MetricGrid columns={4}>
        <RoleMetricCard
          label="Pending specimens"
          value={loading ? '—' : counts.ordered + counts.sample_collected}
          hint="Awaiting collection or accessioning"
          href="/diagnostics"
        />
        <RoleMetricCard
          label="Processing"
          value={loading ? '—' : counts.in_progress}
          hint="On analyser benches now"
          href="/diagnostics"
        />
        <RoleMetricCard
          label="Awaiting verification"
          value={loading ? '—' : counts.completed}
          hint="Results entered · needs 4-eyes check"
          tone="warning"
          href="/diagnostics"
        />
        <RoleMetricCard
          label="Critical results"
          value={loading ? '—' : criticalItems.length}
          hint={criticalItems.length > 0 ? 'Escalation required on release' : 'Zero panic flags active'}
          tone={criticalItems.length > 0 ? 'critical' : 'success'}
          href="/diagnostics"
        />
      </MetricGrid>

      {/* Analytical Dashboard Grid */}
      <DashboardGrid columns={2}>
        <ChartCard
          title="Orders received & in-flight"
          decision="Is inbound diagnostic demand rising faster than throughput?"
          action={{ label: 'Order queue', href: '/diagnostics' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Active load: {counts.ordered + counts.sample_collected + counts.in_progress} specimens across laboratory benches.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', fontSize: '0.75rem' }}>
                {counts.ordered} Ordered
              </span>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', fontSize: '0.75rem' }}>
                {counts.sample_collected} Sample Collected
              </span>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-info-bg)', color: 'var(--color-info-text)', fontSize: '0.75rem' }}>
                {counts.in_progress} In Progress
              </span>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Verification & TAT status"
          decision="Is unverified work accumulating at the verification station?"
          action={{ label: 'Diagnostics', href: '/diagnostics' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              {counts.completed} tests ready for final verification and release to chart.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', fontSize: '0.75rem', fontWeight: 600 }}>
                {counts.completed} Awaiting Verification
              </span>
            </div>
          </div>
        </ChartCard>
      </DashboardGrid>

      {/* Specimen Queue */}
      <section className="clinical-panel p-4" aria-label="Laboratory specimen queue">
        <header style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Diagnostic Orders & Specimen Queue
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Real-time specimen processing across haematology, biochemistry, and microbiology.
            </p>
          </div>
          <Link href="/diagnostics" style={{ fontSize: '0.75rem', color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 500 }}>
            Full lab queue →
          </Link>
        </header>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : orders.length === 0 ? (
          <div className={styles.quietEmpty}>No specimens currently in the laboratory queue.</div>
        ) : (
          <Table ariaLabel="Specimen Processing Queue">
            <THead>
              <TR>
                <TH>Order ID</TH>
                <TH>Test Name</TH>
                <TH>Priority</TH>
                <TH>Status</TH>
                <TH>Ordered At</TH>
                <TH align="right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {orders.slice(0, 6).map((order) => (
                <TR key={order.id}>
                  <TD>
                    <span className="num" style={{ fontWeight: 600 }}>
                      {order.id.slice(0, 8)}...
                    </span>
                  </TD>
                  <TD>{order.testName}</TD>
                  <TD>
                    <Badge variant={order.priority === 'stat' ? 'critical' : 'neutral'} size="sm">
                      {order.priority.toUpperCase()}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge
                      variant={
                        order.status === 'completed'
                          ? 'stable'
                          : order.status === 'in_progress'
                            ? 'info'
                            : 'urgent'
                      }
                      size="sm"
                    >
                      {order.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TD>
                  <TD>
                    <span className={styles.timeCell}>
                      <Clock size={12} aria-hidden="true" />
                      {formatStartedAt(order.createdAt)}
                    </span>
                  </TD>
                  <TD align="right">
                    <RowLink href={`/diagnostics/${order.id}`} aria-label="Open order details">
                      {order.status === 'completed' ? 'Verify' : 'Process'}
                    </RowLink>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
