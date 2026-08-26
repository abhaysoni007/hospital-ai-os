'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '../../../../../components/layout/AppShell/AppShell';
import { Button } from '../../../../../components/ui/Button/Button';
import { Card } from '../../../../../components/ui/Card/Card';
import { Input } from '../../../../../components/ui/Input/Input';
import { AlertBanner } from '../../../../../components/ui/Alert/AlertBanner';
import { ErrorState } from '../../../../../components/ui/ErrorState/ErrorState';
import { ConfirmDialog } from '../../../../../components/ui/ConfirmDialog/ConfirmDialog';
import { PageHeader } from '../../../../../components/ui/PageHeader/PageHeader';
import { Skeleton } from '../../../../../components/ui/Skeleton/Skeleton';
import { clinicalService } from '../../../../../services/clinical-service';
import { createClinicalRecordSchema, type Vitals } from 'shared';
import styles from './new-clinical-record.module.css';

type RecordType = 'soap' | 'progress_note' | 'vital_signs';

const SOAP_HEADINGS = ['subjective', 'objective', 'assessment', 'plan'] as const;

const VITAL_FIELDS: Array<{ key: keyof Vitals; label: string; step: string }> = [
  { key: 'temperature_c', label: 'Temperature (°C)', step: '0.1' },
  { key: 'pulse_bpm', label: 'Pulse (bpm)', step: '1' },
  { key: 'resp_rate', label: 'Resp. rate (/min)', step: '1' },
  { key: 'bp_systolic', label: 'BP systolic (mmHg)', step: '1' },
  { key: 'bp_diastolic', label: 'BP diastolic (mmHg)', step: '1' },
  { key: 'spo2_pct', label: 'SpO₂ (%)', step: '1' },
  { key: 'weight_kg', label: 'Weight (kg)', step: '0.1' },
  { key: 'height_cm', label: 'Height (cm)', step: '0.1' },
];

export default function NewClinicalRecordPage() {
  return (
    <Suspense
      fallback={
        <AppShell
          breadcrumbs={['Operations', 'Encounters']}
          requiredPermission="clinical_record:write"
        >
          <Skeleton variant="rectangular" height={320} />
        </AppShell>
      }
    >
      <NewRecordForm />
    </Suspense>
  );
}

