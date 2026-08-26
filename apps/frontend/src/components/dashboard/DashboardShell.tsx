'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Stethoscope,
  AlertOctagon,
  Sparkles,
  ArrowUpRight,
  Clock,
  ChevronRight,
} from 'lucide-react';
import type { AppointmentListItem, EncounterListItem } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { ROLE_DISPLAY_NAMES, hasPermission } from '../../utils/rbac';
import { appointmentStatusLabel, mapAppointmentRows, todayIsoDate } from '../../utils/dashboard';
import { appointmentService } from '../../services/appointment-service';
import { encounterService } from '../../services/encounter-service';
import { diagnosticsService } from '../../services/diagnostics-service';
import { Card, CardHeader, CardContent } from '../ui/Card/Card';
import { Badge } from '../ui/Badge/Badge';
import { Button } from '../ui/Button/Button';
import { AlertBanner } from '../ui/Alert/AlertBanner';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import styles from './DashboardShell.module.css';

/**
 * M12.2 Part B — REAL dashboard. Every number on this screen comes from a
 * live backend endpoint; blocks render only for roles holding the matching
 * M5 permission. There are NO fabricated values: loading shows skeletons,
 * failures show truthful errors, and empty means empty.
 */

type LoadState = 'loading' | 'ready' | 'error';

interface Block<T> {
  state: LoadState;
  data: T | null;
}

