'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../../components/layout/AppShell/AppShell';
import { Button } from '../../../../../components/ui/Button/Button';
import { Card } from '../../../../../components/ui/Card/Card';
import { Skeleton } from '../../../../../components/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../../../components/ui/ErrorState/ErrorState';
import { AlertBanner } from '../../../../../components/ui/Alert/AlertBanner';
import { ConfirmDialog } from '../../../../../components/ui/ConfirmDialog/ConfirmDialog';
import { PageHeader } from '../../../../../components/ui/PageHeader/PageHeader';
import { StaffIdentity } from '../../../../../components/ui/Identity/Identity';
import { RecordStatusBadge } from '../../../../../components/ui/SemanticBadges/SemanticBadges';
import { PatientContextHeader } from '../../../../../components/clinical/PatientContextHeader/PatientContextHeader';
import { Lock, RefreshCw, Sparkles } from 'lucide-react';
import { clinicalService } from '../../../../../services/clinical-service';
import { encounterService } from '../../../../../services/encounter-service';
import { getCachedStaffIdentity, getStaffIdentities } from '../../../../../services/staff-service';
import {
  soapContentSchema,
  progressNoteContentSchema,
  vitalsSchema,
  vitalSignsContentSchema,
  type ClinicalRecordResponse,
  type EncounterDetailResponse,
  type Vitals,
} from 'shared';
import styles from './clinical-record.module.css';
import { useAuth } from '../../../../../hooks/useAuth';
import { hasPermission } from '../../../../../utils/rbac';

/** Clinician-readable vital labels (ADR-015 field names). */
const VITAL_LABELS: Record<string, string> = {
  temperature_c: 'Temperature (°C)',
  pulse_bpm: 'Pulse (bpm)',
  resp_rate: 'Respiratory rate',
  bp_systolic: 'Systolic BP (mmHg)',
  bp_diastolic: 'Diastolic BP (mmHg)',
  spo2_pct: 'SpO₂ (%)',
  weight_kg: 'Weight (kg)',
  height_cm: 'Height (cm)',
};

const SOAP_HEADINGS = ['subjective', 'objective', 'assessment', 'plan'] as const;

