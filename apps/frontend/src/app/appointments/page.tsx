'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, CalendarDays } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Badge } from '../../components/ui/Badge/Badge';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import { appointmentService } from '../../services/appointment-service';
import type { AppointmentListItem } from 'shared';
import styles from './appointments.module.css';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';
import { StaffRole } from '../../types/auth';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_BADGE: Record<string, 'stable' | 'neutral' | 'critical'> = {
  booked: 'stable',
  checked_in: 'neutral',
  in_consult: 'neutral',
  completed: 'neutral',
  cancelled: 'critical',
};

export default function AppointmentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const canCreate = hasPermission(user?.role as StaffRole, 'appointment:create');
  const canUpdate = hasPermission(user?.role as StaffRole, 'appointment:update');
  const canCancel = hasPermission(user?.role as StaffRole, 'appointment:cancel');

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await appointmentService.getAppointments({
        page: 1,
        pageSize: 100,
        date: date || undefined,
        status: (status || undefined) as never,
      });
      setAppointments(response.data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [date, status]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCheckIn = async (id: string) => {
    setActingId(id);
    setError(null);
    try {
      await appointmentService.checkInAppointment(id);
      await fetchAppointments();
    } catch (err) {
      setError(err as Error);
    } finally {
      setActingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setActingId(id);
    setError(null);
    try {
      await appointmentService.cancelAppointment(id);
      await fetchAppointments();
    } catch (err) {
      setError(err as Error);
    } finally {
      setActingId(null);
    }
  };

  return (
    <AppShell breadcrumbs={['Operations', 'Appointments']} requiredPermission="appointment:read">
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Appointment Schedule</h1>
          {canCreate && (
            <Button
              variant="primary"
              size="md"
              iconLeft={<Plus size={16} />}
              onClick={() => router.push('/appointments/new')}
            >
              Book Appointment
            </Button>
          )}
        </div>

        <div className={styles.filters}>
          <div className={styles.filterField}>
            <Input
              id="date"
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className={styles.filterField}>
            <label
              htmlFor="status"
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                color: 'var(--color-slate-700)',
              }}
            >
              Status
            </label>
            <select
              id="status"
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="booked">Booked</option>
              <option value="checked_in">Checked In</option>
              <option value="in_consult">In Consult</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {error && (
          <ErrorState
            title="Could not load appointments"
            message={error.message}
            onRetry={fetchAppointments}
          />
        )}

        <div className={styles.tableContainer}>
          {loading ? (
            <div style={{ padding: '24px' }}>
              <Skeleton variant="rectangular" height={200} />
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={32} />}
              title="No appointments found"
              description={
                date
                  ? `No appointments scheduled for ${date}.`
                  : 'Book an appointment to get started.'
              }
              action={
                canCreate ? (
                  <Button onClick={() => router.push('/appointments/new')}>Book Appointment</Button>
                ) : undefined
              }
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id}>
                    <td>{appt.scheduledTime}</td>
                    <td>
                      <span className={styles.token}>{appt.tokenNumber ?? '—'}</span>
                    </td>
                    <td>
                      <button
                        className={styles.patientLink}
                        onClick={() => router.push(`/patients/${appt.patientId}`)}
                      >
                        <span className={styles.patientName}>
                          {appt.patient.firstName} {appt.patient.lastName}
                        </span>
                        <span className={styles.mrn}>{appt.patient.mrn}</span>
                      </button>
                    </td>
                    <td>
                      Dr. {appt.doctor.firstName} {appt.doctor.lastName}
                    </td>
                    <td>
                      <Badge variant={STATUS_BADGE[appt.status] ?? 'neutral'}>
                        {appt.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {canUpdate && appt.status === 'booked' && (
                          <Button
                            variant="primary"
                            size="md"
                            disabled={actingId === appt.id}
                            onClick={() => handleCheckIn(appt.id)}
                          >
                            {actingId === appt.id ? 'Checking in…' : 'Check In'}
                          </Button>
                        )}
                        {canCancel && appt.status === 'booked' && (
                          <Button
                            variant="outline"
                            size="md"
                            disabled={actingId === appt.id}
                            onClick={() => handleCancel(appt.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
