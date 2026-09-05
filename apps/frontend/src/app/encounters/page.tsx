'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Select } from '../../components/ui/Input/Select';
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
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';
import styles from './encounters.module.css';

/**
 * M13 — Encounter list. The operational entry point into active clinical
 * work; every row opens the central encounter workspace.
 */
export default function EncountersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canReadEncounters = hasPermission(user?.role, 'encounter:read');

  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ParsedError | null>(null);
  const [status, setStatus] = useState('');

  const fetchEncounters = useCallback(async () => {
    if (!canReadEncounters) {
      setLoading(false);
      return;
    }
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
  }, [canReadEncounters, status]);

  useEffect(() => {
    void fetchEncounters();
  }, [fetchEncounters]);

  const activeCount = encounters.filter((e) => e.status === 'active').length;
  const registeredCount = encounters.filter((e) => e.status === 'registered').length;
  const dischargeCount = encounters.filter((e) => e.status === 'discharge_initiated').length;
  const totalCount = encounters.length;

  return (
    <AppShell breadcrumbs={['Operations', 'Encounters']} requiredPermission="encounter:read">
      <div className={styles.container}>
        {/* Tactical Header HUD */}
        <div className={styles.headerCard}>
          <div className={styles.headerTitles}>
            <div className={styles.titleRow}>
              <span className={styles.titleIcon} aria-hidden="true">
                <Stethoscope size={20} />
              </span>
              <h1 className={styles.title}>
                <span>Clinical Encounters</span>
                <span className={styles.versionTag}>LIVE QUEUE</span>
              </h1>
            </div>
            <p className={styles.subtitle}>
              Every consultation begins here — check-in creates an encounter, activation starts the clinical work.
            </p>
          </div>

          <div className="flex items-center gap-3">
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
          </div>
        </div>

        {/* Tactical Metrics Grid */}
        <div className={styles.metricsGrid} role="region" aria-label="Encounter Queue Metrics">
          <div className={`${styles.metricCard} ${styles.metricActive}`}>
            <div className={styles.metricLabel}>
              <span>Active Consultations</span>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" aria-hidden="true" />
            </div>
            <div className={styles.metricValue}>{activeCount}</div>
            <div className={styles.metricHint}>Under active clinical care</div>
          </div>

          <div className={`${styles.metricCard} ${styles.metricRegistered}`}>
            <div className={styles.metricLabel}>
              <span>Awaiting Triage</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            </div>
            <div className={styles.metricValue}>{registeredCount}</div>
            <div className={styles.metricHint}>Registered in queue</div>
          </div>

          <div className={`${styles.metricCard} ${styles.metricDischarge}`}>
            <div className={styles.metricLabel}>
              <span>Discharge Initiated</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            </div>
            <div className={styles.metricValue}>{dischargeCount}</div>
            <div className={styles.metricHint}>Pending final summary</div>
          </div>

          <div className={`${styles.metricCard} ${styles.metricTotal}`}>
            <div className={styles.metricLabel}>
              <span>Total Census</span>
              <span className="text-[10px] font-mono text-muted-foreground opacity-70">LIVE</span>
            </div>
            <div className={styles.metricValue}>{totalCount}</div>
            <div className={styles.metricHint}>Total encounters loaded</div>
          </div>
        </div>

        {/* Tactical Filter Pills */}
        <div className={styles.controlRow}>
          <div className={styles.filterPills}>
            {[
              { id: '', label: 'All Encounters', count: totalCount },
              { id: 'active', label: 'Active', count: activeCount },
              { id: 'registered', label: 'Registered', count: registeredCount },
              { id: 'discharge_initiated', label: 'Discharge Initiated', count: dischargeCount },
              { id: 'discharged', label: 'Discharged', count: encounters.filter(e => e.status === 'discharged').length },
              { id: 'closed', label: 'Closed', count: encounters.filter(e => e.status === 'closed').length },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatus(f.id)}
                className={`${styles.filterPill} ${status === f.id ? styles.filterPillActive : ''}`}
              >
                <span>{f.label}</span>
                <span className={styles.filterCount}>{f.count}</span>
              </button>
            ))}
          </div>

          {!loading && !error && encounters.length > 0 && (
            <p className={styles.resultNote} aria-live="polite">
              <span>●</span>
              <span>{encounters.length} encounter{encounters.length === 1 ? '' : 's'}{status ? ' matching filter' : ''}</span>
            </p>
          )}
        </div>

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
          <div className={styles.tableWrapper}>
            <Table ariaLabel="Encounters">
              <THead>
                <tr>
                  <TH>Patient</TH>
                  <TH width="140px">Type</TH>
                  <TH width="160px">Started</TH>
                  <TH width="130px">Status</TH>
                  <TH aria-label="Open" width="160px" align="right" />
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
                    <TD className={styles.capitalize}>
                      <span className="font-mono text-xs font-semibold">
                        {enc.encounterType.replace('_', ' ')}
                      </span>
                    </TD>
                    <TD>
                      <span className="font-mono text-xs text-muted-foreground">
                        {enc.startedAt
                          ? new Date(enc.startedAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
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
