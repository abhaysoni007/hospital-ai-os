'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, RefreshCw, Clock, ArrowUpRight, Lock } from 'lucide-react';
import { ROLE_DISPLAY_NAMES } from '../../utils/rbac';
import { breakGlassService, type BreakGlassSessionResponse } from '../../services/break-glass-service';
import { Card, CardContent } from '../ui/Card/Card';
import { Badge } from '../ui/Badge/Badge';
import { AlertBanner } from '../ui/Alert/AlertBanner';
import { MetricCard } from '../ui/MetricCard/MetricCard';
import { Table, THead, TH, TBody, TR, TD, RowLink, TableSkeleton } from '../ui/Table/Table';
import styles from './DashboardShell.module.css';

export function SecurityAdminDashboard() {
  const [activeSessions, setActiveSessions] = useState<BreakGlassSessionResponse[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
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
      setNow(new Date());
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
    <div className={styles.dashboardContainer}>
      <header className={styles.greetingBanner}>
        <div>
          <h1 className={styles.greetingTitle}>
            <span className={styles.greetingIcon} aria-hidden="true">🛡️</span>
            Security, Compliance & Break-Glass Oversight
          </h1>
          <p className={styles.greetingSubtitle}>
            {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            {ROLE_DISPLAY_NAMES.security_admin} Console
          </p>
        </div>
        <div className={styles.greetingMeta}>
          <span className={styles.livePill}><span className={styles.liveDot} aria-hidden="true" />Audited</span>
          <button type="button" className={styles.refreshButton} onClick={() => void loadData()}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {/* Metrics */}
      <section aria-label="Security metrics" className={styles.metricRow}>
        <MetricCard
          label="Active Break-Glass Sessions"
          icon={<ShieldAlert size={16} aria-hidden="true" />}
          tone={activeSessions.length > 0 ? 'critical' : 'success'}
          href="/admin/security"
          value={loading ? '—' : activeSessions.length}
          hint={activeSessions.length === 0 ? 'No emergency overrides active' : 'Mandatory supervisory review required'}
        />
        <MetricCard
          label="Total Break-Glass Events"
          icon={<Lock size={16} aria-hidden="true" />}
          tone="neutral"
          href="/admin/security"
          value={loading ? '—' : totalCount}
          hint="Lifetime emergency overrides recorded"
        />
        <MetricCard
          label="Audit Ledger Status"
          icon={<ShieldCheck size={16} aria-hidden="true" />}
          tone="success"
          href="/admin/audit"
          value="SHA-256"
          hint="Immutable hash chain active"
        />
        <MetricCard
          label="RBAC Enforcement"
          icon={<ShieldCheck size={16} aria-hidden="true" />}
          tone="primary"
          value="Authoritative"
          hint="M5 server-enforced permissions"
        />
      </section>

      {/* Break-Glass Emergency Sessions */}
      <Card elevation="xs" padding="none" className={styles.tableCard}>
        <div className={styles.sectionCardHeader}>
          <div className={styles.sectionHeaderTitle}>
            <h3>Active Emergency Break-Glass Sessions</h3>
            <p>Clinicians currently operating under emergency elevated read privileges</p>
          </div>
          <Link href="/admin/security" className={styles.viewAllLink}>
            Open security review console <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <CardContent>
            <AlertBanner severity="warning" title="Security service unavailable">
              {error}
            </AlertBanner>
          </CardContent>
        ) : activeSessions.length === 0 ? (
          <CardContent>
            <p className={styles.quietEmpty}>Zero active break-glass emergency sessions. Standard RBAC rules apply to all clinicians.</p>
          </CardContent>
        ) : (
          <Table ariaLabel="Active Break-Glass Sessions">
            <THead>
              <tr>
                <TH>Session ID</TH>
                <TH>Actor (User ID)</TH>
                <TH>Reason</TH>
                <TH>Status</TH>
                <TH>Expires At</TH>
                <TH align="right">Action</TH>
              </tr>
            </THead>
            <TBody>
              {activeSessions.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <code style={{ fontSize: '0.8125rem' }}>{s.id.slice(0, 8)}…</code>
                  </TD>
                  <TD>
                    <span style={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>{s.actorId.slice(0, 12)}…</span>
                  </TD>
                  <TD>
                    <Badge variant="urgent" size="sm">
                      {s.reason.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge variant="critical" size="sm">
                      ACTIVE OVERRIDE
                    </Badge>
                  </TD>
                  <TD>
                    <span className={styles.timeCell}>
                      <Clock size={12} aria-hidden="true" />
                      {new Date(s.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </TD>
                  <TD align="right">
                    <RowLink href={`/admin/security`} aria-label="Review break glass session">
                      Review
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
