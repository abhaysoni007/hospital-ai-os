'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Calendar, UserPlus, CheckCircle2, RefreshCw, Clock, ArrowUpRight, Check } from 'lucide-react';
import type { AppointmentListItem } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_DISPLAY_NAMES } from '../../utils/rbac';
import { appointmentService } from '../../services/appointment-service';
import { todayIsoDate } from '../../utils/dashboard';
import { Card, CardContent } from '../ui/Card/Card';
import { Badge } from '../ui/Badge/Badge';
import { AlertBanner } from '../ui/Alert/AlertBanner';
import { MetricCard } from '../ui/MetricCard/MetricCard';
import { Table, THead, TH, TBody, TR, TD, RowLink, TableSkeleton } from '../ui/Table/Table';
import { PatientIdentity } from '../ui/Identity/Identity';
import styles from './DashboardShell.module.css';

export function ReceptionistDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const mounted = useRef(true);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = todayIsoDate();
      const res = await appointmentService.getAppointments({ page: 1, date: today, pageSize: 50 });
      if (!mounted.current) return;
      setAppointments(res.data);
      setNow(new Date());
    } catch {
      if (!mounted.current) return;
      setError('Could not load appointments for today.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadAppointments();
    return () => {
      mounted.current = false;
    };
  }, [loadAppointments]);

  const handleCheckIn = async (appointmentId: string) => {
    setCheckingInId(appointmentId);
    setActionSuccess(null);
    try {
      await appointmentService.checkInAppointment(appointmentId);
      setActionSuccess('Patient successfully checked in! Encounter initiated.');
      await loadAppointments();
    } catch {
      setError('Failed to check in patient. Please try again.');
    } finally {
      setCheckingInId(null);
    }
  };

  const bookedCount = appointments.filter((a) => a.status === 'booked').length;
  const checkedInCount = appointments.filter((a) => a.status === 'checked_in').length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.greetingBanner}>
        <div>
          <h1 className={styles.greetingTitle}>
            <span className={styles.greetingIcon} aria-hidden="true">🏥</span>
            Patient Reception & Registration — {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}` : 'Front Desk'}
          </h1>
          <p className={styles.greetingSubtitle}>
            {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            {ROLE_DISPLAY_NAMES.receptionist} Workspace
          </p>
        </div>
        <div className={styles.greetingMeta}>
          <Link href="/patients/new" className={styles.refreshButton} style={{ background: 'var(--color-primary-600)', color: '#fff', border: 'none' }}>
            <UserPlus size={14} aria-hidden="true" />
            Register Patient
          </Link>
          <Link href="/appointments/new" className={styles.refreshButton}>
            <Calendar size={14} aria-hidden="true" />
            Book Slot
          </Link>
          <button type="button" className={styles.refreshButton} onClick={() => void loadAppointments()}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {actionSuccess && (
        <AlertBanner severity="success" title="Check-In Completed" onDismiss={() => setActionSuccess(null)}>
          {actionSuccess}
        </AlertBanner>
      )}

      {/* Metrics */}
      <section aria-label="Reception metrics" className={styles.metricRow}>
        <MetricCard
          label="Today's Bookings"
          icon={<Calendar size={16} aria-hidden="true" />}
          tone="info"
          href="/appointments"
          value={loading ? '—' : appointments.length}
          hint="Total scheduled visits for today"
        />
        <MetricCard
          label="Awaiting Check-In"
          icon={<Clock size={16} aria-hidden="true" />}
          tone="warning"
          href="/appointments"
          value={loading ? '—' : bookedCount}
          hint="Patients yet to arrive"
        />
        <MetricCard
          label="Checked In"
          icon={<CheckCircle2 size={16} aria-hidden="true" />}
          tone="primary"
          href="/appointments"
          value={loading ? '—' : checkedInCount}
          hint="Ready for clinical consultation"
        />
        <MetricCard
          label="Completed Consultations"
          icon={<CheckCircle2 size={16} aria-hidden="true" />}
          tone="success"
          href="/appointments"
          value={loading ? '—' : completedCount}
          hint="Completed today"
        />
      </section>

      {/* Today's Queue */}
      <Card elevation="xs" padding="none" className={styles.tableCard}>
        <div className={styles.sectionCardHeader}>
          <div className={styles.sectionHeaderTitle}>
            <h3>Today&apos;s Patient Appointments Queue</h3>
            <p>Direct check-in initiates clinical encounter for the attending doctor</p>
          </div>
          <Link href="/appointments" className={styles.viewAllLink}>
            View full calendar <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <CardContent>
            <AlertBanner severity="warning" title="Could not load appointments">
              {error}
            </AlertBanner>
          </CardContent>
        ) : appointments.length === 0 ? (
          <CardContent>
            <p className={styles.quietEmpty}>No appointments scheduled for today.</p>
          </CardContent>
        ) : (
          <Table ariaLabel="Today's Appointments">
            <THead>
              <tr>
                <TH>Token</TH>
                <TH>Patient</TH>
                <TH>Time</TH>
                <TH>Attending Doctor</TH>
                <TH>Status</TH>
                <TH align="right">Action</TH>
              </tr>
            </THead>
            <TBody>
              {appointments.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>#{a.tokenNumber ?? '—'}</span>
                  </TD>
                  <TD>
                    <PatientIdentity
                      compact
                      firstName={a.patient?.firstName ?? 'Unknown'}
                      lastName={a.patient?.lastName ?? 'Patient'}
                      mrn={a.patient?.mrn ?? '—'}
                    />
                  </TD>
                  <TD>
                    <span className={styles.timeCell}>
                      <Clock size={12} aria-hidden="true" />
                      {a.scheduledTime.slice(0, 5)}
                    </span>
                  </TD>
                  <TD>
                    {a.doctor ? `Dr. ${a.doctor.firstName} ${a.doctor.lastName}` : 'Unassigned'}
                  </TD>
                  <TD>
                    <Badge
                      variant={
                        a.status === 'checked_in'
                          ? 'primary'
                          : a.status === 'completed'
                            ? 'stable'
                            : 'neutral'
                      }
                      size="sm"
                    >
                      {a.status === 'checked_in' ? 'Checked In' : a.status === 'booked' ? 'Waiting' : a.status}
                    </Badge>
                  </TD>
                  <TD align="right">
                    {a.status === 'booked' ? (
                      <button
                        type="button"
                        className={styles.refreshButton}
                        disabled={checkingInId === a.id}
                        onClick={() => void handleCheckIn(a.id)}
                        style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
                      >
                        <Check size={12} aria-hidden="true" />
                        {checkingInId === a.id ? 'Checking in…' : 'Check In'}
                      </button>
                    ) : (
                      <RowLink href={`/appointments`} aria-label="View appointment details">
                        View
                      </RowLink>
                    )}
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