function NewRecordForm() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const encounterId = params?.id;
  const typeParam = searchParams?.get('type') as RecordType | null;

  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [soapSections, setSoapSections] = useState<Record<string, string>>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [narrative, setNarrative] = useState('');
  const [vitalsNote, setVitalsNote] = useState('');
  const [vitalsValues, setVitalsValues] = useState<Partial<Record<keyof Vitals, string>>>({});

  const validType: RecordType | null =
    typeParam === 'soap' || typeParam === 'progress_note' || typeParam === 'vital_signs'
      ? typeParam
      : null;

  // Unsaved-changes protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const buildPayload = useMemo(() => {
    return (): Record<string, unknown> | null => {
      if (!validType) return null;
      if (validType === 'soap') {
        return {
          recordType: 'soap',
          content: {
            sections: SOAP_HEADINGS.map((h) => ({ heading: h, content: soapSections[h] })),
          },
        };
      }
      if (validType === 'progress_note') {
        return { recordType: 'progress_note', content: { narrative } };
      }
      const vitals: Record<string, number> = {};
      for (const [k, v] of Object.entries(vitalsValues)) {
        if (v !== '' && v !== undefined) vitals[k] = Number(v);
      }
      return {
        recordType: 'vital_signs',
        vitals,
        ...(vitalsNote.trim() ? { content: { note: vitalsNote.trim() } } : {}),
      };
    };
  }, [validType, soapSections, narrative, vitalsNote, vitalsValues]);

  const validateClientSide = (payload: Record<string, unknown>): boolean => {
    const result = createClinicalRecordSchema.safeParse(payload);
    if (result.success) {
      setFieldErrors({});
      return true;
    }
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (!errors[key]) errors[key] = issue.message;
    }
    setFieldErrors(errors);
    return false;
  };

  const requestLeave = (action: () => void) => {
    if (!dirty) action();
    else setLeaveOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = buildPayload();
    if (!payload) return;
    if (!validateClientSide(payload)) return;

    setLoading(true);
    try {
      await clinicalService.createClinicalRecord(encounterId!, payload as never);
      router.push(`/encounters/${encounterId}`);
    } catch (err) {
      const apiErr = err as Error & { statusCode?: number };
      setError(
        apiErr.statusCode === 403
          ? 'You are not authorized to create this type of clinical record.'
          : apiErr.message || 'Failed to save the clinical record.',
      );
      setLoading(false);
    }
  };

  if (!validType) {
    return (
      <AppShell
        breadcrumbs={['Operations', 'Encounters', 'Documentation']}
        requiredPermission="clinical_record:write"
      >
        <div className={styles.container}>
          <ErrorState
            title="Unknown record type"
            message="Use the buttons on the encounter workspace to open the correct note type."
          />
        </div>
      </AppShell>
    );
  }

  const sectionError = fieldErrors['content.sections'];

  return (
    <AppShell
      breadcrumbs={['Operations', 'Encounters', 'New documentation']}
      requiredPermission="clinical_record:write"
    >
      <div className={styles.container}>
        <PageHeader
          title={
            validType === 'soap'
              ? 'New SOAP note'
              : validType === 'progress_note'
                ? 'New progress note'
                : 'Record vital signs'
          }
          description="Saved as a draft under your name. Signing later makes the document permanent."
        />

        {error && (
          <AlertBanner
            severity={error.includes('not authorized') ? 'warning' : 'critical'}
            title="Save failed"
            dismissible
            onDismiss={() => setError(null)}
          >
            {error}
          </AlertBanner>
        )}

        <Card elevation="xs">
          <form onSubmit={handleSubmit} noValidate>
            {validType === 'soap' &&
              SOAP_HEADINGS.map((h) => (
                <div key={h} className={styles.fieldGroup}>
                  <label htmlFor={`soap-${h}`} className={`${styles.label} ${styles.capitalize}`}>
                    {h}
                  </label>
                  <textarea
                    id={`soap-${h}`}
                    className={styles.textarea}
                    value={soapSections[h]}
                    onChange={(e) => {
                      setSoapSections((p) => ({ ...p, [h]: e.target.value }));
                      setDirty(true);
                    }}
                    maxLength={10_000}
                    rows={4}
                    placeholder={`${h.charAt(0).toUpperCase() + h.slice(1)} findings…`}
                  />
                  {sectionError && (
                    <span className={styles.fieldError} role="alert">
                      {sectionError}
                    </span>
                  )}
                </div>
              ))}

            {validType === 'progress_note' && (
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
                  placeholder="Progress note…"
                />
                {fieldErrors['content.narrative'] && (
                  <span className={styles.fieldError} role="alert">
                    {fieldErrors['content.narrative']}
                  </span>
                )}
              </div>
            )}

            {validType === 'vital_signs' && (
              <>
                <div className={styles.vitalsGrid}>
                  {VITAL_FIELDS.map(({ key, label, step }) => (
                    <Input
                      key={key}
                      id={key}
                      label={label}
                      type="number"
                      step={step}
                      value={vitalsValues[key] ?? ''}
                      onChange={(e) => {
                        setVitalsValues((p) => ({ ...p, [key]: e.target.value }));
                        setDirty(true);
                      }}
                    />
                  ))}
                </div>
                {fieldErrors['vitals'] && (
                  <span className={styles.fieldError} role="alert">
                    {fieldErrors['vitals']}
                  </span>
                )}
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
              </>
            )}

            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => requestLeave(() => router.back())}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={loading}>
                Save draft
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={leaveOpen}
        title="Leave with unsaved changes?"
        confirmLabel="Discard & leave"
        variant="danger"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => router.back()}
      >
        Your entries have not been saved. Leaving this page will discard them.
      </ConfirmDialog>
    </AppShell>
  );
}