export default function ClinicalRecordPage() {
  const params = useParams<{ id: string; recordId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const encounterId = params?.id;
  const recordId = params?.recordId;

  const [record, setRecord] = useState<ClinicalRecordResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmSign, setConfirmSign] = useState(false);
  const [authorName, setAuthorName] = useState<string | null>(null);

  // M17 — patient/encounter identity band. Roles holding clinical_record:read
  // but not encounter:read (pharmacist, lab technician) see the quiet
  // recovery note instead of the identity — never fabricated demographics.
  const [encounter, setEncounter] = useState<EncounterDetailResponse | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextTick, setContextTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setContextError(null);
    encounterService
      .getEncounterById(encounterId!)
      .then((res) => {
        if (!cancelled) setEncounter(res.data);
      })
      .catch(() => {
        if (!cancelled) setContextError('Patient context is not available for your role.');
      });
    return () => {
      cancelled = true;
    };
  }, [encounterId, contextTick]);

  // Editable form state
  const [soapSections, setSoapSections] = useState<Record<string, string>>({});
  const [narrative, setNarrative] = useState('');
  const [vitalsNote, setVitalsNote] = useState('');
  const [vitalsValues, setVitalsValues] = useState<Partial<Record<keyof Vitals, string>>>({});

  const role = user?.role;
  const canWrite = hasPermission(role, 'clinical_record:write');
  const canSign = role === 'physician' && hasPermission(role, 'clinical_record:sign');
  const isAuthor = !!record && user?.id === record.createdBy;
  const editable = !!record && record.status === 'draft' && isAuthor && canWrite;

  const loadIntoForm = useCallback((r: ClinicalRecordResponse) => {
    if (r.recordType === 'soap') {
      const sections = (r.content as { sections: Array<{ heading: string; content: string }> })
        .sections;
      setSoapSections(Object.fromEntries(sections.map((s) => [s.heading, s.content])));
    } else if (r.recordType === 'progress_note' || r.recordType === 'discharge_summary') {
      setNarrative((r.content as { narrative: string }).narrative);
    } else if (r.recordType === 'vital_signs') {
      const note = (r.content as { note?: string }).note ?? '';
      setVitalsNote(note);
      setVitalsValues(
        Object.fromEntries(
          Object.entries((r.vitals ?? {}) as Record<string, number>).map(([k, v]) => [
            k,
            String(v),
          ]),
        ),
      );
    }
    setDirty(false);
    setConflict(false);
  }, []);

  const fetchRecord = useCallback(async () => {
    if (!encounterId || !recordId) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await clinicalService.getClinicalRecord(encounterId, recordId);
      setRecord(res.data);
      return res.data;
    } catch {
      setError(
        'This record is no longer available. It may not exist or your role may not permit access.',
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [encounterId, recordId]);

  useEffect(() => {
    void fetchRecord().then((r) => {
      // Drafts open in edit mode ONLY for the author with write permission.
      if (r && r.status === 'draft' && user?.id === r.createdBy && canWrite) setEditing(true);
      if (r) loadIntoForm(r);
      // Resolve the author's human identity through the M12.2 projection.
      if (r?.createdBy) {
        void getStaffIdentities([r.createdBy]).then(() => {
          const identity = getCachedStaffIdentity(r.createdBy);
          if (identity) setAuthorName(identity.displayName);
        });
      }
    });
  }, [fetchRecord, loadIntoForm, user?.id, canWrite]);

  // Unsaved-changes protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty && editing) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, editing]);

  const buildPayload = () => {
    if (!record) return null;
    if (record.recordType === 'soap') {
      return {
        expectedVersion: record.version,
        content: {
          sections: SOAP_HEADINGS.map((h) => ({
            heading: h,
            content: soapSections[h] ?? '',
          })),
        },
      };
    }
    if (record.recordType === 'progress_note' || record.recordType === 'discharge_summary') {
      return { expectedVersion: record.version, content: { narrative } };
    }
    const vitals: Record<string, number> = {};
    for (const [k, v] of Object.entries(vitalsValues)) {
      if (v !== '' && v !== undefined) vitals[k] = Number(v);
    }
    return {
      expectedVersion: record.version,
      vitals,
      content: { note: vitalsNote.trim() },
    };
  };

  const validateClientSide = (payload: ReturnType<typeof buildPayload>): boolean => {
    if (!payload || !record) return false;
    let ok = true;
    if ('content' in payload && payload.content !== undefined) {
      const schema =
        record.recordType === 'soap'
          ? soapContentSchema
          : record.recordType === 'vital_signs'
            ? vitalSignsContentSchema
            : progressNoteContentSchema;
      ok = schema.safeParse(payload.content).success;
    }
    if ('vitals' in payload && payload.vitals !== undefined) {
      ok = ok && vitalsSchema.safeParse(payload.vitals).success;
    }
    return ok;
  };

  const handleSave = async () => {
    if (!record || !encounterId || !recordId) return;
    const payload = buildPayload();
    if (!payload || !validateClientSide(payload)) {
      setActionError('Please complete all required sections with valid values before saving.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const res = await clinicalService.updateClinicalRecord(
        encounterId,
        recordId,
        payload as never,
      );
      setRecord(res.data);
      loadIntoForm(res.data);
      setEditing(false);
    } catch (err) {
      const apiErr = err as Error & { code?: string };
      if (apiErr.code === 'VERSION_CONFLICT') {
        setConflict(true);
      } else {
        setActionError(apiErr.message || 'Failed to save changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!record || !encounterId || !recordId) return;
    setSigning(true);
    setActionError(null);
    try {
      const res = await clinicalService.signClinicalRecord(encounterId, recordId, record.version);
      setRecord(res.data);
      loadIntoForm(res.data);
      setEditing(false);
      setConfirmSign(false);
    } catch (err) {
      const apiErr = err as Error & { code?: string };
      if (apiErr.code === 'VERSION_CONFLICT') {
        setConflict(true);
        setConfirmSign(false);
      } else {
        setActionError(apiErr.message || 'Failed to sign the record.');
      }
    } finally {
      setSigning(false);
    }
  };

  const refreshLatest = async () => {
    const fresh = await fetchRecord();
    if (fresh) loadIntoForm(fresh);
  };

  if (loading) {
    return (
      <AppShell
        breadcrumbs={['Operations', 'Encounters']}
        requiredPermission="clinical_record:read"
      >
        <div className={styles.container}>
          <Skeleton variant="rectangular" height={280} />
        </div>
      </AppShell>
    );
  }

  if (error || !record) {
    return (
      <AppShell
        breadcrumbs={['Operations', 'Encounters']}
        requiredPermission="clinical_record:read"
      >
        <div className={styles.container}>
          <ErrorState title="Could not load clinical record" message={error ?? undefined} />
        </div>
      </AppShell>
    );
  }

  const signed = record.status === 'signed';

  return (
    <AppShell
      breadcrumbs={['Operations', 'Encounters', 'Documentation']}
      requiredPermission="clinical_record:read"
    >
      <div className={styles.container}>
        <PageHeader
          title={record.recordType.replace(/_/g, ' ')}
          actions={
            !editing &&
            canSign &&
            isAuthor &&
            record.status === 'draft' && (
              <Button variant="primary" onClick={() => setConfirmSign(true)}>
                Sign record
              </Button>
            )
          }
          meta={
            <>
              <span
                className={`${styles.stateChip} ${signed ? styles.stateSigned : styles.stateDraft}`}
              >
                {signed ? <Lock size={13} aria-hidden="true" /> : null}
                {signed ? 'Signed · locked and permanent' : 'Draft · editable by author'}
              </span>
              <RecordStatusBadge status={record.status} size="sm" />
              {record.aiDraftId && (
                <span className={styles.aiChip}>
                  <Sparkles size={11} aria-hidden="true" /> AI-assisted draft
                </span>
              )}
            </>
          }
        />

        <PatientContextHeader
          patient={encounter?.patient ?? null}
          error={contextError}
          onRetry={() => setContextTick((tick) => tick + 1)}
          encounter={
            encounter
              ? {
                  type: encounter.encounterType,
                  status: encounter.status,
                  startedAt: encounter.startedAt,
                }
              : null
          }
          patientHref={encounter ? `/patients/${encounter.patientId}` : undefined}
        />

        {conflict && (
          <AlertBanner
            severity="warning"
            title="This record changed while you were working"
            action={
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<RefreshCw size={14} />}
                onClick={() => void refreshLatest()}
              >
                Load latest version
              </Button>
            }
          >
            Your changes were NOT saved. Loading the latest version will discard your local edits.
          </AlertBanner>
        )}

        {actionError && (
          <AlertBanner
            severity="critical"
            title="Action failed"
            dismissible
            onDismiss={() => setActionError(null)}
          >
            {actionError}
          </AlertBanner>
        )}

        {/* Document */}
        <Card elevation="xs">
          <div className={styles.meta}>
            <span>Version {record.version}</span>
            <span>
              Author{' '}
              {authorName ? (
                <StaffIdentity compact displayName={authorName} />
              ) : (
                record.createdBy.slice(0, 8) + '…'
              )}
            </span>
            <span>Created {new Date(record.createdAt).toLocaleString()}</span>
            <span>Updated {new Date(record.updatedAt).toLocaleString()}</span>
            {signed && record.signedAt && (
              <span>Signed {new Date(record.signedAt).toLocaleString()}</span>
            )}
          </div>

          {record.recordType === 'soap' &&
            SOAP_HEADINGS.map((h) =>
              editing ? (
                <div key={h} className={styles.fieldGroup}>
                  <label htmlFor={`soap-${h}`} className={`${styles.label} ${styles.capitalize}`}>
                    {h}
                  </label>
                  <textarea
                    id={`soap-${h}`}
                    className={styles.textarea}
                    value={soapSections[h] ?? ''}
                    onChange={(e) => {
                      setSoapSections((p) => ({ ...p, [h]: e.target.value }));
                      setDirty(true);
                    }}
                    maxLength={10_000}
                    rows={4}
                  />
                </div>
              ) : (
                <div key={h} className={styles.fieldGroup}>
                  <span className={`${styles.label} ${styles.capitalize}`}>{h}</span>
                  <p className={styles.readText}>{(soapSections[h] ?? '').trim() || '—'}</p>
                </div>
              ),
            )}

          {(record.recordType === 'progress_note' || record.recordType === 'discharge_summary') &&
            (editing ? (
              <div className={styles.fieldGroup}>
                <label htmlFor="narrative" className={styles.label}>
                  Narrative
                </label>
                <textarea
                  id="narrative"
                  className={styles.textarea}
                  value={narrative}
                  onChange={(e) => {
                    setNarrative(e.target.value);
                    setDirty(true);
                  }}
                  maxLength={20_000}
                  rows={8}
                />
              </div>
            ) : (
              <div className={styles.fieldGroup}>
                <span className={styles.label}>Narrative</span>
                <p className={styles.readText}>{narrative || '—'}</p>
              </div>
            ))}

          {record.recordType === 'vital_signs' && (
            <>
              <dl className={styles.vitalsGrid}>
                {Object.entries(record.vitals ?? {}).map(([k, v]) => (
                  <React.Fragment key={k}>
                    {editing ? (
                      <div className={styles.vitalCellEdit}>
                        <label htmlFor={`vital-${k}`} className={styles.label}>
                          {VITAL_LABELS[k] ?? k}
                        </label>
                        <input
                          id={`vital-${k}`}
                          className={styles.input}
                          type="number"
                          step="any"
                          value={vitalsValues[k as keyof Vitals] ?? ''}
                          onChange={(e) => {
                            setVitalsValues((p) => ({ ...p, [k as keyof Vitals]: e.target.value }));
                            setDirty(true);
                          }}
                        />
                      </div>
                    ) : (
                      <div className={styles.vitalCell}>
                        <dt className={styles.vitalLabel}>{VITAL_LABELS[k] ?? k}</dt>
                        <dd className={`${styles.vitalValue} ${styles.numeric}`}>{String(v)}</dd>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </dl>
              {editing ? (
                <div className={`${styles.fieldGroup} ${styles.mt}`}>
                  <label htmlFor="vnote" className={styles.label}>
                    Remark (optional)
                  </label>
                  <input
                    id="vnote"
                    className={styles.input}
                    value={vitalsNote}
                    maxLength={2000}
                    onChange={(e) => {
                      setVitalsNote(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>
              ) : (
                (record.content as { note?: string })?.note && (
                  <p className={styles.readText}>
                    Remark: {(record.content as { note: string }).note}
                  </p>
                )
              )}
            </>
          )}
        </Card>

        <div className={styles.actionsBar}>
          {editing && editable && !signed ? (
            <>
              <Button variant="outline" onClick={() => window.history.back()} disabled={saving}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                disabled={!dirty}
                isLoading={saving}
              >
                {dirty ? 'Save changes' : 'No changes'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => router.push(`/encounters/${encounterId}`)}>
              Back to encounter
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSign}
        title="Sign this record?"
        confirmLabel="Confirm & sign"
        isLoading={signing}
        onConfirm={() => void handleSign()}
        onCancel={() => setConfirmSign(false)}
      >
        Signing locks the document permanently under your name (version {record.version}). It cannot
        be edited or deleted afterwards.
      </ConfirmDialog>
    </AppShell>
  );
}
