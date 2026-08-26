'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Stethoscope,
  AlertOctagon,
  Sparkles,
  ArrowUpRight,
  Clock,
  ChevronRight,
  FlaskConical,
  CheckCircle2,
} from 'lucide-react';
import type { AppointmentListItem, EncounterListItem } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { ROLE_DISPLAY_NAMES, hasPermission } from '../../utils/rbac';
import { mapAppointmentRows, todayIsoDate } from '../../utils/dashboard';
import { appointmentService } from '../../services/appointment-service';
import { encounterService } from '../../services/encounter-service';
import { diagnosticsService } from '../../services/diagnostics-service';
import { Card, CardHeader, CardContent } from '../ui/Card/Card';
import { Badge } from '../ui/Badge/Badge';
import { AlertBanner } from '../ui/Alert/AlertBanner';
import { MetricCard, MetricRetry } from '../ui/MetricCard/MetricCard';
import { PatientIdentity } from '../ui/Identity/Identity';
import {
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
  NumericTD,
  RowLink,
  TableSkeleton,
} from '../ui/Table/Table';
import { AppointmentStatusBadge } from '../ui/SemanticBadges/SemanticBadges';
import styles from './DashboardShell.module.css';

/**
 * M13 — REAL dashboard, attention-first.
 * Every number comes from a live backend endpoint; blocks render only for
 * roles holding the matching M5 permission. There are NO fabricated values:
 * loading shows skeletons, failures show truthful errors, empty means empty.
 */

type LoadState = 'loading' | 'ready' | 'error';

