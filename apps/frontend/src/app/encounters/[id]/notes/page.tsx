'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { AppShell } from '../../../../components/layout/AppShell/AppShell';
import { PatientHeader } from '../../../../components/clinical/LovableClinical';
import { EncounterNavTabs } from '../../../../components/clinical/EncounterNavTabs';
import { AiNoteDraftPanel } from '../../../../components/ai/AiNoteDraftPanel';
import { Card, CardContent } from '../../../../components/ui/Card/Card';
import { Badge } from '../../../../components/ui/Badge/Badge';
import { Button } from '../../../../components/ui/Button/Button';
import { Table, THead, TH, TBody, TR, TD, RowLink, TableSkeleton } from '../../../../components/ui/Table/Table';
import { AlertBanner } from '../../../../components/ui/Alert/AlertBanner';
import { encounterService } from '../../../../services/encounter-service';
import { clinicalService } from '../../../../services/clinical-service';
import { computeAgeYears } from '../../../../utils/dashboard';
import { useAuth } from '../../../../hooks/useAuth';
import { hasPermission } from '../../../../utils/rbac';
import type { EncounterDetailResponse, ClinicalRecordResponse } from 'shared';
import styles from './notes.module.css';

export default function EncounterNotesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const encounterId = params?.id as string;
  const { user } = useAuth();

  const [encounter, setEncounter] = useState<EncounterDetailResponse | null>(null);
  const [records, setRecords] = useState<ClinicalRecordResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAiDraft, setShowAiDraft] = useState(false);

  const canWrite = hasPermission(user?.role, 'clinical_record:write');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      encounterService.getEncounterById(encounterId),
      clinicalService.getClinicalRecords(encounterId),
    ])
      .then(([encRes, recRes]) => {
        if (!cancelled) {
          setEncounter(encRes.data);
          setRecords(recRes.data);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load clinical documentation for this encounter.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [encounterId]);

  return (
    <AppShell
      breadcrumbs={['Operations', 'Encounters', encounter?.patient?.mrn ?? encounterId, 'Notes']}
      requiredPermission="clinical_record:read"
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
              actions={
                canWrite && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAiDraft((prev) => !prev)}
                    >
                      {showAiDraft ? 'Hide AI Draft' : 'AI Draft Note'}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => router.push(`/encounters/${encounterId}/clinical-records/new?type=soap`)}
                      iconLeft={<Plus size={14} />}
                    >
                      New Note
                    </Button>
                  </div>
                )
              }
            />
          </div>
        )}

        <EncounterNavTabs encounterId={encounterId} />

        {error && (
          <AlertBanner severity="warning" title="Documentation unavailable">
            {error}
          </AlertBanner>
        )}

        {/* AI Note Drafting Panel (strictly separated from signing) */}
        {showAiDraft && canWrite && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <AiNoteDraftPanel
              encounterId={encounterId}
              recordType="soap"
              onBound={() => {
                setShowAiDraft(false);
                void clinicalService.getClinicalRecords(encounterId).then((res) => setRecords(res.data));
              }}
            />
          </div>
        )}

        {/* Clinical Records List */}
        <Card elevation="xs" padding="none">
          <div className={styles.cardHeader}>
            <div>
              <h3>Clinical Records & Progress Notes</h3>
              <p>Governed documentation · drafts require explicit clinician signature</p>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={4} />
          ) : records.length === 0 ? (
            <CardContent>
              <p className={styles.emptyNote}>
                No clinical records documented yet. Click &quot;New Note&quot; or use &quot;AI Draft Note&quot; to begin.
              </p>
            </CardContent>
          ) : (
            <Table ariaLabel="Clinical Records">
              <THead>
                <tr>
                  <TH>Record Type</TH>
                  <TH>Status</TH>
                  <TH>Created At</TH>
                  <TH>Version</TH>
                  <TH align="right">Action</TH>
                </tr>
              </THead>
              <TBody>
                {records.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8125rem' }}>
                        {r.recordType.replace('_', ' ')}
                      </span>
                    </TD>
                    <TD>
                      <Badge
                        variant={r.status === 'signed' ? 'stable' : 'pending'}
                        size="sm"
                      >
                        {r.status === 'signed' ? 'Signed' : 'Draft (Unsigned)'}
                      </Badge>
                    </TD>
                    <TD>{new Date(r.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</TD>
                    <TD>
                      <code style={{ fontSize: '0.8125rem' }}>v{r.version}</code>
                    </TD>
                    <TD align="right">
                      <RowLink
                        href={`/encounters/${encounterId}/clinical-records/${r.id}`}
                        aria-label={`Open record ${r.id}`}
                      >
                        {r.status === 'draft' ? 'Edit & Sign' : 'View Signed'}
                      </RowLink>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