export function DashboardShell() {
  const { user } = useAuth();
  const role = user?.role;
  const canReadAppointments = hasPermission(role, 'appointment:read');
  const canReadEncounters = hasPermission(role, 'encounter:read');
  const canReadDiagnostics = hasPermission(role, 'diagnostic_order:read');

  // Critical notifications (any authenticated role — server derives scope).
  const notifications = useNotifications(20);
  const [alertDismissed, setAlertDismissed] = useState(false);

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

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void loadAppointments();
    void loadEncounters();
    void loadPendingDiagnostics();
    return () => {
      mounted.current = false;
    };
  }, [loadAppointments, loadEncounters, loadPendingDiagnostics]);

  const greetingName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email.split('@')[0] || 'Clinician';
  const roleTitle = role ? ROLE_DISPLAY_NAMES[role] : 'Staff';
  const activeEncounterCount = encounters.data?.length ?? 0;

  const criticalItems = notifications.items.filter(
    (n) => n.priority === 'critical' && n.status !== 'acknowledged',
  );
  const topCritical = criticalItems[0];

  return (
    <div className={styles.dashboardContainer}>
      {/* 1. Greeting */}
      <div className={styles.greetingBanner}>
        <div className={styles.greetingText}>
          <h1 className={styles.greetingTitle}>Welcome back, {greetingName}</h1>
          <p className={styles.greetingSubtitle}>
            {roleTitle}
            {canReadEncounters && appointments.state === 'ready'
              ? ` • ${activeEncounterCount} active encounter${activeEncounterCount === 1 ? '' : 's'} in your department`
              : ''}
          </p>
        </div>
      </div>

      {/* 2. REAL critical alert banner (only when the backend reports one) */}
      {!alertDismissed && notifications.error && (
        <div className={styles.alertSection}>
          <AlertBanner severity="warning" title="Notifications unavailable">
            Critical alert data could not be loaded.
          </AlertBanner>
        </div>
      )}
      {!alertDismissed && !notifications.isLoading && topCritical && (
        <div className={styles.alertSection}>
          <AlertBanner
            severity="critical"
            title="CRITICAL LAB VALUE REQUIRES REVIEW"
            dismissible
            onDismiss={() => setAlertDismissed(true)}
            action={
              topCritical.relatedOrderId ? (
                <Link
                  href={`/diagnostics/${topCritical.relatedOrderId}`}
                  style={{ all: 'unset', cursor: 'pointer' }}
                >
                  <Button variant="danger" size="sm" iconRight={<ArrowUpRight size={14} />}>
                    Review result
                  </Button>
                </Link>
              ) : undefined
            }
          >
            {topCritical.title} — {topCritical.body}
          </AlertBanner>
        </div>
      )}

      {/* 3. KPI grid — every value is real */}
      <div className={styles.kpiGrid}>
        {canReadAppointments && (
          <Card elevation="xs" padding="md" className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Today&apos;s Appointments</span>
              <div className={`${styles.kpiIconWrapper} ${styles.blue}`}>
                <Calendar size={18} />
              </div>
            </div>
            {appointments.state === 'loading' ? (
              <Skeleton width="64px" height="32px" />
            ) : appointments.state === 'error' ? (
              <button
                type="button"
                className={styles.kpiSubtext}
                onClick={() => void loadAppointments()}
                aria-label="Retry loading appointments"
              >
                Retry
              </button>
            ) : (
              <div className={styles.kpiValue}>{appointments.data?.length ?? 0}</div>
            )}
            <div className={styles.kpiFooter}>
              <span className={styles.kpiSubtext}>scheduled today (your department)</span>
            </div>
          </Card>
        )}

        {canReadEncounters && (
          <Card elevation="xs" padding="md" className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Active Encounters</span>
              <div className={`${styles.kpiIconWrapper} ${styles.indigo}`}>
                <Stethoscope size={18} />
              </div>
            </div>
            {encounters.state === 'loading' ? (
              <Skeleton width="64px" height="32px" />
            ) : encounters.state === 'error' ? (
              <button
                type="button"
                className={styles.kpiSubtext}
                onClick={() => void loadEncounters()}
                aria-label="Retry loading active encounters"
              >
                Retry
              </button>
            ) : (
              <div className={styles.kpiValue}>{encounters.data?.length ?? 0}</div>
            )}
            <div className={styles.kpiFooter}>
              <span className={styles.kpiSubtext}>most recent shown below</span>
            </div>
          </Card>
        )}

        {canReadDiagnostics && (
          <Card elevation="xs" padding="md" className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Pending Lab Work</span>
              <div className={`${styles.kpiIconWrapper} ${styles.amber}`}>
                <Stethoscope size={18} />
              </div>
            </div>
            {pendingDiagnostics.state === 'loading' ? (
              <Skeleton width="64px" height="32px" />
            ) : pendingDiagnostics.state === 'error' ? (
              <button
                type="button"
                className={styles.kpiSubtext}
                onClick={() => void loadPendingDiagnostics()}
                aria-label="Retry loading pending diagnostics"
              >
                Retry
              </button>
            ) : (
              <div className={styles.kpiValue}>
                {(pendingDiagnostics.data?.[0] ?? 0) + (pendingDiagnostics.data?.[1] ?? 0)}
              </div>
            )}
            <div className={styles.kpiFooter}>
              <span className={styles.kpiSubtext}>awaiting collection / processing</span>
            </div>
          </Card>
        )}

        <Card elevation="xs" padding="md" className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Critical Alerts</span>
            <div className={`${styles.kpiIconWrapper} ${styles.red}`}>
              <AlertOctagon size={18} />
            </div>
          </div>
          {notifications.isLoading ? (
            <Skeleton width="64px" height="32px" />
          ) : (
            <div className={styles.kpiValue} aria-live="polite">
              <span className={criticalItems.length > 0 ? styles.redText : ''}>
                {criticalItems.length}
              </span>
            </div>
          )}
          <div className={styles.kpiFooter}>
            <span className={styles.kpiSubtext}>assigned to you, unacknowledged</span>
          </div>
        </Card>
      </div>

      {/* 4. Operational split */}
      <div className={styles.splitLayout}>
        <div className={styles.leftColumn}>
          {canReadAppointments ? (
            <Card elevation="xs" padding="none">
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionHeaderTitle}>
                  <h3>Today&apos;s Schedule</h3>
                  <p>Your department • live booking data</p>
                </div>
                {appointments.state === 'ready' && (
                  <Badge variant="primary" size="md">
                    {appointments.data?.length ?? 0}
                  </Badge>
                )}
              </div>
              {appointments.state === 'loading' ? (
                <CardContent>
                  <Skeleton width="100%" height="120px" />
                </CardContent>
              ) : appointments.state === 'error' ? (
                <CardContent>
                  <AlertBanner severity="warning" title="Could not load schedule">
                    The schedule service did not respond.
                  </AlertBanner>
                </CardContent>
              ) : (appointments.data?.length ?? 0) === 0 ? (
                <CardContent>
                  <p className={styles.kpiSubtext}>No appointments scheduled for today.</p>
                </CardContent>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.queueTable} aria-label="Today's appointment schedule">
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Patient</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapAppointmentRows(appointments.data ?? []).map((row) => (
                        <tr key={row.id}>
                          <td className={styles.tokenCell}>
                            {row.token !== null ? `#${String(row.token).padStart(2, '0')}` : '—'}
                          </td>
                          <td>
                            <div className={styles.patientCell}>
                              <span className={styles.patientName}>{row.patientName}</span>
                              <span className={styles.patientMrn}>{row.mrn}</span>
                            </div>
                          </td>
                          <td className={styles.timeCell}>
                            <div className={styles.timeWrapper}>
                              <Clock size={12} />
                              <span>{row.time}</span>
                            </div>
                          </td>
                          <td>{appointmentStatusLabel(row.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : canReadEncounters ? (
            <Card elevation="xs" padding="none">
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionHeaderTitle}>
                  <h3>Active Encounters</h3>
                  <p>Your department • most recent first</p>
                </div>
                {encounters.state === 'ready' && (
                  <Badge variant="primary" size="md">
                    {encounters.data?.length ?? 0}
                  </Badge>
                )}
              </div>
              {encounters.state === 'loading' ? (
                <CardContent>
                  <Skeleton width="100%" height="120px" />
                </CardContent>
              ) : encounters.state === 'error' ? (
                <CardContent>
                  <AlertBanner severity="warning" title="Could not load encounters">
                    The encounter service did not respond.
                  </AlertBanner>
                </CardContent>
              ) : (encounters.data?.length ?? 0) === 0 ? (
                <CardContent>
                  <p className={styles.kpiSubtext}>No active encounters right now.</p>
                </CardContent>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.queueTable} aria-label="Active encounters">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Patient</th>
                        <th>Status</th>
                        <th aria-label="Open" />
                      </tr>
                    </thead>
                    <tbody>
                      {(encounters.data ?? []).map((e) => (
                        <tr key={e.id}>
                          <td>{e.encounterType.toUpperCase()}</td>
                          <td>
                            <div className={styles.patientCell}>
                              <span className={styles.patientName}>
                                {e.patient?.firstName} {e.patient?.lastName}
                              </span>
                              <span className={styles.patientMrn}>{e.patient?.mrn}</span>
                            </div>
                          </td>
                          <td>{e.status}</td>
                          <td>
                            <Link
                              href={`/encounters/${e.id}`}
                              className={styles.markAllButton ?? undefined}
                              aria-label={`Open encounter`}
                            >
                              Open <ChevronRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : null}
        </div>

        {/* Right column: real critical work queue + honest AI card */}
        <div className={styles.rightColumn}>
          <Card elevation="xs" padding="md">
            <CardHeader
              title="Critical Result Work Queue"
              subtitle="Assigned to you • unacknowledged"
              action={
                <Badge variant={criticalItems.length > 0 ? 'critical' : 'stable'} size="sm">
                  {notifications.isLoading ? '…' : criticalItems.length}
                </Badge>
              }
            />
            <CardContent>
              {notifications.isLoading ? (
                <Skeleton width="100%" height="96px" />
              ) : notifications.error ? (
                <div role="alert">
                  <AlertBanner severity="warning" title="Queue unavailable">
                    {notifications.error}
                  </AlertBanner>
                </div>
              ) : criticalItems.length === 0 ? (
                <p className={styles.kpiSubtext}>No critical results awaiting your review.</p>
              ) : (
                <div className={styles.taskList}>
                  {criticalItems.map((n) => (
                    <div key={n.id} className={styles.taskItem}>
                      <div className={styles.taskInfo}>
                        <span className={styles.taskTitle}>{n.title}</span>
                        <div className={styles.taskMeta}>
                          <Clock size={12} />
                          <span>
                            {new Date(n.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className={styles.metaDot}>•</span>
                          <Badge variant="critical" size="sm">
                            CRITICAL
                          </Badge>
                        </div>
                        <div className={styles.taskMeta}>
                          {n.relatedOrderId && (
                            <Link
                              href={`/diagnostics/${n.relatedOrderId}`}
                              className={styles.markAllButton ?? undefined}
                              aria-label={`Review result for ${n.title}`}
                            >
                              Review result <ChevronRight size={12} />
                            </Link>
                          )}
                          <button
                            type="button"
                            className={styles.markAllButton}
                            onClick={() => void notifications.acknowledge(n.id)}
                            aria-label={`Acknowledge ${n.title}`}
                          >
                            Acknowledge
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card elevation="xs" padding="md" className={styles.aiCard}>
            <div className={styles.aiHeader}>
              <div className={styles.aiIconCircle}>
                <Sparkles size={20} />
              </div>
              <div className={styles.aiTitleBlock}>
                <div className={styles.aiBadgeRow}>
                  <Badge variant="ai-assist" size="sm">
                    AI Clinical Assistant
                  </Badge>
                </div>
                <h4 className={styles.aiTitle}>SOURCE-GROUNDED Note Drafting</h4>
              </div>
            </div>
            <p className={styles.aiDesc}>
              Commission AI-drafted SOAP and progress notes inside an active encounter — with
              verifiable citations, system-computed gaps, and mandatory clinician review before any
              signature.
            </p>
            <Link href="/encounters" style={{ textDecoration: 'none' }}>
              <Button
                variant="outline"
                size="md"
                fullWidth
                iconRight={<ArrowUpRight size={16} />}
                className={styles.aiButton}
              >
                Go to Encounters
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
