'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Select } from '../../components/ui/Input/Select';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { AlertBanner } from '../../components/ui/Alert/AlertBanner';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
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
} from '../../components/ui/Table/Table';
import { PatientIdentity } from '../../components/ui/Identity/Identity';
import { AppointmentStatusBadge } from '../../components/ui/SemanticBadges/SemanticBadges';
import { appointmentService } from '../../services/appointment-service';
import type { AppointmentListItem, AppointmentStatusValue } from 'shared';
import styles from './appointments.module.css';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(iso: string): string {
  const today = todayIso();
  if (iso === today) return 'Today';
  if (iso === shiftIsoDate(today, 1)) return 'Tomorrow';
  if (iso === shiftIsoDate(today, -1)) return 'Yesterday';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * M13 — Scheduling workspace. Day navigation, status filtering, and the
 * operational loop: check-in creates an encounter (server-owned) and offers
 * a direct handoff. Cancellation requires explicit confirmation.
 */
export default function AppointmentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<readonly AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkedInEncounterId, setCheckedInEncounterId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentListItem | null>(null);

  const canCreate = hasPermission(user?.role, 'appointment:create');
  const canUpdate = hasPermission(user?.role, 'appointment:update');
  const canCancel = hasPermission(user?.role, 'appointment:cancel');

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await appointmentService.getAppointments({
        page: 1,
        pageSize: 100,
        date: date || undefined,
        status: (status || undefined) as AppointmentStatusValue | undefined,
      });
      setAppointments(response.data);
    } catch {
      setError('The scheduling service did not respond. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [date, status]);

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  const handleCheckIn = async (id: string) => {
    setActingId(id);
    setActionError(null);
    setCheckedInEncounterId(null);
    try {
      const res = await appointmentService.checkInAppointment(id);
      await fetchAppointments();
      // Real server response: the encounter created by check-in.
      setCheckedInEncounterId(res.data.encounter.id);
    } catch (err) {
      const apiError = err as Error & { code?: string; statusCode?: number };
      setActionError(
        apiError.code === 'INVALID_TRANSITION'
          ? 'This action is no longer available — the appointment state changed. Refresh and try again.'
          : apiError.statusCode === 403
            ? 'You do not have permission to check in patients.'
            : 'Check-in failed. The appointment may already be checked in.',
      );
    } finally {
      setActingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setActingId(cancelTarget.id);
    setActionError(null);
    try {
      await appointmentService.cancelAppointment(cancelTarget.id);
      setCancelTarget(null);
      await fetchAppointments();
    } catch (err) {
      const apiError = err as Error & { code?: string; statusCode?: number };
      setCancelTarget(null);
      setActionError(
        apiError.code === 'INVALID_TRANSITION'
          ? 'This appointment can no longer be cancelled — its state changed.'
          : apiError.statusCode === 403
            ? 'You do not have permission to cancel this appointment.'
            : 'Cancellation failed. Try again or contact the patient directly.',
      );
    } finally {
      setActingId(null);
    }
  };

  return (
    <AppShell breadcrumbs={['Operations', 'Appointments']} requiredPermission="appointment:read">
      <div className={styles.container}>
        <PageHeader
          title="Appointments"
          description="Daily clinic schedule with token allocation. Tokens are assigned by the system at booking."
          actions={
            canCreate ? (
              <Button
                variant="primary"
                size="md"
                iconLeft={<CalendarPlus size={16} />}
                onClick={() => router.push('/appointments/new')}
              >
                Book appointment
              </Button>
            ) : undefined
          }
        />

        {/* Day navigation + filters */}
        <div className={styles.filterBar}>
          <div className={styles.dayNav} role="group" aria-label="Navigate schedule by day">
            <button
              type="button"
              className={styles.dayNavButton}
              onClick={() => setDate((d) => shiftIsoDate(d, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className={styles.dayLabel}>{formatDayLabel(date)}</span>
            <button
              type="button"
              className={styles.dayNavButton}
              onClick={() => setDate((d) => shiftIsoDate(d, 1))}
              aria-label="Next day"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          <Input
            id="date"
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hideLabel
            aria-label="Schedule date"
          />

          <Select
            id="status"
            label="Status"
            placeholder="All statuses"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'booked', label: 'Booked' },
              { value: 'checked_in', label: 'Checked in' },
              { value: 'in_consult', label: 'In consult' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            className={styles.statusSelect}
          />
        </div>

        {actionError && (
          <AlertBanner
            severity="warning"
            title="Action failed"
            dismissible
            onDismiss={() => setActionError(null)}
          >
            {actionError}
          </AlertBanner>
        )}

        {checkedInEncounterId && (
          <AlertBanner severity="success" title="Patient checked in">
            An encounter was opened for this visit.{' '}
            <Link href={`/encounters/${checkedInEncounterId}`} className={styles.inlineLink}>
              Open the encounter
            </Link>
          </AlertBanner>
        )}

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState
            title="Could not load appointments"
            message={error}
            onRetry={() => void fetchAppointments()}
          />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={32} />}
            title={`Nothing scheduled for ${formatDayLabel(date).toLowerCase()}`}
            description={
              status
                ? 'No appointments match the selected status filter for this day.'
                : canCreate
                  ? 'Book a patient to fill the schedule.'
                  : 'The schedule is clear for this day.'
            }
            action={
              canCreate && !status ? (
                <Button
                  onClick={() => router.push('/appointments/new')}
                  iconLeft={<CalendarPlus size={16} />}
                >
                  Book appointment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table ariaLabel={`Appointments for ${formatDayLabel(date)}, ${date}`}>
            <THead>
              <tr>
                <TH width="88px">Time</TH>
                <TH width="80px">Token</TH>
                <TH>Patient</TH>
                <TH>Physician</TH>
                <TH>Status</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {appointments.map((appt) => (
                <TR key={appt.id}>
                  <TD>
                    <span className={styles.timeCell}>{appt.scheduledTime.slice(0, 5)}</span>
                  </TD>
                  <NumericTD
                    aria-label={
                      appt.tokenNumber !== undefined ? `Token ${appt.tokenNumber}` : 'No token'
                    }
                  >
                    {appt.tokenNumber != null
                      ? `#${String(appt.tokenNumber).padStart(2, '0')}`
                      : '—'}
                  </NumericTD>
                  <TD>
                    <RowLink href={`/patients/${appt.patientId}`}>
                      <PatientIdentity
                        compact
                        firstName={appt.patient.firstName}
                        lastName={appt.patient.lastName}
                        mrn={appt.patient.mrn}
                      />
                    </RowLink>
                  </TD>
                  <TD>
                    Dr. {appt.doctor.firstName} {appt.doctor.lastName}
                  </TD>
                  <TD>
                    <AppointmentStatusBadge status={appt.status} size="sm" />
                  </TD>
                  <TD align="right">
                    <div className={styles.rowActions}>
                      {canUpdate && appt.status === 'booked' && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={actingId === appt.id}
                          onClick={() => void handleCheckIn(appt.id)}
                        >
                          Check in
                        </Button>
                      )}
                      {canCancel && appt.status === 'booked' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actingId === appt.id}
                          onClick={() => setCancelTarget(appt)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        isOpen={cancelTarget !== null}
        title="Cancel this appointment?"
        variant="danger"
        confirmLabel="Cancel appointment"
        isLoading={actingId !== null}
        onConfirm={() => void handleConfirmCancel()}
        onCancel={() => setCancelTarget(null)}
      >
        {cancelTarget && (
          <>
            {cancelTarget.patient.firstName} {cancelTarget.patient.lastName} ·{' '}
            {formatDayLabel(cancelTarget.scheduledDate)} at {cancelTarget.scheduledTime.slice(0, 5)}
            .
            <br />
            <br />
            The slot is released immediately and cannot be recovered.
          </>
        )}
      </ConfirmDialog>
    </AppShell>
  );
}
