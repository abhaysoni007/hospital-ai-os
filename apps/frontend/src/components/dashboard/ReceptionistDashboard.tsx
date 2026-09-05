'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Calendar, UserPlus, Check, Clock } from 'lucide-react';
import type { AppointmentListItem } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { appointmentService } from '../../services/appointment-service';
import { todayIsoDate } from '../../utils/dashboard';
import { Badge } from '../ui/Badge/Badge';
import { Button } from '../ui/Button/Button';
import { Table, THead, TH, TBody, TR, TD, TableSkeleton } from '../ui/Table/Table';
import { PatientIdentity } from '../ui/Identity/Identity';
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

export function ReceptionistDashboard() {
  const { user } = useAuth();
  const { range, setRange } = useDateRange('today');
  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const mounted = useRef(true);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = todayIsoDate();
      const res = await appointmentService.getAppointments({ page: 1, date: today, pageSize: 50 });
      if (!mounted.current) return;
      setAppointments(Array.isArray(res?.data) ? res.data : []);
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
  const recName = user?.firstName ? `${user.firstName} ${user.lastName ?? ''}` : 'Front Desk';

  return (
    <div className="space-y-4">
      <RoleIntro
        title="Front desk workspace"
        subtitle={`${recName} · registration, check-in and schedule flow for today.`}
        aside={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {actionSuccess && (
        <div style={{ padding: '8px 12px', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 500 }}>
          {actionSuccess}
        </div>
      )}

      {error && (
        <div role="alert" className={styles.quietEmpty} style={{ color: 'var(--color-danger-main)' }}>
          {error}
        </div>
      )}

      {/* 4-Card Metric Grid */}
      <MetricGrid columns={4}>
        <RoleMetricCard
          label="Today's appointments"
          value={loading ? '—' : appointments.length}
          hint="Total scheduled bookings"
          href="/appointments"
        />
        <RoleMetricCard
          label="Booked / waiting"
          value={loading ? '—' : bookedCount}
          hint="Awaiting patient arrival"
          href="/appointments"
          tone={bookedCount > 0 ? 'warning' : 'default'}
        />
        <RoleMetricCard
          label="Checked in"
          value={loading ? '—' : checkedInCount}
          hint="Arrived and ready for consult"
          tone="default"
          href="/appointments"
        />
        <RoleMetricCard
          label="Completed"
          value={loading ? '—' : completedCount}
          hint="Consultations finished"
          tone="success"
          href="/appointments"
        />
      </MetricGrid>

      {/* Analytical Dashboard Grid */}
      <DashboardGrid columns={2}>
        <ChartCard
          title="Today's appointment status"
          decision="How much of today's scheduled list has actually arrived?"
          action={{ label: 'Schedule', href: '/appointments' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Breakdown of today's {appointments.length} appointments.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', fontSize: '0.75rem' }}>
                {bookedCount} Booked
              </span>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-info-bg)', color: 'var(--color-info-text)', fontSize: '0.75rem' }}>
                {checkedInCount} Checked In
              </span>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', fontSize: '0.75rem' }}>
                {completedCount} Completed
              </span>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Reception quick actions"
          decision="Register a walk-in patient or book an appointment slot"
        >
          <div style={{ padding: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Link
              href="/patients/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-primary-600)',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              <UserPlus size={14} /> Register New Patient
            </Link>
            <Link
              href="/appointments/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              <Calendar size={14} /> Book Appointment Slot
            </Link>
          </div>
        </ChartCard>
      </DashboardGrid>

      {/* Appointment Queue */}
      <section className="clinical-panel p-4" aria-label="Today's patient arrival queue">
        <header style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Today's Patient Arrival & Check-In Queue
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Check-in creates the clinical encounter and initiates doctor assignment.
            </p>
          </div>
          <Link href="/appointments" style={{ fontSize: '0.75rem', color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 500 }}>
            Full schedule →
          </Link>
        </header>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : appointments.length === 0 ? (
          <div className={styles.quietEmpty}>No appointments scheduled for today.</div>
        ) : (
          <Table ariaLabel="Today's Patient Arrival & Check-In Queue">
            <THead>
              <TR>
                <TH>Patient</TH>
                <TH>Time</TH>
                <TH>Department</TH>
                <TH>Status</TH>
                <TH align="right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {appointments.slice(0, 6).map((apt) => (
                <TR key={apt.id}>
                  <TD>
                    <PatientIdentity
                      firstName={apt.patient?.firstName ?? 'Walk-in'}
                      lastName={apt.patient?.lastName ?? ''}
                      mrn={apt.patient?.mrn ?? 'MRN-—'}
                      compact
                    />
                  </TD>
                  <TD>
                    <span className={styles.timeCell}>
                      <Clock size={12} aria-hidden="true" />
                      {apt.scheduledTime}
                    </span>
                  </TD>
                  <TD>{apt.departmentId}</TD>
                  <TD>
                    <Badge
                      variant={
                        apt.status === 'checked_in'
                          ? 'info'
                          : apt.status === 'completed'
                            ? 'stable'
                            : 'pending'
                      }
                      size="sm"
                    >
                      {apt.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TD>
                  <TD align="right">
                    {apt.status === 'booked' ? (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={checkingInId === apt.id}
                        onClick={() => void handleCheckIn(apt.id)}
                        iconLeft={<Check size={12} />}
                      >
                        Check In
                      </Button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Arrived</span>
                    )}
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
