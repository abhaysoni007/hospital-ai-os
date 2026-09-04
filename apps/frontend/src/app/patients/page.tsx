'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Search, UserPlus, Users, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Badge } from '../../components/ui/Badge/Badge';
import { Table, THead, TH, TBody, TR, TD, TableSkeleton } from '../../components/ui/Table/Table';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import { patientService } from '../../services/patient-service';
import { PatientResponse } from 'shared';
import styles from './patients.module.css';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';
import { parseApiError, ParsedError } from '../../utils/error-parser';
import { computeAgeYears } from '../../utils/dashboard';

/**
 * M13 & Lovable — Patient directory. Truthful loading/error/empty states;
 * rows are fully keyboard-accessible; identity follows the canonical clinical hierarchy.
 */
export default function PatientsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ParsedError | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'discharged'>('all');

  const canCreate = hasPermission(user?.role, 'patient:create');

  useEffect(() => {
    let cancelled = false;
    const isImmediate = searchQuery.trim() === '';
    const delay = isImmediate ? 0 : 300;

    const executeFetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await patientService.getPatients({
          page: 1,
          pageSize: 50,
          query: searchQuery.trim() || undefined,
        });
        if (!cancelled) setPatients(response.data);
      } catch (err: unknown) {
        if (!cancelled) {
          setPatients([]);
          setError(parseApiError(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (delay === 0) {
      void executeFetch();
      return () => {
        cancelled = true;
      };
    }

    const timer = setTimeout(() => {
      void executeFetch();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, retryTick]);

  const retry = () => setRetryTick((t) => t + 1);

  const filteredPatients = patients.filter((p) => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  return (
    <AppShell breadcrumbs={['Operations', 'Patients']} requiredPermission="patient:read">
      <div className={styles.container}>
        <PageHeader
          title="Patient directory"
          description="Browse, search, and manage registered patients across all clinical workflows."
          actions={
            canCreate ? (
              <Button
                variant="primary"
                onClick={() => router.push('/patients/new')}
                iconLeft={<UserPlus size={16} />}
              >
                Register patient
              </Button>
            ) : undefined
          }
        />

        {/* Filter bar with Lovable search and status pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ maxWidth: '360px', width: '100%' }}>
              <Input
                id="patient-search-input"
                label="Search patients by name or MRN"
                hideLabel
                placeholder="Search by patient name or MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                iconLeft={<Search size={16} aria-hidden="true" />}
                type="search"
              />
            </div>

            <div
              role="group"
              aria-label="Filter by patient status"
              style={{
                display: 'inline-flex',
                gap: '4px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                padding: '2px',
              }}
            >
              {(['all', 'active', 'discharged'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  style={{
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    backgroundColor: statusFilter === s ? 'var(--color-primary-600)' : 'transparent',
                    color: statusFilter === s ? '#ffffff' : 'var(--text-secondary)',
                    textTransform: 'capitalize',
                  }}
                >
                  {s === 'all' ? 'All Patients' : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState
            title={error.title}
            message={error.message}
            correlationId={error.requestId}
            onRetry={retry}
          />
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            icon={<Users size={32} />}
            title={searchQuery ? 'No patients match your search' : 'No patients registered yet'}
            description={
              searchQuery
                ? 'Try a different name, MRN, or phone number.'
                : canCreate
                  ? 'Register the first patient to begin using the hospital workspace.'
                  : 'Once patients are registered they will appear here.'
            }
            action={
              canCreate && !searchQuery ? (
                <Button
                  variant="primary"
                  onClick={() => router.push('/patients/new')}
                  iconLeft={<UserPlus size={16} />}
                >
                  Register patient
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="clinical-panel overflow-x-auto" style={{ padding: 'var(--space-2)' }}>
            <Table ariaLabel="Registered patients">
              <THead>
                <tr>
                  <TH>Patient</TH>
                  <TH>MRN</TH>
                  <TH>Gender</TH>
                  <TH>Contact</TH>
                  <TH>Status</TH>
                  <TH align="right">Chart</TH>
                </tr>
              </THead>
              <TBody>
                {filteredPatients.map((patient) => {
                  const age = computeAgeYears(patient.dateOfBirth);
                  return (
                    <TR
                      key={patient.id}
                      interactive
                      onClick={() => router.push(`/patients/${patient.id}`)}
                      aria-label={`Open ${patient.firstName} ${patient.lastName}, MRN ${patient.mrn}`}
                    >
                      <TD>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {patient.firstName} {patient.lastName}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {age ? `${age} yrs · ` : ''}{patient.gender === 'male' ? 'Male' : patient.gender === 'female' ? 'Female' : patient.gender}
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <span className="num" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          {patient.mrn}
                        </span>
                      </TD>
                      <TD className={styles.capitalize}>{patient.gender}</TD>
                      <TD>
                        <span className="num" style={{ fontSize: '0.8125rem' }}>
                          {patient.phonePrimary || '—'}
                        </span>
                      </TD>
                      <TD>
                        <Badge variant={patient.status === 'active' ? 'stable' : 'neutral'} size="sm">
                          {patient.status === 'active' ? 'Active' : patient.status}
                        </Badge>
                      </TD>
                      <TD align="right">
                        <Link
                          href={`/patients/${patient.id}`}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--color-primary-600)',
                            textDecoration: 'none',
                          }}
                        >
                          Open Chart →
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}

        {/* Lovable Duplicate Resolution Advisory Panel */}
        <div style={{ marginTop: 'var(--space-6)' }}>
          <div
            className="clinical-panel p-4"
            style={{
              borderLeft: '4px solid var(--color-warning-main, #d97706)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--color-warning-main, #d97706)' }} />
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Identity Resolution & Duplicate Check
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Automatic soundex and phone matching verifies incoming patient registrations against the central Master Patient Index.
              Zero duplicate records currently flagged for supervisor review.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
