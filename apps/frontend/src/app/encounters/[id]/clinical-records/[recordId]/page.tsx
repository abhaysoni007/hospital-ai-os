'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../../components/layout/AppShell/AppShell';
import { Button } from '../../../../../components/ui/Button/Button';
import { Card } from '../../../../../components/ui/Card/Card';
import { Skeleton } from '../../../../../components/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../../../components/ui/ErrorState/ErrorState';
import { AlertBanner } from '../../../../../components/ui/Alert/AlertBanner';
import { Lock, RefreshCw, FileSignature } from 'lucide-react';
import { clinicalService } from '../../../../../services/clinical-service';
import {
  soapContentSchema,
  progressNoteContentSchema,
  vitalsSchema,
  vitalSignsContentSchema,
  type ClinicalRecordResponse,
  type Vitals,
} from 'shared';
import styles from './clinical-record.module.css';
import { useAuth } from '../../../../../hooks/useAuth';
import { hasPermission } from '../../../../../utils/rbac';
import { StaffRole } from '../../../../../types/auth';

export default function ClinicalRecordPage() {
  const params = useParams<{ id: string; recordId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const encounterId = params?.id;
  const recordId = params?.recordId;

  const [record, setRecord] = useState<ClinicalRecordResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmSign, setConfirmSign] = useState(false);

  // Editable form state
  const [soapSections, setSoapSections] = useState<Record<string, string>>({});
  const [narrative, setNarrative] = useState('');
  const [vitalsNote, setVitalsNote] = useState('');
  const [vitalsValues, setVitalsValues] = useState<Partial<Record<keyof Vitals, string>>>({});

  const role = user?.role as StaffRole | undefined;
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
    if (!encounterId || !recordId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clinicalService.getClinicalRecord(encounterId, recordId);
      setRecord(res.data);
      return res.data;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [encounterId, recordId]);

  useEffect(() => {
    fetchRecord().then((r) => {
      // Drafts open in edit mode ONLY for the author with write permission
      if (r && r.status === 'draft' && user?.id === r.createdBy && canWrite) setEditing(true);
      if (r) loadIntoForm(r);
    });
  }, [fetchRecord, loadIntoForm]);

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
          sections: ['subjective', 'objective', 'assessment', 'plan'].map((h) => ({
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
      setActionError('Please complete all required fields with valid values before saving.');
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
      <AppShell breadcrumbs={['Clinical', 'Records']} requiredPermission="clinical_record:read">
        <div className={styles.container}>
          <Skeleton variant="rectangular" height={280} />
        </div>
      </AppShell>
    );
  }

  if (error || !record) {
    return (
      <AppShell breadcrumbs={['Clinical', 'Records']} requiredPermission="clinical_record:read">
        <div className={styles.container}>
          <ErrorState
            title="Could not load clinical record"
            message={error?.message ?? 'The requested record does not exist.'}
            onRetry={fetchRecord}
          />
        </div>
      </AppShell>
    );
  }

  const signed = record.status === 'signed';

  return (
    <AppShell
      breadcrumbs={['Clinical', 'Encounters', 'Record']}
      requiredPermission="clinical_record:read"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title} style={{ textTransform: 'capitalize' }}>
            {record.recordType.replace(/_/g, ' ')}
          </h1>
          <span
            className={`${styles.stateChip} ${signed ? styles.stateSigned : styles.stateDraft}`}
          >
            {signed ? <Lock size={14} /> : <FileSignature size={14} />}
            {signed ? 'Signed — locked and permanent' : 'Draft — editable by author'}
          </span>
        </div>

        {conflict && (
          <AlertBanner
            severity="warning"
            title="This record was modified by someone else"
            action={
              <Button
                variant="secondary"
                size="md"
                iconLeft={<RefreshCw size={14} />}
                onClick={refreshLatest}
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

        <Card>
          <div className={styles.meta}>
            <span>Version {record.version}</span>
            <span>Created {new Date(record.createdAt).toLocaleString()}</span>
            <span>Updated {new Date(record.updatedAt).toLocaleString()}</span>
            {signed && record.signedAt && (
              <span>Signed {new Date(record.signedAt).toLocaleString()}</span>
            )}
          </div>

          {record.recordType === 'soap' &&
            (['subjective', 'objective', 'assessment', 'plan'] as const).map((h) =>
              editing ? (
                <div key={h} className={styles.fieldGroup}>
                  <label
                    htmlFor={`soap-${h}`}
                    className={styles.label}
                    style={{ textTransform: 'capitalize' }}
                  >
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
                  <span className={styles.label} style={{ textTransform: 'capitalize' }}>
                    {h}
                  </span>
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
              <div className={styles.vitalsGrid}>
                {Object.entries(record.vitals ?? {}).map(([k, v]) => (
                  <React.Fragment key={k}>
                    {editing ? (
                      <input
                        aria-label={k}
                        className={styles.input}
                        type="number"
                        value={vitalsValues[k as keyof Vitals] ?? ''}
                        onChange={(e) => {
                          setVitalsValues((p) => ({ ...p, [k as keyof Vitals]: e.target.value }));
                          setDirty(true);
                        }}
                      />
                    ) : (
                      <div className={styles.vitalCell}>
                        <span className={styles.vitalValue}>{String(v)}</span>
                        <span className={styles.vitalLabel}>{k.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              {editing ? (
                <div className={styles.fieldGroup} style={{ marginTop: 12 }}>
                  <label htmlFor="vnote" className={styles.label}>
                    Remark
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

        {signed && (
          <div className={`${styles.signedNotice}`}>
            <Lock size={16} />
            Signed record — this document is permanent and cannot be edited.
          </div>
        )}

        <div className={styles.actionsBar}>
          {editing && editable && !signed && (
            <>
              <Button variant="outline" onClick={() => router.back()} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving || !dirty}>
                {saving ? 'Saving…' : dirty ? 'Save Changes' : 'No changes'}
              </Button>
            </>
          )}
          {!editing && canSign && isAuthor && record.status === 'draft' && !confirmSign && (
            <Button variant="primary" onClick={() => setConfirmSign(true)}>
              Sign Record
            </Button>
          )}
          {!editing && confirmSign && record.status === 'draft' && (
            <>
              <span className={styles.confirmText}>
                This note becomes permanent and cannot be edited. Confirm signing?
              </span>
              <Button variant="outline" onClick={() => setConfirmSign(false)} disabled={signing}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSign} disabled={signing}>
                {signing ? 'Signing…' : 'Confirm & Sign'}
              </Button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
