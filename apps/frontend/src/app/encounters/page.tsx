'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Button } from '../../components/ui/Button/Button';
import { Badge } from '../../components/ui/Badge/Badge';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import { Search } from 'lucide-react';
import { encounterService } from '../../services/encounter-service';
import type { EncounterListItem } from 'shared';
import styles from './encounters.module.css';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';
import { StaffRole } from '../../types/auth';

const STATUS_BADGE: Record<string, 'stable' | 'neutral' | 'critical'> = {
  registered: 'stable',
  active: 'neutral',
  discharge_initiated: 'neutral',
  discharged: 'neutral',
  closed: 'critical',
};

export default function EncountersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState('');

  const canUpdate = hasPermission(user?.role as StaffRole, 'encounter:update');

  const fetchEncounters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await encounterService.getEncounters({
        page: 1,
        pageSize: 100,
        status: (status || undefined) as never,
      });
      setEncounters(response.data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchEncounters();
  }, [fetchEncounters]);

  return (
    <AppShell breadcrumbs={['Clinical', 'Encounters']} requiredPermission="encounter:read">
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Encounters</h1>
          <div className={styles.filterField}>
            <label htmlFor="status" className={styles.label}>
              Status
            </label>
            <select
              id="status"
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="registered">Registered</option>
              <option value="active">Active</option>
              <option value="discharge_initiated">Discharge Initiated</option>
              <option value="discharged">Discharged</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {error && !loading && (
          <ErrorState
            title="Could not load encounters"
            message={error.message}
            onRetry={fetchEncounters}
          />
        )}

        <div className={styles.tableContainer}>
          {loading ? (
            <div style={{ padding: '24px' }}>
              <Skeleton variant="rectangular" height={200} />
            </div>
          ) : encounters.length === 0 ? (
            <EmptyState
              icon={<Search size={32} />}
              title="No encounters found"
              description="Encounters appear here after a patient is checked in or registered directly."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Type</th>
                  <th>Started</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {encounters.map((enc) => (
                  <tr key={enc.id} onClick={() => router.push(`/encounters/${enc.id}`)}>
                    <td>
                      <span className={styles.patientName}>
                        {enc.patient.firstName} {enc.patient.lastName}
                      </span>
                      <span className={styles.mrn}>{enc.patient.mrn}</span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {enc.encounterType.replace('_', ' ')}
                    </td>
                    <td>{enc.startedAt ? new Date(enc.startedAt).toLocaleTimeString() : '—'}</td>
                    <td>
                      <Badge variant={STATUS_BADGE[enc.status] ?? 'neutral'}>
                        {enc.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td>
                      {canUpdate && enc.status === 'registered' ? (
                        <Button
                          variant="primary"
                          size="md"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            router.push(`/encounters/${enc.id}`);
                          }}
                        >
                          Open
                        </Button>
                      ) : (
                        <span className={styles.readonlyHint}>View</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
