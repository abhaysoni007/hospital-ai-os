'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
} from 'lucide-react';
import type { EncounterListItem } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { hasPermission } from '../../utils/rbac';
import {
  bucketEncountersByDay,
  computeAvgEncounterMinutes,
  computeDayOverDayDelta,
  computeEncounterStatusDistribution,
  formatDurationMinutes,
  weekdayShortLabel,
} from '../../utils/dashboard';
import { encounterService } from '../../services/encounter-service';
import { diagnosticsService } from '../../services/diagnostics-service';
import { appointmentService } from '../../services/appointment-service';
import { Badge } from '../ui/Badge/Badge';
import { PatientIdentity } from '../ui/Identity/Identity';
import { Table, THead, TH, TBody, TR, TD, RowLink, TableSkeleton } from '../ui/Table/Table';
import { LineChart, LineChartTone } from '../ui/LineChart/LineChart';
import { DonutChart, DonutTone } from '../ui/DonutChart/DonutChart';
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

type LoadState = 'loading' | 'ready' | 'error';

interface Block<T> {
  state: LoadState;
  data: T | null;
}

const DONUT_TONE_BY_STATUS: Record<string, DonutTone> = {
  active: 'primary',
  in_progress: 'primary',
  in_consult: 'primary',
  booked: 'info',
  scheduled: 'info',
  checked_in: 'info',
  completed: 'success',
  discharged: 'success',
  cancelled: 'neutral',
};

const DONUT_LABEL_BY_STATUS: Record<string, string> = {
  active: 'Active',
  in_progress: 'In Progress',
  in_consult: 'In Progress',
  booked: 'Scheduled',
  scheduled: 'Scheduled',
  checked_in: 'Checked In',
  completed: 'Completed',
  discharged: 'Discharged',
  cancelled: 'Cancelled',
};

function formatStartedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function PhysicianDashboard() {
  const { user } = useAuth();
  const role = user?.role;
  const canReadEncounters = hasPermission(role, 'encounter:read');
  const canReadDiagnostics = hasPermission(role, 'diagnostic_order:read');
  const canReadAppointments = hasPermission(role, 'appointment:read');

  const { range, setRange } = useDateRange('7d');
  const notifications = useNotifications(40);

  const [activeEncounters, setActiveEncounters] = useState<Block<EncounterListItem[]>>({
    state: canReadEncounters ? 'loading' : 'ready',
    data: null,
  });
  const [encounterSeries, setEncounterSeries] = useState<Block<EncounterListItem[]>>({
    state: canReadEncounters ? 'loading' : 'ready',
    data: null,
  });
  const [awaitingReview, setAwaitingReview] = useState<Block<number>>({
    state: canReadDiagnostics ? 'loading' : 'ready',
    data: null,
  });
  const [appointmentsToday, setAppointmentsToday] = useState<Block<number>>({
    state: canReadAppointments ? 'loading' : 'ready',
    data: null,
  });

  const mounted = useRef(true);

  const loadData = useCallback(async () => {
    if (canReadEncounters) {
      encounterService
        .getEncounters({ page: 1, status: 'active', pageSize: 100 })
        .then((res) => {
          if (mounted.current) setActiveEncounters({ state: 'ready', data: res.data });
        })
        .catch(() => {
          if (mounted.current) setActiveEncounters({ state: 'error', data: null });
        });

      encounterService
        .getEncounters({ page: 1, pageSize: 100 })
        .then((res) => {
          if (mounted.current) setEncounterSeries({ state: 'ready', data: res.data });
        })
        .catch(() => {
          if (mounted.current) setEncounterSeries({ state: 'error', data: null });
        });
    }

    if (canReadDiagnostics) {
      diagnosticsService
        .getLabQueue({ page: 1, status: 'completed', pageSize: 1 })
        .then((res) => {
          if (mounted.current) setAwaitingReview({ state: 'ready', data: res.meta.total });
        })
        .catch(() => {
          if (mounted.current) setAwaitingReview({ state: 'error', data: null });
        });
    }

    if (canReadAppointments) {
      appointmentService
        .getAppointments({ page: 1, pageSize: 100 })
        .then((res) => {
          if (mounted.current)
            setAppointmentsToday({
              state: 'ready',
              data: Array.isArray(res?.data) ? res.data.length : 0,
            });
        })
        .catch(() => {
          if (mounted.current) setAppointmentsToday({ state: 'error', data: null });
        });
    }
  }, [canReadEncounters, canReadDiagnostics, canReadAppointments]);

  useEffect(() => {
    mounted.current = true;
    void loadData();
    return () => {
      mounted.current = false;
    };
  }, [loadData]);

  const greetingName =
    user?.firstName && user?.lastName
      ? `Dr. ${user.firstName} ${user.lastName}`
      : user?.firstName
        ? `Dr. ${user.firstName}`
        : 'Dr. Clinician';

  const criticalItems = useMemo(
    () =>
      notifications.items.filter((n) => n.priority === 'critical' && n.status !== 'acknowledged'),
    [notifications.items],
  );

  const [now] = useState(() => new Date());

  const buckets = useMemo(() => {
    if (encounterSeries.state !== 'ready' || !encounterSeries.data) return [];
    return bucketEncountersByDay(encounterSeries.data, 7, now);
  }, [encounterSeries, now]);

  const statusDistribution = useMemo(() => {
    if (encounterSeries.state !== 'ready' || !encounterSeries.data) return [];
    return computeEncounterStatusDistribution(encounterSeries.data);
  }, [encounterSeries]);

  const seriesTotal = buckets.map((b) => b.count);
  const volumeDelta = computeDayOverDayDelta(buckets);

  return (
    <div className="space-y-4">
      {/* 1. Lovable Role Intro */}
      <RoleIntro
        title="Clinical workspace"
        subtitle={`${greetingName} · Internal Medicine · your patients, documentation and results in priority order.`}
        aside={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {/* 2. Lovable Critical Result Alert Banner */}
      {!notifications.isLoading && criticalItems.length > 0 && (
        <CriticalResultBanner
          testName={criticalItems[0].title}
          value={criticalItems[0].body}
          patientName="Urgent Escalation"
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

      {/* 3. Lovable 4-card Metric Grid */}
      <MetricGrid columns={4}>
        <RoleMetricCard
          label="Today's appointments"
          value={appointmentsToday.state === 'ready' ? (appointmentsToday.data ?? 0) : '—'}
          hint="Your clinic schedule"
          href="/appointments"
          delta={volumeDelta?.percent}
        />
        <RoleMetricCard
          label="Active encounters"
          value={activeEncounters.state === 'ready' ? (activeEncounters.data?.length ?? 0) : '—'}
          hint="Open or awaiting results"
          href="/encounters"
        />
        <RoleMetricCard
          label="Results awaiting review"
          value={awaitingReview.state === 'ready' ? (awaitingReview.data ?? 0) : '—'}
          hint="Diagnostic orders completed"
          href="/diagnostics"
          tone="warning"
        />
        <RoleMetricCard
          label="Critical alerts"
          value={notifications.isLoading ? '—' : criticalItems.length}
          hint={criticalItems.length === 0 ? 'All results clear' : 'Requires acknowledgement now'}
          tone={criticalItems.length > 0 ? 'critical' : 'success'}
          href="/diagnostics"
        />
      </MetricGrid>

      {/* 4. Lovable Analytical Dashboard Grid */}
      <DashboardGrid columns={2}>
        <ChartCard
          title="Encounter volume"
          decision="Am I carrying more clinical load than usual this week?"
          action={{ label: 'Encounters', href: '/encounters' }}
          summary="Daily encounter trend across your service"
        >
          {encounterSeries.state === 'loading' ? (
            <div className={styles.chartSkeleton} />
          ) : buckets.length === 0 ? (
            <p className={styles.quietEmpty}>No encounter activity in the visible window.</p>
          ) : (
            <div style={{ height: 220 }}>
              <LineChart
                series={[
                  {
                    label: 'Encounters',
                    tone: 'info' as LineChartTone,
                    data: seriesTotal,
                  },
                ]}
                xLabels={buckets.map((b) => weekdayShortLabel(b.date))}
                yMax={Math.max(1, ...seriesTotal)}
                ariaLabel="7-day encounter volume trend"
              />
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Encounter distribution"
          decision="What is the current patient status mix across the unit?"
          action={{ label: 'View encounters', href: '/encounters' }}
          summary="Distribution of encounters by status"
        >
          {encounterSeries.state === 'loading' ? (
            <div className={styles.chartSkeleton} />
          ) : statusDistribution.length === 0 ? (
            <p className={styles.quietEmpty}>No encounters to distribute.</p>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DonutChart
                segments={statusDistribution.map((d) => ({
                  label: DONUT_LABEL_BY_STATUS[d.status] || d.status,
                  value: d.count,
                  tone: DONUT_TONE_BY_STATUS[d.status] || 'neutral',
                }))}
                centerLabel={String(statusDistribution.reduce((acc, d) => acc + d.count, 0))}
                centerSublabel="Total"
                ariaLabel="Encounter distribution by clinical status"
              />
            </div>
          )}
        </ChartCard>
      </DashboardGrid>

      {/* 5. Active Clinical Encounters Queue */}
      <section className={styles.queuePanel} aria-label="Active patient encounters">
        <header className={styles.queueHeader}>
          <div>
            <h2 className={styles.queueTitle}>
              Active Patient Encounters
            </h2>
            <p className={styles.queueSubtitle}>
              Patients currently under care in consultation or ward observation.
            </p>
          </div>
          <Link href="/encounters" className={styles.queueLink}>
            Full encounter queue →
          </Link>
        </header>

        {activeEncounters.state === 'loading' ? (
          <TableSkeleton rows={4} />
        ) : !activeEncounters.data || activeEncounters.data.length === 0 ? (
          <div className={styles.quietEmpty}>No active encounters right now.</div>
        ) : (
          <Table ariaLabel="Active Clinical Encounters">
            <THead>
              <TR>
                <TH>Patient</TH>
                <TH>Type</TH>
                <TH>Physician</TH>
                <TH>Status</TH>
                <TH>Elapsed</TH>
                <TH>Started</TH>
                <TH align="right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {activeEncounters.data.slice(0, 5).map((e) => {
                const minutes = e.startedAt
                  ? computeAvgEncounterMinutes([e], now)
                  : null;
                return (
                  <TR key={e.id}>
                    <TD>
                      <PatientIdentity
                        firstName={e.patient?.firstName ?? 'Unregistered'}
                        lastName={e.patient?.lastName ?? ''}
                        mrn={e.patient?.mrn ?? 'MRN-—'}
                        dateOfBirth={e.patient?.dateOfBirth}
                        gender={e.patient?.gender}
                        compact
                      />
                    </TD>
                    <TD>
                      <Badge variant="primary" size="sm">
                        {e.encounterType === 'opd' ? 'OPD' : 'FOLLOW-UP'}
                      </Badge>
                    </TD>
                    <TD>
                      <span className={styles.physicianName}>
                        {user?.firstName ? `Dr. ${user.firstName}` : 'Attending'}
                      </span>
                    </TD>
                    <TD>
                      <Badge variant="info" size="sm">
                        In Progress
                      </Badge>
                    </TD>
                    <TD>
                      <span className={styles.timeCell}>
                        <Clock size={12} aria-hidden="true" />
                        {minutes === null ? '—' : formatDurationMinutes(minutes)}
                      </span>
                    </TD>
                    <TD>
                      <span className={styles.timeCell}>
                        {formatStartedAt(e.startedAt ?? e.createdAt)}
                      </span>
                    </TD>
                    <TD align="right">
                      <RowLink href={`/encounters/${e.id}`} aria-label="Open encounter">
                        Open
                      </RowLink>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </section>

      {/* 6. Quiet state when no critical alerts */}
      {!notifications.isLoading &&
        criticalItems.length === 0 && (
          <div className={styles.allClear} role="status">
            <CheckCircle2 size={16} aria-hidden="true" />
            No critical results require your attention right now.
          </div>
        )}
    </div>
  );
}
