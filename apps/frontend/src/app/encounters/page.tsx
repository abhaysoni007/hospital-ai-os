'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Select } from '../../components/ui/Input/Select';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import {
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
  RowLink,
  TableSkeleton,
} from '../../components/ui/Table/Table';
import { PatientIdentity } from '../../components/ui/Identity/Identity';
import { EncounterStatusBadge } from '../../components/ui/SemanticBadges/SemanticBadges';
import { encounterService } from '../../services/encounter-service';
import type { EncounterListItem, EncounterStatusValue } from 'shared';
import { parseApiError, ParsedError } from '../../utils/error-parser';
import styles from './encounters.module.css';

/**
 * M13 — Encounter list. The operational entry point into active clinical
 * work; every row opens the central encounter workspace.
 */
export default function EncountersPage() {
  const router = useRouter();
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ParsedError | null>(null);
  const [status, setStatus] = useState('');

  const fetchEncounters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await encounterService.getEncounters({
        page: 1,
        pageSize: 100,
        status: (status || undefined) as EncounterStatusValue | undefined,
      });
      setEncounters(response.data);
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void fetchEncounters();
  }, [fetchEncounters]);

  return (
    <AppShell breadcrumbs={['Operations', 'Encounters']} requiredPermission="encounter:read">
      <div className={styles.container}>
        <PageHeader
          title="Encounters"
          description="Every consultation begins here — check-in creates an encounter, activation starts the clinical work."
          meta={
            <Select
              id="status"
              label="Filter by status"
              placeholder="All statuses"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'registered', label: 'Registered' },
                { value: 'active', label: 'Active' },
                { value: 'discharge_initiated', label: 'Discharge initiated' },
                { value: 'discharged', label: 'Discharged' },
                { value: 'closed', label: 'Closed' },
              ]}
              className={styles.statusSelect}
            />
          }
        />

        {!loading && !error && encounters.length > 0 && (
          <p className={styles.resultNote} aria-live="polite">
            {encounters.length} encounter{encounters.length === 1 ? '' : 's'}
            {status ? ' matching this filter' : ''}
          </p>
        )}

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState
            title={error.title}
            message={error.message}
            correlationId={error.requestId}
            onRetry={() => void fetchEncounters()}
          />
        ) : encounters.length === 0 ? (
          <EmptyState
            icon={<Stethoscope size={32} />}
            title={status ? `No ${status.replace('_', ' ')} encounters` : 'No encounters yet'}
            description={
              status
                ? 'Nothing matches this filter right now.'
                : 'Encounters appear after a patient is checked in for an appointment.'
            }
          />
        ) : (
          <div className="clinical-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <Table ariaLabel="Encounters">
              <THead>
                <tr>
                  <TH>Patient</TH>
                  <TH width="120px">Type</TH>
                  <TH width="140px">Started</TH>
                  <TH>Status</TH>
                  <TH aria-label="Open" />
                </tr>
              </THead>
              <TBody>
                {encounters.map((enc) => (
                  <TR
                    key={enc.id}
                    interactive
                    onClick={() => router.push(`/encounters/${enc.id}`)}
                    aria-label={`Open encounter for ${enc.patient.firstName} ${enc.patient.lastName}`}
                  >
                    <TD>
                      <PatientIdentity
                        firstName={enc.patient.firstName}
                        lastName={enc.patient.lastName}
                        mrn={enc.patient.mrn}
                      />
                    </TD>
                    <TD className={styles.capitalize}>{enc.encounterType.replace('_', ' ')}</TD>
                    <TD>
                      {enc.startedAt
                        ? new Date(enc.startedAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </TD>
                    <TD>
                      <EncounterStatusBadge status={enc.status} size="sm" />
                    </TD>
                    <TD align="right">
                      <RowLink href={`/encounters/${enc.id}`} aria-label={`Open encounter`}>
                        Open workspace
                      </RowLink>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
