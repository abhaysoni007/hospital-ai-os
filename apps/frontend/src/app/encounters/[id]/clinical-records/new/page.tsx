'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '../../../../../components/layout/AppShell/AppShell';
import { Button } from '../../../../../components/ui/Button/Button';
import { Card } from '../../../../../components/ui/Card/Card';
import { Input } from '../../../../../components/ui/Input/Input';
import { AlertBanner } from '../../../../../components/ui/Alert/AlertBanner';
import { ErrorState } from '../../../../../components/ui/ErrorState/ErrorState';
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
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const encounterId = params?.id;
  const typeParam = searchParams?.get('type') as RecordType | null;

  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
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

  const guardNavigation = (action: () => void) => {
    if (!dirty || window.confirm('You have unsaved changes. Leave without saving?')) action();
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
        breadcrumbs={['Clinical', 'Encounters', 'New Record']}
        requiredPermission="clinical_record:write"
      >
        <div className={styles.container}>
          <ErrorState
            title="Unknown record type"
            message="Use the buttons on the encounter screen to open the correct note type."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={['Clinical', 'Encounters', 'New Record']}
      requiredPermission="clinical_record:write"
    >
      <div className={styles.container}>
        <h1 className={styles.title}>
          {validType === 'soap'
            ? 'New SOAP Note'
            : validType === 'progress_note'
              ? 'New Progress Note'
              : 'Record Vital Signs'}
        </h1>

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

        <Card>
          <form onSubmit={handleSubmit} noValidate>
            {validType === 'soap' &&
              SOAP_HEADINGS.map((h) => (
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
                    value={soapSections[h]}
                    onChange={(e) => {
                      setSoapSections((p) => ({ ...p, [h]: e.target.value }));
                      setDirty(true);
                    }}
                    maxLength={10_000}
                    rows={4}
                    placeholder={`${h.charAt(0).toUpperCase() + h.slice(1)} findings…`}
                  />
                  {fieldErrors[`content.sections`] && (
                    <span className={styles.fieldError}>{fieldErrors['content.sections']}</span>
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
                  <span className={styles.fieldError}>{fieldErrors['content.narrative']}</span>
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
                  <span className={styles.fieldError}>{fieldErrors['vitals']}</span>
                )}
                <div className={styles.fieldGroup} style={{ marginTop: 16 }}>
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
                onClick={() => guardNavigation(() => router.back())}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Saving…' : 'Save Draft'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
