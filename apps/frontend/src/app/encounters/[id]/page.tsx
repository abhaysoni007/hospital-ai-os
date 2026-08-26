'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Button } from '../../../components/ui/Button/Button';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card/Card';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState/ErrorState';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog';
import { PageHeader } from '../../../components/ui/PageHeader/PageHeader';
import {
  EncounterStatusBadge,
  OrderStatusBadge,
  PriorityBadge,
  RecordStatusBadge,
} from '../../../components/ui/SemanticBadges/SemanticBadges';
import { FileText, Plus, FlaskConical, Lock, CalendarClock, Stethoscope } from 'lucide-react';
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

const STATUS_FLOW = [
  'registered',
  'active',
  'discharge_initiated',
  'discharged',
  'closed',
] as const;

/**
 * M13 — The central clinical workspace. Answers "what is happening with this
 * patient right now": identity band, live status, documentation, diagnostics,
 * and governed AI assistance in one coherent surface.
 *
 * ADR-013: sections render ONLY when the caller holds the corresponding
 * permission. The backend already omits unauthorized data — this is UX only.
 */
export default function EncounterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const encounterId = params?.id;
  const { user } = useAuth();
  const role = user?.role;

  const [encounter, setEncounter] = useState<EncounterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canReadClinical = hasPermission(role, 'clinical_record:read');
  const canActivate =
    hasPermission(role, 'encounter:update') && (role === 'physician' || role === 'nurse');

  // M9 — clinical records section (permission-gated sub-endpoint)
  const physicianWrite = role === 'physician' && hasPermission(role, 'clinical_record:write');
  const nurseVitals = role === 'nurse' && hasPermission(role, 'clinical_record:write');
  const canWriteAny = physicianWrite || nurseVitals;

  const [records, setRecords] = useState<ClinicalRecordResponse[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  // M10 — diagnostics section (gated, decomposed per ADR-013/016)
  const canReadDx = hasPermission(role, 'diagnostic_order:read');
  const canOrderDx = role === 'physician' && hasPermission(role, 'diagnostic_order:create');
  const canCollectDx = role === 'lab_technician' && hasPermission(role, 'diagnostic_order:update');
  const [orders, setOrders] = useState<DiagnosticOrderResponse[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [collectTarget, setCollectTarget] = useState<DiagnosticOrderResponse | null>(null);

  const fetchEncounter = useCallback(async () => {
    if (!encounterId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await encounterService.getEncounterById(encounterId);
      setEncounter(res.data);
    } catch {
      setError(
        'This record is no longer available. It may not exist or your role may not permit access.',
      );
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  const fetchRecords = useCallback(async () => {
    if (!encounterId || !canReadClinical) return;
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const res = await clinicalService.getClinicalRecords(encounterId);
      setRecords(res.data);
    } catch {
      setRecordsError('Could not load clinical records for this encounter.');
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
    } catch {
      setOrdersError('Could not load diagnostic orders for this encounter.');
    } finally {
      setOrdersLoading(false);
    }
  }, [encounterId, canReadDx]);

  useEffect(() => {
    void fetchEncounter();
  }, [fetchEncounter]);

  useEffect(() => {
    if (canReadClinical) void fetchRecords();
    if (canReadDx) void fetchOrders();
  }, [canReadClinical, canReadDx, fetchRecords, fetchOrders]);

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
        await fetchEncounter();
        setActionError(
          'This encounter was updated by someone else while you were viewing it. The latest state is shown — try again.',
        );
      } else if (apiErr.code === 'INVALID_TRANSITION') {
        await fetchEncounter();
        setActionError('This action is no longer available — the encounter state changed.');
      } else {
        setActionError('Failed to start the consultation. Try again.');
      }
    } finally {
      setActing(false);
    }
  };

  const handleCollect = async () => {
    if (!collectTarget) return;
    setCollectingId(collectTarget.id);
    try {
      await diagnosticsService.collectSample(collectTarget.id);
      setCollectTarget(null);
      await fetchOrders();
    } catch (err) {
      const apiErr = err as Error & { code?: string; statusCode?: number };
      setCollectTarget(null);
      if (apiErr.code === 'INVALID_TRANSITION' || apiErr.statusCode === 409) {
        await fetchOrders();
        setActionError(
          'Another technician already collected this sample. The list shows the current state.',
        );
      } else {
        setOrdersError('Sample collection failed. Try again.');
      }
    } finally {
      setCollectingId(null);
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={['Operations', 'Encounters']} requiredPermission="encounter:read">
        <div className={styles.container}>
          <Skeleton variant="rectangular" height={280} />
        </div>
      </AppShell>
    );
  }

  if (error || !encounter) {
    return (
      <AppShell breadcrumbs={['Operations', 'Encounters']} requiredPermission="encounter:read">
        <div className={styles.container}>
          <ErrorState title="Encounter unavailable" message={error ?? undefined} />
        </div>
      </AppShell>
    );
  }

  const statusIndex = STATUS_FLOW.indexOf(encounter.status as (typeof STATUS_FLOW)[number]);
  const patientName = `${encounter.patient.firstName} ${encounter.patient.lastName}`;

  return (
    <AppShell
      breadcrumbs={['Operations', 'Encounters', patientName]}
      requiredPermission="encounter:read"
    >
      <div className={styles.container}>
        {/* Identity band */}
        <PageHeader
          title={patientName}
          description={
            encounter.chiefComplaint && canReadClinical
              ? `Chief complaint: ${encounter.chiefComplaint}`
              : undefined
          }
          actions={
            canActivate && encounter.status === 'registered' ? (
              <Button
                variant="primary"
                size="md"
                isLoading={acting}
                onClick={() => void handleStartConsultation()}
              >
                Start consultation
              </Button>
            ) : undefined
          }
          meta={
            <>
              <EncounterStatusBadge status={encounter.status} size="sm" />
              <span className={styles.metaMono}>{encounter.patient.mrn}</span>
              <span className={styles.metaItem}>
                {new Date(encounter.patient.dateOfBirth).toLocaleDateString()}
              </span>
              <span className={`${styles.metaItem} ${styles.capitalize}`}>
                {encounter.encounterType.replace('_', ' ')}
              </span>
              {encounter.startedAt && (
                <span className={styles.metaItem}>
                  <CalendarClock size={12} aria-hidden="true" /> started{' '}
                  {new Date(encounter.startedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </>
          }
        />

        {actionError && (
          <AlertBanner
            severity="warning"
            title="Attention"
            dismissible
            onDismiss={() => setActionError(null)}
          >
            {actionError}
          </AlertBanner>
        )}

        <div className={styles.layout}>
          {/* Context rail */}
          <div className={styles.contextRail}>
            <Card elevation="xs" padding="md">
              <CardHeader
                title="Care journey"
                subtitle="Encounter lifecycle"
                icon={<Stethoscope size={15} aria-hidden="true" />}
              />
              <CardContent>
                <ol className={styles.timeline} aria-label="Encounter lifecycle">
                  {STATUS_FLOW.map((s, i) => (
                    <li
                      key={s}
                      className={[
                        styles.timelineItem,
                        i < statusIndex ? styles.timelineDone : '',
                        i === statusIndex ? styles.timelineCurrent : '',
                      ].join(' ')}
                      aria-current={i === statusIndex ? 'step' : undefined}
                    >
                      {s.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card elevation="xs" padding="md">
              <CardHeader title="Visit details" />
              <CardContent>
                <dl className={styles.detailList}>
                  <div className={styles.detailRow}>
                    <dt>Appointment</dt>
                    <dd>
                      {encounter.appointment
                        ? `${encounter.appointment.scheduledDate} · ${encounter.appointment.scheduledTime.slice(0, 5)}`
                        : 'Walk-in'}
                    </dd>
                  </div>
                  {encounter.appointment?.tokenNumber != null && (
                    <div className={styles.detailRow}>
                      <dt>Token</dt>
                      <dd className={styles.mono}>
                        #{String(encounter.appointment.tokenNumber).padStart(2, '0')}
                      </dd>
                    </div>
                  )}
                  <div className={styles.detailRow}>
                    <dt>Created</dt>
                    <dd>{new Date(encounter.createdAt).toLocaleDateString()}</dd>
                  </div>
                  {canReadClinical && !encounter.chiefComplaint && (
                    <div className={styles.detailRow}>
                      <dt>Chief complaint</dt>
                      <dd className={styles.quiet}>Not documented yet</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Work column */}
          <div className={styles.workColumn}>
            {/* M12 HERO — governed AI note-draft (assigned physician, active) */}
            {physicianWrite &&
              hasPermission(role, 'ai_interaction:invoke') &&
              encounter.status === 'active' && (
                <section aria-labelledby="ai-assistance-heading">
                  <h2 id="ai-assistance-heading" className={styles.sectionHeading}>
                    AI assistance
                  </h2>
                  <AiNoteDraftPanel
                    encounterId={encounterId}
                    recordType="soap"
                    onBound={() => {
                      void fetchRecords();
                    }}
                  />
                </section>
              )}

            {canReadClinical && encounter.status !== 'registered' && (
              <Card elevation="xs" padding="none">
                <div className={styles.cardBar}>
                  <h3 className={styles.cardTitle}>Clinical documentation</h3>
                  {canWriteAny && (
                    <div className={styles.cardActions}>
                      {physicianWrite && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<Plus size={14} />}
                            onClick={() =>
                              router.push(
                                `/encounters/${encounter.id}/clinical-records/new?type=soap`,
                              )
                            }
                          >
                            SOAP note
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<Plus size={14} />}
                            onClick={() =>
                              router.push(
                                `/encounters/${encounter.id}/clinical-records/new?type=progress_note`,
                              )
                            }
                          >
                            Progress note
                          </Button>
                        </>
                      )}
                      {nurseVitals && (
                        <Button
                          variant="secondary"
                          size="sm"
                          iconLeft={<Plus size={14} />}
                          onClick={() =>
                            router.push(
                              `/encounters/${encounter.id}/clinical-records/new?type=vital_signs`,
                            )
                          }
                        >
                          Vitals
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {recordsLoading ? (
                  <CardContent>
                    <Skeleton variant="rectangular" height={120} />
                  </CardContent>
                ) : recordsError ? (
                  <CardContent>
                    <ErrorState
                      title="Documentation unavailable"
                      message={recordsError}
                      onRetry={() => void fetchRecords()}
                    />
                  </CardContent>
                ) : records.length === 0 ? (
                  <CardContent>
                    <EmptyState
                      icon={<FileText size={28} />}
                      title="Nothing documented yet"
                      description={
                        canWriteAny
                          ? 'Start the clinical record for this consultation.'
                          : 'Notes and vitals recorded during this consultation will appear here.'
                      }
                    />
                  </CardContent>
                ) : (
                  <ul className={styles.entityList}>
                    {records.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className={styles.entityRow}
                          onClick={() =>
                            router.push(`/encounters/${encounter.id}/clinical-records/${r.id}`)
                          }
                        >
                          <span className={styles.entityTitle}>
                            {r.recordType.replace(/_/g, ' ')}
                            {r.aiDraftId && <span className={styles.aiChip}>AI-assisted</span>}
                          </span>
                          <RecordStatusBadge status={r.status} size="sm" />
                          <span className={styles.entityMeta}>
                            v{r.version} · updated {new Date(r.updatedAt).toLocaleString()}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            {canReadDx && (
              <Card elevation="xs" padding="none">
                <div className={styles.cardBar}>
                  <h3 className={styles.cardTitle}>Diagnostics</h3>
                  <div className={styles.cardActions}>
                    {canOrderDx && (
                      <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<FlaskConical size={14} />}
                        onClick={() => router.push(`/encounters/${encounter.id}/diagnostics/new`)}
                      >
                        Order diagnostic
                      </Button>
                    )}
                  </div>
                </div>

                {collectTarget && (
                  <ConfirmDialog
                    isOpen
                    title="Confirm sample collection"
                    confirmLabel="Confirm collection"
                    isLoading={collectingId !== null}
                    onConfirm={() => void handleCollect()}
                    onCancel={() => setCollectTarget(null)}
                  >
                    Collection is recorded once with your identity and timestamp and can never be
                    repeated for order <strong>{collectTarget.testCode}</strong>.
                  </ConfirmDialog>
                )}

                {ordersLoading ? (
                  <CardContent>
                    <Skeleton variant="rectangular" height={100} />
                  </CardContent>
                ) : ordersError ? (
                  <CardContent>
                    <ErrorState
                      title="Diagnostics unavailable"
                      message={ordersError}
                      onRetry={() => void fetchOrders()}
                    />
                  </CardContent>
                ) : orders.length === 0 ? (
                  <CardContent>
                    <EmptyState
                      icon={<FlaskConical size={28} />}
                      title="No diagnostics ordered"
                      description="Lab orders placed during this consultation will appear here."
                    />
                  </CardContent>
                ) : (
                  <ul className={styles.entityList}>
                    {orders.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          className={styles.entityRow}
                          onClick={() => router.push(`/diagnostics/${o.id}`)}
                        >
                          <span className={styles.entityTitle}>{o.testName}</span>
                          {o.priority !== 'routine' && (
                            <PriorityBadge priority={o.priority} size="sm" />
                          )}
                          <OrderStatusBadge status={o.status} size="sm" />
                          <span className={styles.entityMeta}>
                            {o.collectedAt
                              ? `collected ${new Date(o.collectedAt).toLocaleTimeString()}`
                              : `ordered ${new Date(o.createdAt).toLocaleTimeString()}`}
                          </span>
                          {canCollectDx && o.status === 'ordered' && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={collectingId === o.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCollectTarget(o);
                              }}
                            >
                              Collect sample
                            </Button>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        </div>

        <p className={styles.lockedNote}>
          <Lock size={12} aria-hidden="true" /> Signed documentation becomes part of the permanent,
          immutable clinical record.
        </p>
      </div>
    </AppShell>
  );
}
