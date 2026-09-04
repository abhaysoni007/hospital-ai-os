'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card/Card';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState/ErrorState';
import {
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
  NumericTD,
  RowLink,
} from '../../../components/ui/Table/Table';
import {
  AppointmentStatusBadge,
  EncounterStatusBadge,
} from '../../../components/ui/SemanticBadges/SemanticBadges';
import { BreakGlassModal } from '../../../components/break-glass/BreakGlassModal';
import { BreakGlassBanner } from '../../../components/break-glass/BreakGlassBanner';
import { patientService } from '../../../services/patient-service';
import { appointmentService } from '../../../services/appointment-service';
import { encounterService } from '../../../services/encounter-service';
import type { AppointmentListItem, EncounterListItem, PatientResponse } from 'shared';
import styles from './profile.module.css';
import { CalendarPlus, Stethoscope } from 'lucide-react';
import { Button } from '../../../components/ui/Button/Button';
import { PatientHeader } from '../../../components/clinical/LovableClinical';
import { computeAgeYears } from '../../../utils/dashboard';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/rbac';
import { parseApiError, ParsedError } from '../../../utils/error-parser';

type Block<T> = { state: 'loading' | 'ready' | 'error'; data: T | null };

/**
 * M13 — Patient chart overview. Identity header plus the patient's real
 * appointments and encounters (both endpoints accept patientId). Progressive
 * disclosure per section; PHI stays behind the same server permissions.
 */
