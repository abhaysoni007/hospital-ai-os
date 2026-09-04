'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, ArrowLeft, Check } from 'lucide-react';
import { AppShell } from '../../../../components/layout/AppShell/AppShell';
import { PatientHeader } from '../../../../components/clinical/LovableClinical';
import { EncounterNavTabs } from '../../../../components/clinical/EncounterNavTabs';
import { Card } from '../../../../components/ui/Card/Card';
import { Button } from '../../../../components/ui/Button/Button';
import { AlertBanner } from '../../../../components/ui/Alert/AlertBanner';
import { Skeleton } from '../../../../components/ui/Skeleton/Skeleton';
import { encounterService } from '../../../../services/encounter-service';
import { computeAgeYears } from '../../../../utils/dashboard';
import type { EncounterDetailResponse } from 'shared';
import styles from './discharge.module.css';

export default function EncounterDischargePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const encounterId = params?.id as string;

  const [encounter, setEncounter] = useState<EncounterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [discharging, setDischarging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    encounterService
      .getEncounterById(encounterId)
      .then((res) => {
        if (!cancelled) setEncounter(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load encounter details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [encounterId]);

  const handleDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encounter) return;
    if (!summary.trim()) {
      setError('Please provide a clinical discharge summary.');
      return;
    }

    setDischarging(true);
    setError(null);
    try {
      await encounterService.dischargeEncounter(encounterId, {
        expectedVersion: encounter.version,
        summary: summary.trim(),
      });
      router.push(`/encounters/${encounterId}`);
    } catch {
      setError('Failed to discharge encounter. Please ensure all mandatory fields are completed.');
    } finally {
      setDischarging(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={['Operations', 'Encounters', encounter?.patient?.mrn ?? encounterId, 'Discharge']}
      requiredPermission="encounter:discharge"
    >
      <div className={styles.container}>
        <div className={styles.navRow}>
          <Link href={`/encounters/${encounterId}`} className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to encounter overview
          </Link>
        </div>

        {encounter?.patient && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <PatientHeader
              patient={{
                name: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
                mrn: encounter.patient.mrn,
                age: computeAgeYears(encounter.patient.dateOfBirth) ?? undefined,
                gender: encounter.patient.gender,
              }}
            />
          </div>
        )}

        <EncounterNavTabs encounterId={encounterId} />

        {error && (
          <AlertBanner severity="warning" title="Discharge Attention">
            {error}
          </AlertBanner>
        )}

        {loading ? (
          <Skeleton variant="rectangular" height={260} />
        ) : encounter?.status === 'discharged' ? (
          <Card elevation="xs" padding="md">
            <div className={styles.completedNotice}>
              <Check size={24} style={{ color: 'var(--color-success-main)' }} />
              <h3>Encounter Already Discharged</h3>
              <p>This encounter has been completed and discharged from active care.</p>
              <Button variant="outline" size="sm" onClick={() => router.push(`/encounters/${encounterId}`)}>
                Return to Encounter
              </Button>
            </div>
          </Card>
        ) : (
          <Card elevation="xs" padding="md">
            <form onSubmit={handleDischarge} className={styles.form}>
              <div className={styles.formHeader}>
                <div className={styles.iconCircle}>
                  <LogOut size={20} />
                </div>
                <div>
                  <h3>Discharge Clinical Encounter</h3>
                  <p>Provide final summary, follow-up instructions, and conclude episode of care</p>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="discharge-summary" className={styles.label}>
                  Clinical Discharge Summary &amp; Instructions <span className={styles.required}>*</span>
                </label>
                <textarea
                  id="discharge-summary"
                  className={styles.textarea}
                  rows={6}
                  placeholder="Enter patient diagnosis, hospital course, treatment given, medications prescribed, and follow-up advice…"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  required
                />
              </div>

              <div className={styles.actionsRow}>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => router.push(`/encounters/${encounterId}`)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="md"
                  isLoading={discharging}
                  iconLeft={<LogOut size={16} />}
                >
                  Confirm &amp; Finalize Discharge
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