interface Block<T> {
  state: LoadState;
  data: T | null;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardShell() {
  const { user } = useAuth();
  const role = user?.role;
  const canReadAppointments = hasPermission(role, 'appointment:read');
  const canReadEncounters = hasPermission(role, 'encounter:read');
  const canReadDiagnostics = hasPermission(role, 'diagnostic_order:read');

  // Critical notifications (any authenticated role — server derives scope).
  const notifications = useNotifications(20);

  const [appointments, setAppointments] = useState<Block<AppointmentListItem[]>>({
    state: canReadAppointments ? 'loading' : 'ready',
    data: null,
  });
  const [encounters, setEncounters] = useState<Block<EncounterListItem[]>>({
    state: canReadEncounters ? 'loading' : 'ready',
    data: null,
  });
  const [pendingDiagnostics, setPendingDiagnostics] = useState<Block<number[]>>({
    state: canReadDiagnostics ? 'loading' : 'ready',
    data: null,
  });

  const loadAppointments = useCallback(async () => {
    if (!canReadAppointments) return;
    setAppointments({ state: 'loading', data: null });
    try {
      const res = await appointmentService.getAppointments({
        page: 1,
        date: todayIsoDate(),
        pageSize: 50,
      });
      setAppointments({ state: 'ready', data: res.data });
    } catch {
      setAppointments({ state: 'error', data: null });
    }
  }, [canReadAppointments]);

  const loadEncounters = useCallback(async () => {
    if (!canReadEncounters) return;
    setEncounters({ state: 'loading', data: null });
    try {
      const res = await encounterService.getEncounters({ page: 1, status: 'active', pageSize: 10 });
      setEncounters({ state: 'ready', data: res.data });
    } catch {
      setEncounters({ state: 'error', data: null });
    }
  }, [canReadEncounters]);

  const loadPendingDiagnostics = useCallback(async () => {
    if (!canReadDiagnostics) return;
    setPendingDiagnostics({ state: 'loading', data: null });
    try {
      const [ordered, collected] = await Promise.all([
        diagnosticsService.getLabQueue({ page: 1, status: 'ordered', pageSize: 1 }),
        diagnosticsService.getLabQueue({ page: 1, status: 'sample_collected', pageSize: 1 }),
      ]);
      setPendingDiagnostics({
        state: 'ready',
        data: [ordered.meta.total, collected.meta.total],
      });
    } catch {
      setPendingDiagnostics({ state: 'error', data: null });
    }
  }, [canReadDiagnostics]);

  useEffect(() => {
    void loadAppointments();
    void loadEncounters();
    void loadPendingDiagnostics();
  }, [loadAppointments, loadEncounters, loadPendingDiagnostics]);

  const greetingName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email.split('@')[0] || 'Clinician';
  const roleTitle = role ? ROLE_DISPLAY_NAMES[role] : 'Staff';

  const criticalItems = notifications.items.filter(
    (n) => n.priority === 'critical' && n.status !== 'acknowledged',
  );

  const appointmentRows =
    appointments.state === 'ready' ? mapAppointmentRows(appointments.data ?? []) : [];

  return (
    <div className={styles.dashboardContainer}>
      {/* 1. Greeting + real date */}
      <div className={styles.greetingBanner}>
        <div>
          <h1 className={styles.greetingTitle}>
            {greetingForHour(new Date().getHours())}, {greetingName}
          </h1>
          <p className={styles.greetingSubtitle}>
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {' · '}
            {roleTitle}
            {criticalItems.length > 0
              ? ` · ${criticalItems.length} critical result${criticalItems.length === 1 ? '' : 's'} awaiting review`
              : ''}
          </p>
        </div>
      </div>

      {/* 2. CRITICAL ATTENTION — only what the backend actually reports */}
      {notifications.isLoading && (
        <div className={styles.alertSection} role="status" aria-label="Loading critical alerts">
          <div className={styles.criticalSkeleton} />
        </div>
      )}
      {notifications.error && (
        <div className={styles.alertSection}>
          <AlertBanner severity="warning" title="Critical alert queue unavailable">
            The system could not verify whether critical results are waiting. Retry from the
            notification panel.
          </AlertBanner>
        </div>
      )}
      {!notifications.isLoading &&
        !notifications.error &&
        (criticalItems.length > 0 ? (
          <section aria-labelledby="critical-attention-heading" className={styles.alertSection}>
            <h2 id="critical-attention-heading" className={styles.sectionLabel}>
              Critical attention
            </h2>
            <ul className={styles.criticalList}>
              {criticalItems.slice(0, 3).map((n) => (
                <li key={n.id} className={styles.criticalItem}>
                  <span className={styles.criticalIconWrap}>
                    <AlertOctagon size={18} aria-hidden="true" />
                  </span>
                  <div className={styles.criticalBody}>
                    <span className={styles.criticalTitle}>{n.title}</span>
                    <span className={styles.criticalMeta}>{n.body}</span>
                    <span className={styles.criticalTime}>
                      <Clock size={11} aria-hidden="true" />
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {n.relatedOrderId && (
                    <Link href={`/diagnostics/${n.relatedOrderId}`} className={styles.criticalCta}>
                      Review result
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </li>
              ))}
              {criticalItems.length > 3 && (
                <li className={styles.criticalMore}>
                  + {criticalItems.length - 3} more in the work queue below
                </li>
              )}
            </ul>
          </section>
        ) : (
          <div className={styles.allClear} role="status">
            <CheckCircle2 size={16} aria-hidden="true" />
            No critical results require your attention right now.
          </div>
        ))}

      {/* 3. Today at a glance — every metric is real and navigates */}
      <section aria-label="Today's operational summary" className={styles.metricGrid}>
        {canReadAppointments && (
          <MetricCard
            label="Today's schedule"
            icon={<Calendar size={16} aria-hidden="true" />}
            tone="primary"
            href="/appointments"
            value={
              appointments.state === 'loading' ? (
                <span className={styles.metricSkeleton}>—</span>
              ) : appointments.state === 'error' ? (
                <MetricRetry onRetry={() => void loadAppointments()} label="Retry" />
              ) : (
                appointmentRows.length
              )
            }
            hint={
              appointments.state === 'ready'
                ? appointmentRows.length === 0
                  ? 'Nothing booked for today'
                  : 'appointments today (your department)'
                : undefined
            }
          />
        )}
        {canReadEncounters && (
          <MetricCard
            label="Active encounters"
            icon={<Stethoscope size={16} aria-hidden="true" />}
            tone="info"
            href="/encounters"
            value={
              encounters.state === 'loading' ? (
                <span className={styles.metricSkeleton}>—</span>
              ) : encounters.state === 'error' ? (
                <MetricRetry onRetry={() => void loadEncounters()} label="Retry" />
              ) : (
                (encounters.data?.length ?? 0)
              )
            }
            hint={encounters.state === 'ready' ? 'in progress right now' : undefined}
          />
        )}
        {canReadDiagnostics && (
          <MetricCard
            label="Pending lab work"
            icon={<FlaskConical size={16} aria-hidden="true" />}
            tone="warning"
            href="/diagnostics"
            value={
              pendingDiagnostics.state === 'loading' ? (
                <span className={styles.metricSkeleton}>—</span>
              ) : pendingDiagnostics.state === 'error' ? (
                <MetricRetry onRetry={() => void loadPendingDiagnostics()} label="Retry" />
              ) : (
                (pendingDiagnostics.data?.[0] ?? 0) + (pendingDiagnostics.data?.[1] ?? 0)
              )
            }
            hint={
              pendingDiagnostics.state === 'ready' ? 'awaiting collection / processing' : undefined
            }
          />
        )}
        <MetricCard
          label="Unacknowledged critical alerts"
          icon={<AlertOctagon size={16} aria-hidden="true" />}
          tone={criticalItems.length > 0 ? 'critical' : 'success'}
          liveValue
          value={
            notifications.isLoading ? (
              <span className={styles.metricSkeleton}>—</span>
            ) : (
              criticalItems.length
            )
          }
          hint={
            !notifications.isLoading && criticalItems.length === 0
              ? 'queue is clear'
              : 'assigned to you · unacknowledged'
          }
        />
      </section>

      {/* 4. Operational split */}
      <div className={styles.splitLayout}>
        <div className={styles.leftColumn}>
          {canReadAppointments && (
            <Card elevation="xs" padding="none">
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionHeaderTitle}>
                  <h3>Today&apos;s schedule</h3>
                  <p>Your department · live booking data</p>
                </div>
                {appointments.state === 'ready' && (
                  <Link href="/appointments" className={styles.viewAllLink}>
                    View all <ChevronRight size={12} aria-hidden="true" />
                  </Link>
                )}
              </div>
              {appointments.state === 'loading' ? (
                <TableSkeleton rows={4} />
              ) : appointments.state === 'error' ? (
                <CardContent>
                  <AlertBanner severity="warning" title="Could not load the schedule">
                    The scheduling service did not respond.
                  </AlertBanner>
                </CardContent>
              ) : appointmentRows.length === 0 ? (
                <CardContent>
                  <p className={styles.quietEmpty}>No appointments scheduled for today.</p>
                </CardContent>
              ) : (
                <Table ariaLabel="Today's appointment schedule">
                  <THead>
                    <tr>
                      <TH width="72px">Token</TH>
                      <TH>Patient</TH>
                      <TH width="88px">Time</TH>
                      <TH>Status</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {appointmentRows.map((row) => (
                      <TR key={row.id}>
                        <NumericTD>
                          {row.token !== null ? `#${String(row.token).padStart(2, '0')}` : '—'}
                        </NumericTD>
                        <TD>
                          <PatientIdentity
                            compact
                            firstName={row.patientName.split(' ')[0]}
                            lastName={row.patientName.split(' ').slice(1).join(' ')}
                            mrn={row.mrn}
                          />
                        </TD>
                        <TD>
                          <span className={styles.timeCell}>
                            <Clock size={12} aria-hidden="true" />
                            {row.time}
                          </span>
                        </TD>
                        <TD>
                          <AppointmentStatusBadge status={row.status} size="sm" />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          )}

          {!canReadAppointments && canReadEncounters && (
            <Card elevation="xs" padding="none">
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionHeaderTitle}>
                  <h3>Active encounters</h3>
                  <p>Your department · most recent first</p>
                </div>
                {encounters.state === 'ready' && (
                  <Link href="/encounters" className={styles.viewAllLink}>
                    View all <ChevronRight size={12} aria-hidden="true" />
                  </Link>
                )}
              </div>
              {encounters.state === 'loading' ? (
                <TableSkeleton rows={4} />
              ) : encounters.state === 'error' ? (
                <CardContent>
                  <AlertBanner severity="warning" title="Could not load encounters">
                    The encounter service did not respond.
                  </AlertBanner>
                </CardContent>
              ) : (encounters.data?.length ?? 0) === 0 ? (
                <CardContent>
                  <p className={styles.quietEmpty}>No active encounters right now.</p>
                </CardContent>
              ) : (
                <Table ariaLabel="Active encounters">
                  <THead>
                    <tr>
                      <TH>Patient</TH>
                      <TH>Type</TH>
                      <TH>Status</TH>
                      <TH aria-label="Open" />
                    </tr>
                  </THead>
                  <TBody>
                    {(encounters.data ?? []).map((e) => (
                      <TR key={e.id}>
                        <TD>
                          <PatientIdentity
                            compact
                            firstName={e.patient.firstName}
                            lastName={e.patient.lastName}
                            mrn={e.patient.mrn}
                          />
                        </TD>
                        <TD>{e.encounterType.replace('_', ' ')}</TD>
                        <TD>
                          <Badge variant="primary" size="sm">
                            Active
                          </Badge>
                        </TD>
                        <TD align="right">
                          <RowLink href={`/encounters/${e.id}`} aria-label={`Open encounter`}>
                            Open
                          </RowLink>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          )}

          {canReadAppointments && canReadEncounters && (
            <Card elevation="xs" padding="none">
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionHeaderTitle}>
                  <h3>Active clinical work</h3>
                  <p>Encounters currently in progress</p>
                </div>
                {encounters.state === 'ready' && (
                  <Link href="/encounters" className={styles.viewAllLink}>
                    View all <ChevronRight size={12} aria-hidden="true" />
                  </Link>
                )}
              </div>
              {encounters.state === 'loading' ? (
                <TableSkeleton rows={3} />
              ) : encounters.state === 'error' ? (
                <CardContent>
                  <AlertBanner severity="warning" title="Could not load encounters">
                    The encounter service did not respond.
                  </AlertBanner>
                </CardContent>
              ) : (encounters.data?.length ?? 0) === 0 ? (
                <CardContent>
                  <p className={styles.quietEmpty}>
                    No active encounters. New consultations appear here after check-in.
                  </p>
                </CardContent>
              ) : (
                <Table ariaLabel="Active clinical work">
                  <THead>
                    <tr>
                      <TH>Patient</TH>
                      <TH>Type</TH>
                      <TH>Status</TH>
                      <TH aria-label="Open" />
                    </tr>
                  </THead>
                  <TBody>
                    {(encounters.data ?? []).slice(0, 5).map((e) => (
                      <TR key={e.id}>
                        <TD>
                          <PatientIdentity
                            compact
                            firstName={e.patient.firstName}
                            lastName={e.patient.lastName}
                            mrn={e.patient.mrn}
                          />
                        </TD>
                        <TD>{e.encounterType.replace('_', ' ')}</TD>
                        <TD>
                          <Badge variant="primary" size="sm">
                            Active
                          </Badge>
                        </TD>
                        <TD align="right">
                          <RowLink href={`/encounters/${e.id}`} aria-label={`Open encounter`}>
                            Open
                          </RowLink>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          )}
        </div>

        {/* Right column: real critical work queue + honest AI card */}
        <div className={styles.rightColumn}>
          <Card elevation="xs" padding="md">
            <CardHeader
              title="Critical result work queue"
              subtitle="Assigned to you · unacknowledged"
              action={
                <Badge variant={criticalItems.length > 0 ? 'critical' : 'stable'} size="sm">
                  {notifications.isLoading ? '…' : criticalItems.length}
                </Badge>
              }
            />
            <CardContent>
              {notifications.isLoading ? (
                <div role="status" aria-label="Loading work queue">
                  <div className={styles.queueSkeleton} />
                </div>
              ) : notifications.error ? (
                <div role="alert">
                  <AlertBanner severity="warning" title="Queue unavailable">
                    {notifications.error}
                  </AlertBanner>
                </div>
              ) : criticalItems.length === 0 ? (
                <p className={styles.quietEmpty}>No critical results awaiting your review.</p>
              ) : (
                <ul className={styles.taskList}>
                  {criticalItems.map((n) => (
                    <li key={n.id} className={styles.taskItem}>
                      <span className={styles.taskTitle}>{n.title}</span>
                      <div className={styles.taskMeta}>
                        <Clock size={12} aria-hidden="true" />
                        <span>
                          {new Date(n.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className={styles.metaDot} aria-hidden="true">
                          •
                        </span>
                        <Badge variant="critical" size="sm">
                          CRITICAL
                        </Badge>
                      </div>
                      <div className={styles.taskActions}>
                        {n.relatedOrderId && (
                          <RowLink
                            href={`/diagnostics/${n.relatedOrderId}`}
                            aria-label={`Review result for ${n.title}`}
                          >
                            Review result
                          </RowLink>
                        )}
                        <button
                          type="button"
                          className={styles.textButton}
                          onClick={() => void notifications.acknowledge(n.id)}
                          aria-label={`Acknowledge ${n.title}`}
                        >
                          Acknowledge
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card elevation="xs" padding="md" className={styles.aiCard}>
            <div className={styles.aiHeader}>
              <div className={styles.aiIconCircle}>
                <Sparkles size={20} aria-hidden="true" />
              </div>
              <div className={styles.aiTitleBlock}>
                <Badge variant="ai-assist" size="sm">
                  Clinical AI — governed
                </Badge>
                <h4 className={styles.aiTitle}>SOURCE-GROUNDED note drafting</h4>
              </div>
            </div>
            <p className={styles.aiDesc}>
              Commission an AI-drafted SOAP or progress note inside an active encounter — with
              verifiable citations, system-computed documentation gaps, and mandatory clinician
              review before anything is signed.
            </p>
            <Link href="/encounters" className={styles.aiButton}>
              Open an encounter to begin
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