export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();

  const canReadAppointments = hasPermission(user?.role, 'appointment:read');
  const canReadEncounters = hasPermission(user?.role, 'encounter:read');
  const canCreateAppointments = hasPermission(user?.role, 'appointment:create');

  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [patientState, setPatientState] = useState<Block<null>['state']>('loading');
  const [patientError, setPatientError] = useState<ParsedError | null>(null);
  const [patientRetryTick, setPatientRetryTick] = useState(0);
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);

  const [appointments, setAppointments] = useState<Block<AppointmentListItem[]>>({
    state: canReadAppointments ? 'loading' : 'ready',
    data: null,
  });
  const [encounters, setEncounters] = useState<Block<EncounterListItem[]>>({
    state: canReadEncounters ? 'loading' : 'ready',
    data: null,
  });

  useEffect(() => {
    let cancelled = false;
    setPatientState('loading');
    setPatientError(null);
    patientService
      .getPatientById(id)
      .then((res) => {
        if (!cancelled) {
          setPatient(res.data);
          setPatientState('ready');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPatientError(parseApiError(err));
          setPatientState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, patientRetryTick]);

  const loadRelated = useCallback(() => {
    if (canReadAppointments) {
      appointmentService
        .getAppointments({ page: 1, patientId: id, pageSize: 10 })
        .then((res) => setAppointments({ state: 'ready', data: res.data }))
        .catch((err) => {
          if (err.statusCode === 403 && hasPermission(user?.role, 'break_glass:activate')) {
            setShowBreakGlassModal(true);
          }
          setAppointments({ state: 'error', data: null });
        });
    }
    if (canReadEncounters) {
      encounterService
        .getEncounters({ page: 1, patientId: id, pageSize: 10 })
        .then((res) => setEncounters({ state: 'ready', data: res.data }))
        .catch((err) => {
          if (err.statusCode === 403 && hasPermission(user?.role, 'break_glass:activate')) {
            setShowBreakGlassModal(true);
          }
          setEncounters({ state: 'error', data: null });
        });
    }
  }, [id, canReadAppointments, canReadEncounters, user]);

  useEffect(() => {
    if (patientState === 'ready') {
      loadRelated();
    }
  }, [patientState, loadRelated]);

  const bookHref = `/appointments/new?patientId=${encodeURIComponent(id)}`;
  const scheduleAction = canCreateAppointments ? (
    <Button
      variant="primary"
      size="md"
      iconLeft={<CalendarPlus size={16} />}
      onClick={() => router.push(bookHref)}
    >
      Schedule appointment
    </Button>
  ) : undefined;

  const breadcrumbs = patient?.mrn
    ? ['Operations', 'Patients', patient.mrn]
    : ['Operations', 'Patients'];

  return (
    <AppShell breadcrumbs={breadcrumbs} requiredPermission="patient:read">
      <div className={styles.container}>
        {patientState === 'loading' ? (
          <>
            <div className={styles.profileHeader}>
              <Skeleton variant="circular" width={64} height={64} />
              <div className={styles.profileHeaderText}>
                <Skeleton variant="text" width={240} height={28} />
                <Skeleton variant="text" width={160} height={16} />
              </div>
            </div>
            <div className={styles.sectionsGrid}>
              <Skeleton variant="card" height={220} />
              <Skeleton variant="card" height={220} />
              <Skeleton variant="card" height={220} />
              <Skeleton variant="card" height={220} />
            </div>
          </>
        ) : patientState === 'error' || !patient ? (
          <ErrorState
            title={patientError?.title || 'This record is no longer available'}
            message={
              patientError?.message ||
              'The patient may not exist, or your role does not permit access. Return to the directory and search again.'
            }
            correlationId={patientError?.requestId}
            onRetry={() => setPatientRetryTick((tick) => tick + 1)}
          />
        ) : (
          <>
            <BreakGlassBanner patientId={id} />
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <PatientHeader
                patient={{
                  name: `${patient.firstName} ${patient.lastName}`,
                  mrn: patient.mrn,
                  age: computeAgeYears(patient.dateOfBirth) ?? undefined,
                  gender: patient.gender,
                }}
                actions={scheduleAction}
              />
            </div>

        <div className={styles.grid}>
          <Card elevation="xs">
            <CardHeader title="Demographics & contact" />
            <CardContent>
              <dl className={styles.infoList}>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Date of birth</dt>
                  <dd className={styles.infoValue}>
                    {new Date(patient.dateOfBirth).toLocaleDateString()}
                  </dd>
                </div>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Gender</dt>
                  <dd className={`${styles.infoValue} ${styles.capitalize}`}>{patient.gender}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Primary phone</dt>
                  <dd className={styles.infoValue}>{patient.phonePrimary}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Emergency contact</dt>
                  <dd className={styles.infoValue}>
                    {patient.emergencyContactName || 'Not provided'}
                    {patient.phoneEmergency ? ` · ${patient.phoneEmergency}` : ''}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card elevation="xs">
            <CardHeader title="Address" />
            <CardContent>
              <dl className={styles.infoList}>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Address</dt>
                  <dd className={styles.infoValue}>
                    {patient.addressLine1 || 'Not on file'}
                    {patient.addressCity ? `, ${patient.addressCity}` : ''}
                  </dd>
                </div>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>State</dt>
                  <dd className={styles.infoValue}>{patient.addressState || '—'}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>Postal code</dt>
                  <dd className={styles.infoValue}>{patient.addressPostalCode || '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {canReadEncounters && (
            <Card elevation="xs" padding="none" className={styles.fullWidth}>
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionTitleGroup}>
                  <h3 className={styles.sectionTitle}>
                    <Stethoscope size={16} aria-hidden="true" /> Encounters
                  </h3>
                  <p className={styles.sectionSub}>Most recent first</p>
                </div>
              </div>
              {encounters.state === 'loading' ? (
                <CardContent>
                  <Skeleton variant="rectangular" height={120} />
                </CardContent>
              ) : encounters.state === 'error' ? (
                <CardContent>
                  <ErrorState
                    title="Could not load encounters"
                    message="The encounter service did not respond."
                    onRetry={loadRelated}
                  />
                </CardContent>
              ) : (encounters.data?.length ?? 0) === 0 ? (
                <CardContent>
                  <EmptyState
                    title="No encounters yet"
                    description="Encounters begin when the patient is checked in for an appointment."
                  />
                </CardContent>
              ) : (
                <Table ariaLabel="Patient encounters">
                  <THead>
                    <tr>
                      <TH>Type</TH>
                      <TH>Status</TH>
                      <TH aria-label="Open" />
                    </tr>
                  </THead>
                  <TBody>
                    {(encounters.data ?? []).map((e) => (
                      <TR key={e.id}>
                        <TD>{e.encounterType.replace('_', ' ')}</TD>
                        <TD>
                          <EncounterStatusBadge status={e.status} size="sm" />
                        </TD>
                        <TD align="right">
                          <RowLink href={`/encounters/${e.id}`} aria-label="Open encounter">
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

          {canReadAppointments && (
            <Card elevation="xs" padding="none" className={styles.fullWidth}>
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionTitleGroup}>
                  <h3 className={styles.sectionTitle}>
                    <CalendarPlus size={16} aria-hidden="true" /> Appointments
                  </h3>
                  <p className={styles.sectionSub}>Latest bookings</p>
                </div>
              </div>
              {appointments.state === 'loading' ? (
                <CardContent>
                  <Skeleton variant="rectangular" height={120} />
                </CardContent>
              ) : appointments.state === 'error' ? (
                <CardContent>
                  <ErrorState
                    title="Could not load appointments"
                    message="The scheduling service did not respond."
                    onRetry={loadRelated}
                  />
                </CardContent>
              ) : (appointments.data?.length ?? 0) === 0 ? (
                <CardContent>
                  <EmptyState
                    icon={<CalendarPlus size={24} />}
                    title="No appointments booked"
                    description={
                      canCreateAppointments
                        ? 'Book this patient’s next visit from the scheduling workspace.'
                        : 'Nothing scheduled for this patient.'
                    }
                    action={
                      canCreateAppointments ? (
                        <Button
                          variant="outline"
                          onClick={() => router.push(bookHref)}
                          iconLeft={<CalendarPlus size={16} />}
                        >
                          Schedule appointment
                        </Button>
                      ) : undefined
                    }
                  />
                </CardContent>
              ) : (
                <Table ariaLabel="Patient appointments">
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH>Time</TH>
                      <TH>Token</TH>
                      <TH>Status</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {(appointments.data ?? []).map((a) => (
                      <TR key={a.id}>
                        <TD>{a.scheduledDate}</TD>
                        <TD>{a.scheduledTime.slice(0, 5)}</TD>
                        <NumericTD>
                          {a.tokenNumber !== null
                            ? `#${String(a.tokenNumber).padStart(2, '0')}`
                            : '—'}
                        </NumericTD>
                        <TD>
                          <AppointmentStatusBadge status={a.status} size="sm" />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          )}
        </div>
          </>
        )}
      </div>

      {showBreakGlassModal && (
        <BreakGlassModal
          patientId={id}
          onSuccess={() => {
            setShowBreakGlassModal(false);
            loadRelated(); // Retry loading
          }}
          onCancel={() => setShowBreakGlassModal(false)}
        />
      )}
    </AppShell>
  );
}
