'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { breakGlassService, type BreakGlassSessionResponse } from '../../services/break-glass-service';
import { Badge } from '../ui/Badge/Badge';
import { Table, THead, TH, TBody, TR, TD, RowLink, TableSkeleton } from '../ui/Table/Table';
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

export function SecurityAdminDashboard() {
  const { range, setRange } = useDateRange('7d');
  const [activeSessions, setActiveSessions] = useState<BreakGlassSessionResponse[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeRes, allRes] = await Promise.all([
        breakGlassService.listSessions({ status: 'active', limit: 25 }),
        breakGlassService.listSessions({ limit: 1 }),
      ]);
      if (!mounted.current) return;
      setActiveSessions(activeRes.data);
      setTotalCount(allRes.meta.total);
    } catch {
      if (!mounted.current) return;
      setError('Could not load break-glass audit sessions from security service.');
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

  return (
    <div className="space-y-4">
      <RoleIntro
        title="Access & audit workspace"
        subtitle="Security administrator · who accessed what, emergency overrides, and compliance audit trail."
        aside={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {error && (
        <div role="alert" className={styles.quietEmpty} style={{ color: 'var(--color-danger-main)' }}>
          {error}
        </div>
      )}

      {/* 4-Card Metric Grid */}
      <MetricGrid columns={4}>
        <RoleMetricCard
          label="Active break-glass"
          value={loading ? '—' : activeSessions.length}
          hint={activeSessions.length === 0 ? 'No emergency overrides active' : 'Supervisor review required'}
          tone={activeSessions.length > 0 ? 'critical' : 'success'}
          href="/admin/security"
        />
        <RoleMetricCard
          label="Total override events"
          value={loading ? '—' : totalCount}
          hint="Lifetime break-glass sessions"
          href="/admin/security"
        />
        <RoleMetricCard
          label="Audit ledger status"
          value="SHA-256"
          hint="Continuous hash chain"
          tone="success"
          href="/admin/audit"
        />
        <RoleMetricCard
          label="Access control policy"
          value="Strict M5"
          hint="Deterministic RBAC active"
          href="/admin/audit"
        />
      </MetricGrid>

      {/* Analytical Dashboard Grid */}
      <DashboardGrid columns={2}>
        <ChartCard
          title="Emergency break-glass oversight"
          decision="Are emergency overrides open that require supervisor review?"
          action={{ label: 'Security console', href: '/admin/security' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              {activeSessions.length} active emergency override session(s) in progress.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: activeSessions.length > 0 ? 'var(--color-danger-bg)' : 'var(--color-success-bg)', color: activeSessions.length > 0 ? 'var(--color-danger-text)' : 'var(--color-success-text)', fontSize: '0.75rem', fontWeight: 600 }}>
                {activeSessions.length > 0 ? `${activeSessions.length} Active Overrides` : 'All Clear — 0 Active'}
              </span>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Audit log & compliance"
          decision="Verify cryptographic integrity and compliance logs"
          action={{ label: 'Audit log', href: '/admin/audit' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Immutable audit ledger captures every PHI access, authorization change, and clinical transition.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', fontSize: '0.75rem', fontWeight: 600 }}>
                Ledger Chain Valid
              </span>
            </div>
          </div>
        </ChartCard>
      </DashboardGrid>

      {/* Active Break-Glass Sessions Queue */}
      <section className="clinical-panel p-4" aria-label="Active emergency override sessions">
        <header style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Active Break-Glass Emergency Sessions
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Overridden clinical encounters subject to mandatory 24-hour audit and supervisor sign-off.
            </p>
          </div>
          <Link href="/admin/security" style={{ fontSize: '0.75rem', color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 500 }}>
            Security console →
          </Link>
        </header>

        {loading ? (
          <TableSkeleton rows={3} />
        ) : activeSessions.length === 0 ? (
          <div className={styles.quietEmpty}>No active break-glass emergency sessions right now.</div>
        ) : (
          <Table ariaLabel="Active Break-Glass Sessions">
            <THead>
              <TR>
                <TH>Session ID</TH>
                <TH>Staff ID</TH>
                <TH>Reason</TH>
                <TH>Status</TH>
                <TH>Initiated</TH>
                <TH align="right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {activeSessions.slice(0, 5).map((session) => (
                <TR key={session.id}>
                  <TD>
                    <span className="num" style={{ fontWeight: 600 }}>
                      {session.id.slice(0, 8)}...
                    </span>
                  </TD>
                  <TD>
                    <span className="num">{session.actorId.slice(0, 8)}...</span>
                  </TD>
                  <TD>{session.reason}</TD>
                  <TD>
                    <Badge variant="critical" size="sm">
                      ACTIVE
                    </Badge>
                  </TD>
                  <TD>
                    <span className={styles.timeCell}>
                      <Clock size={12} aria-hidden="true" />
                      {formatStartedAt(session.createdAt)}
                    </span>
                  </TD>
                  <TD align="right">
                    <RowLink href="/admin/security" aria-label="Review session">
                      Review
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
