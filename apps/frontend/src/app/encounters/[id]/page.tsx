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
import { Lock, FileText, Plus, FlaskConical, TestTubes } from 'lucide-react';
import { ORDER_STATUS_LABELS } from '../../../utils/diagnostics';
import { encounterService } from '../../../services/encounter-service';
import { clinicalService } from '../../../services/clinical-service';
import { diagnosticsService } from '../../../services/diagnostics-service';
import { AiNoteDraftPanel } from '@/components/ai/AiNoteDraftPanel';
import type {
  EncounterDetailResponse,
  ClinicalRecordResponse,
  DiagnosticOrderResponse,
} from 'shared';
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

  // M10 — diagnostics section (gated, decomposed per ADR-013/016)
  const canReadDx = hasPermission(role, 'diagnostic_order:read');
  const canOrderDx = role === 'physician' && hasPermission(role, 'diagnostic_order:create');
  const canCollectDx = role === 'lab_technician' && hasPermission(role, 'diagnostic_order:update');
  const [orders, setOrders] = useState<DiagnosticOrderResponse[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<Error | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [collectConflict, setCollectConflict] = useState(false);

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

  const fetchOrders = useCallback(async () => {
    if (!encounterId || !canReadDx) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await diagnosticsService.getEncounterOrders(encounterId);
      setOrders(res.data);
    } catch (err) {
      setOrdersError(err as Error);
    } finally {
      setOrdersLoading(false);
    }
  }, [encounterId, canReadDx]);

  useEffect(() => {
    if (encounter && canReadClinical) fetchRecords();
    if (encounter && canReadDx) fetchOrders();
  }, [encounter, canReadClinical, canReadDx, fetchRecords, fetchOrders]);

  const handleCollect = async (orderId: string) => {
    if (
      !window.confirm(
        'Confirm sample collection for this order. Collection can only be performed once.',
      )
    ) {
      return;
    }
    setCollectingId(orderId);
    setCollectConflict(false);
    try {
      await diagnosticsService.collectSample(orderId);
      await fetchOrders();
    } catch (err) {
      const apiErr = err as Error & { code?: string; statusCode?: number };
      if (apiErr.code === 'INVALID_TRANSITION' || apiErr.statusCode === 409) {
        setCollectConflict(true); // another technician already collected it
        await fetchOrders();
      } else {
        setOrdersError(apiErr);
      }
    } finally {
      setCollectingId(null);
    }
  };

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

        {/* M12 HERO — governed AI note-draft panel (assigned physician only). */}
        {physicianWrite &&
          hasPermission(role, 'ai_interaction:invoke') &&
          encounter.status === 'active' && (
            <Card>
              <h2 className={styles.sectionTitle}>AI Assistance</h2>
              <AiNoteDraftPanel
                encounterId={encounterId}
                recordType="soap"
                onBound={() => {
                  void fetchRecords();
                }}
              />
            </Card>
          )}

        {canReadClinical && encounter.status === 'active' && (
          <Card>
            <h2 className={styles.sectionTitle}>Clinical Records</h2>{' '}
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

        {canReadDx && (
          <Card>
            <h2 className={styles.sectionTitle}>Diagnostics</h2>
            {collectConflict && (
              <AlertBanner
                severity="warning"
                title="Already collected"
                dismissible
                onDismiss={() => setCollectConflict(false)}
              >
                Another technician already collected this sample. The list below shows the current
                state.
              </AlertBanner>
            )}
            {ordersLoading ? (
              <Skeleton variant="rectangular" height={100} />
            ) : ordersError ? (
              <ErrorState
                title="Could not load diagnostics"
                message={ordersError.message}
                onRetry={fetchOrders}
              />
            ) : orders.length === 0 ? (
              <EmptyState
                icon={<TestTubes size={32} />}
                title="No diagnostics ordered"
                description="Lab orders placed during this consultation will appear here."
              />
            ) : (
              <ul className={styles.recordList}>
                {orders.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={styles.recordRow}
                      onClick={() => router.push(`/diagnostics/${o.id}`)}
                    >
                      <span style={{ fontWeight: 500 }}>{o.testName}</span>
                      {o.priority === 'stat' && <Badge variant="critical">‼ STAT</Badge>}
                      {o.priority === 'urgent' && <Badge variant="stable">▲ Urgent</Badge>}
                      <Badge variant={o.status === 'ordered' ? 'stable' : 'neutral'}>
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                      <span className={styles.mrn}>
                        ordered {new Date(o.createdAt).toLocaleString()}
                        {o.collectedAt &&
                          ` · collected ${new Date(o.collectedAt).toLocaleTimeString()}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(canOrderDx || canCollectDx) && (
              <div
                className={styles.actionsBar}
                style={{ justifyContent: 'flex-start', marginTop: 16 }}
              >
                {canOrderDx && (
                  <Button
                    variant="secondary"
                    size="md"
                    iconLeft={<FlaskConical size={14} />}
                    onClick={() => router.push(`/encounters/${encounter.id}/diagnostics/new`)}
                  >
                    Order Diagnostic
                  </Button>
                )}
                {canCollectDx &&
                  orders
                    .filter((o) => o.status === 'ordered')
                    .map((o) => (
                      <Button
                        key={o.id}
                        variant="primary"
                        size="md"
                        disabled={collectingId === o.id}
                        onClick={() => handleCollect(o.id)}
                      >
                        {collectingId === o.id ? 'Collecting…' : `Collect Sample — ${o.testName}`}
                      </Button>
                    ))}
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
