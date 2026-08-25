'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Button } from '../../../components/ui/Button/Button';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Card } from '../../../components/ui/Card/Card';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState/ErrorState';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { Lock, FileText, Plus } from 'lucide-react';
import { encounterService } from '../../../services/encounter-service';
import { clinicalService } from '../../../services/clinical-service';
import type { EncounterDetailResponse, ClinicalRecordResponse } from 'shared';
import styles from './encounter-detail.module.css';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/rbac';
import { StaffRole } from '../../../types/auth';

const STATUS_FLOW = [
  'registered',
  'active',
  'discharge_initiated',
  'discharged',
  'closed',
] as const;

export default function EncounterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const encounterId = params?.id;
  const { user } = useAuth();
  const [encounter, setEncounter] = useState<EncounterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ADR-013: sections render ONLY when the caller holds the corresponding
  // permission. The backend already omits the data — this is UX only.
  const canReadClinical = hasPermission(user?.role as StaffRole, 'clinical_record:read');
  const canActivate = canUpdateRole(user?.role as StaffRole);

  // M9 — clinical records section (fetched from gated sub-endpoint)
  const role = user?.role as StaffRole | undefined;
  const physicianWrite = role === 'physician' && hasPermission(role, 'clinical_record:write');
  const nurseVitals = role === 'nurse' && hasPermission(role, 'clinical_record:write');
  const canWriteAny = physicianWrite || nurseVitals;
  const canWriteVitalsOnly = nurseVitals;

  const [records, setRecords] = useState<ClinicalRecordResponse[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<Error | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!encounterId || !canReadClinical) return;
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const res = await clinicalService.getClinicalRecords(encounterId);
      setRecords(res.data);
    } catch (err) {
      // A record-read failure must not break the whole encounter view
      setRecordsError(err as Error);
    } finally {
      setRecordsLoading(false);
    }
  }, [encounterId, canReadClinical]);

  useEffect(() => {
    if (encounter && canReadClinical) fetchRecords();
  }, [encounter, canReadClinical, fetchRecords]);

  function canUpdateRole(role?: StaffRole): boolean {
    return hasPermission(role, 'encounter:update') && (role === 'physician' || role === 'nurse');
  }

  const fetchEncounter = useCallback(async () => {
    if (!encounterId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await encounterService.getEncounterById(encounterId);
      setEncounter(res.data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  useEffect(() => {
    fetchEncounter();
  }, [fetchEncounter]);

  const handleStartConsultation = async () => {
    if (!encounter) return;
    setActing(true);
    setActionError(null);
    try {
      await encounterService.activateEncounter(encounter.id, encounter.version);
      await fetchEncounter();
    } catch (err) {
      const apiErr = err as Error & { code?: string };
      if (apiErr.code === 'VERSION_CONFLICT') {
        setActionError(
          'This encounter was updated by someone else. The view has been refreshed — please try again.',
        );
        await fetchEncounter();
      } else {
        setActionError(apiErr.message || 'Failed to start consultation.');
      }
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <AppShell
        breadcrumbs={['Clinical', 'Encounters', 'Detail']}
        requiredPermission="encounter:read"
      >
        <div className={styles.container}>
          <Skeleton variant="rectangular" height={280} />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell
        breadcrumbs={['Clinical', 'Encounters', 'Detail']}
        requiredPermission="encounter:read"
      >
        <div className={styles.container}>
          <ErrorState
            title="Could not load encounter"
            message={error.message}
            onRetry={fetchEncounter}
          />
        </div>
      </AppShell>
    );
  }

  if (!encounter) {
    return (
      <AppShell
        breadcrumbs={['Clinical', 'Encounters', 'Detail']}
        requiredPermission="encounter:read"
      >
        <div className={styles.container}>
          <ErrorState
            title="Encounter not found"
            message="The requested encounter does not exist."
          />
        </div>
      </AppShell>
    );
  }

  const statusIndex = STATUS_FLOW.indexOf(encounter.status as (typeof STATUS_FLOW)[number]);

  return (
    <AppShell
      breadcrumbs={['Clinical', 'Encounters', 'Detail']}
      requiredPermission="encounter:read"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Encounter · {encounter.patient.firstName} {encounter.patient.lastName}
          </h1>
          <Badge variant={encounter.status === 'registered' ? 'stable' : 'neutral'}>
            {encounter.status.replace('_', ' ')}
          </Badge>
        </div>

        {actionError && (
          <AlertBanner
            severity="warning"
            title="Action required"
            dismissible
            onDismiss={() => setActionError(null)}
          >
            {actionError}
          </AlertBanner>
        )}

        <Card>
          <div className={styles.grid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>MRN</span>
              <span className={styles.mrn}>{encounter.patient.mrn}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Patient</span>
              <span>
                {encounter.patient.firstName} {encounter.patient.lastName} · DOB{' '}
                {new Date(encounter.patient.dateOfBirth).toLocaleDateString()}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Type</span>
              <span style={{ textTransform: 'capitalize' }}>
                {encounter.encounterType.replace('_', ' ')}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Started At</span>
              <span>
                {encounter.startedAt ? new Date(encounter.startedAt).toLocaleString() : '—'}
              </span>
            </div>
            {canReadClinical && encounter.chiefComplaint && (
              <div className={`${styles.field} ${styles.fullWidth}`}>
                <span className={styles.fieldLabel}>Chief Complaint</span>
                <span>{encounter.chiefComplaint}</span>
              </div>
            )}
            {encounter.appointment && (
              <>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Appointment</span>
                  <span className={styles.mono}>{encounter.appointment.id}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Scheduled</span>
                  <span>
                    {encounter.appointment.scheduledDate} at {encounter.appointment.scheduledTime}
                    {encounter.appointment.tokenNumber
                      ? ` · Token #${encounter.appointment.tokenNumber}`
                      : ''}
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>Status Timeline</h2>
          <ol className={styles.timeline}>
            {STATUS_FLOW.map((s, i) => (
              <li
                key={s}
                className={`${styles.timelineItem} ${
                  i < statusIndex
                    ? styles.timelineDone
                    : i === statusIndex
                      ? styles.timelineCurrent
                      : ''
                }`}
              >
                {s.replace(/_/g, ' ')}
              </li>
            ))}
          </ol>
        </Card>

        <div className={styles.actionsBar}>
          {canActivate && encounter.status === 'registered' && (
            <Button variant="primary" size="md" disabled={acting} onClick={handleStartConsultation}>
              {acting ? 'Starting…' : 'Start Consultation'}
            </Button>
          )}
        </div>

        {canReadClinical && encounter.status === 'active' && (
          <Card>
            <h2 className={styles.sectionTitle}>Clinical Records</h2>
            {recordsLoading ? (
              <Skeleton variant="rectangular" height={120} />
            ) : recordsError ? (
              <ErrorState
                title="Could not load clinical records"
                message={recordsError.message}
                onRetry={fetchRecords}
              />
            ) : records.length === 0 ? (
              <EmptyState
                icon={<FileText size={32} />}
                title="No clinical records yet"
                description="Notes and vitals recorded during this consultation will appear here."
              />
            ) : (
              <ul className={styles.recordList}>
                {records.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={styles.recordRow}
                      onClick={() =>
                        router.push(`/encounters/${encounter.id}/clinical-records/${r.id}`)
                      }
                    >
                      <span style={{ textTransform: 'capitalize' }}>
                        {canWriteVitalsOnly || canWriteAny
                          ? r.recordType.replace(/_/g, ' ')
                          : r.recordType.replace(/_/g, ' ')}
                        {r.status === 'signed' && <Lock size={12} style={{ marginLeft: 6 }} />}
                      </span>
                      <Badge variant={r.status === 'draft' ? 'stable' : 'neutral'}>
                        {r.status}
                      </Badge>
                      <span className={styles.mrn}>
                        v{r.version} · updated {new Date(r.updatedAt).toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {canWriteAny && (
              <div
                className={styles.actionsBar}
                style={{ justifyContent: 'flex-start', marginTop: 16 }}
              >
                {physicianWrite && (
                  <>
                    <Button
                      variant="secondary"
                      size="md"
                      iconLeft={<Plus size={14} />}
                      onClick={() =>
                        router.push(`/encounters/${encounter.id}/clinical-records/new?type=soap`)
                      }
                    >
                      New SOAP Note
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      iconLeft={<Plus size={14} />}
                      onClick={() =>
                        router.push(
                          `/encounters/${encounter.id}/clinical-records/new?type=progress_note`,
                        )
                      }
                    >
                      New Progress Note
                    </Button>
                  </>
                )}
                {nurseVitals && (
                  <Button
                    variant="secondary"
                    size="md"
                    iconLeft={<Plus size={14} />}
                    onClick={() =>
                      router.push(
                        `/encounters/${encounter.id}/clinical-records/new?type=vital_signs`,
                      )
                    }
                  >
                    Record Vitals
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ADR-013: clinical records and diagnostic orders are NEVER part of the
            detail payload. M9 fetches records via the permission-controlled
            clinical-records endpoints above; diagnostic orders remain M10. */}
      </div>
    </AppShell>
  );
}
