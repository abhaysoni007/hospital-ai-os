'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, AlertOctagon, RefreshCw, Clock, ArrowUpRight } from 'lucide-react';
import type { DiagnosticOrderResponse } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { ROLE_DISPLAY_NAMES } from '../../utils/rbac';
import { diagnosticsService } from '../../services/diagnostics-service';
import { Card, CardContent } from '../ui/Card/Card';
import { Badge } from '../ui/Badge/Badge';
import { AlertBanner } from '../ui/Alert/AlertBanner';
import { MetricCard } from '../ui/MetricCard/MetricCard';
import { Table, THead, TH, TBody, TR, TD, RowLink, TableSkeleton } from '../ui/Table/Table';
import styles from './DashboardShell.module.css';

function formatStartedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function LabTechnicianDashboard() {
  const { user } = useAuth();
  const notifications = useNotifications(40);
  const [orders, setOrders] = useState<DiagnosticOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ ordered: 0, sample_collected: 0, in_progress: 0, completed: 0 });
  const [now, setNow] = useState(() => new Date());
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
      setOrders(allRes.data);
      setCounts({
        ordered: orderedRes.meta.total,
        sample_collected: collectedRes.meta.total,
        in_progress: inProgressRes.meta.total,
        completed: completedRes.meta.total,
      });
      setNow(new Date());
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

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.greetingBanner}>
        <div>
          <h1 className={styles.greetingTitle}>
            <span className={styles.greetingIcon} aria-hidden="true">🔬</span>
            Laboratory Operations — {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}` : 'Technician'}
          </h1>
          <p className={styles.greetingSubtitle}>
            {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            {ROLE_DISPLAY_NAMES.lab_technician} Workspace
          </p>
        </div>
        <div className={styles.greetingMeta}>
          <span className={styles.livePill}><span className={styles.liveDot} aria-hidden="true" />Live</span>
          <button type="button" className={styles.refreshButton} onClick={() => void loadData()}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {/* Metric Tiles */}
      <section aria-label="Laboratory metrics" className={styles.metricRow}>
        <MetricCard
          label="Pending Collection"
          icon={<FlaskConical size={16} aria-hidden="true" />}
          tone="warning"
          href="/diagnostics"
          value={loading ? '—' : counts.ordered}
          hint="Specimens ordered but not collected"
        />
        <MetricCard
          label="Samples Collected"
          icon={<FlaskConical size={16} aria-hidden="true" />}
          tone="info"
          href="/diagnostics"
          value={loading ? '—' : counts.sample_collected}
          hint="Awaiting specimen processing"
        />
        <MetricCard
          label="In Progress / Entry"
          icon={<Clock size={16} aria-hidden="true" />}
          tone="primary"
          href="/diagnostics"
          value={loading ? '—' : counts.in_progress}
          hint="Results entered · pending verification"
        />
        <MetricCard
          label="Critical Lab Alerts"
          icon={<AlertOctagon size={16} aria-hidden="true" />}
          tone={criticalItems.length > 0 ? 'critical' : 'success'}
          href="/diagnostics"
          value={notifications.isLoading ? '—' : criticalItems.length}
          hint={criticalItems.length === 0 ? 'All panic values handled' : 'Immediate clinician notification required'}
        />
      </section>

      {/* Main Laboratory Orders Queue */}
      <Card elevation="xs" padding="none" className={styles.tableCard}>
        <div className={styles.sectionCardHeader}>
          <div className={styles.sectionHeaderTitle}>
            <h3>Active Diagnostic Orders Queue</h3>
            <p>Real-time order state machine · ordered → sample_collected → in_progress → completed</p>
          </div>
          <Link href="/diagnostics" className={styles.viewAllLink}>
            Open diagnostics console <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <CardContent>
            <AlertBanner severity="warning" title="Diagnostic queue unavailable">
              {error}
            </AlertBanner>
          </CardContent>
        ) : orders.length === 0 ? (
          <CardContent>
            <p className={styles.quietEmpty}>No active diagnostic orders in the queue right now.</p>
          </CardContent>
        ) : (
          <Table ariaLabel="Diagnostic Orders Queue">
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
                    <code style={{ fontSize: '0.8125rem', padding: '2px 6px', background: 'var(--color-neutral-100)', borderRadius: '4px' }}>
                      {o.testCode}
                    </code>
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
                  <TD>{formatStartedAt(o.createdAt)}</TD>
                  <TD align="right">
                    <RowLink href={`/diagnostics/${o.id}`} aria-label={`Open order ${o.testCode}`}>
                      Open
                    </RowLink>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
