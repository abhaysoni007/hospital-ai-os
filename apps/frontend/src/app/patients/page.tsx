'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Search, UserPlus, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Badge } from '../../components/ui/Badge/Badge';
import { Table, THead, TH, TBody, TR, TD, TableSkeleton } from '../../components/ui/Table/Table';
import { PatientIdentity } from '../../components/ui/Identity/Identity';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import { patientService } from '../../services/patient-service';
import { PatientResponse } from 'shared';
import styles from './patients.module.css';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';

/**
 * M13 — Patient directory. Truthful loading/error/empty states; rows are
 * fully keyboard-accessible; identity follows the canonical hierarchy.
 */
export default function PatientsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const canCreate = hasPermission(user?.role, 'patient:create');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await patientService.getPatients({
          page: 1,
          pageSize: 50,
          query: searchQuery.trim() || undefined,
        });
        if (!cancelled) setPatients(response.data);
      } catch {
        if (!cancelled) {
          setPatients([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, retryTick]);

  const retry = () => setRetryTick((t) => t + 1);

  return (
    <AppShell breadcrumbs={['Operations', 'Patients']} requiredPermission="patient:read">
      <div className={styles.container}>
        <PageHeader
          title="Patient directory"
          description="Search the registered patient population by name, medical record number, or phone."
          actions={
            canCreate ? (
              <Button
                variant="primary"
                size="md"
                iconLeft={<UserPlus size={16} />}
                onClick={() => router.push('/patients/new')}
              >
                Register patient
              </Button>
            ) : undefined
          }
        />

        <div className={styles.searchBar}>
          <Input
            id="patient-search"
            placeholder="Search by name, MRN, or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            iconLeft={<Search size={16} aria-hidden="true" />}
            type="search"
          />
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState
            title="Could not load the patient directory"
            message="The directory service did not respond. Check your connection and try again."
            onRetry={retry}
          />
        ) : patients.length === 0 ? (
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
          <div role="group" aria-label="Patient list">
            <p className={styles.resultNote} aria-live="polite">
              {searchQuery
                ? `${patients.length} match${patients.length === 1 ? '' : 'es'}`
                : `${patients.length} patient${patients.length === 1 ? '' : 's'}`}
            </p>
            <Table ariaLabel="Registered patients">
              <THead>
                <tr>
                  <TH>Patient</TH>
                  <TH>Date of birth</TH>
                  <TH>Gender</TH>
                  <TH>Phone</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {patients.map((patient) => (
                  <TR
                    key={patient.id}
                    interactive
                    onClick={() => router.push(`/patients/${patient.id}`)}
                    aria-label={`Open ${patient.firstName} ${patient.lastName}, MRN ${patient.mrn}`}
                  >
                    <TD>
                      <PatientIdentity
                        firstName={patient.firstName}
                        lastName={patient.lastName}
                        mrn={patient.mrn}
                      />
                    </TD>
                    <TD>{new Date(patient.dateOfBirth).toLocaleDateString()}</TD>
                    <TD className={styles.capitalize}>{patient.gender}</TD>
                    <TD>{patient.phonePrimary}</TD>
                    <TD>
                      <Badge variant={patient.status === 'active' ? 'stable' : 'neutral'} size="sm">
                        {patient.status === 'active' ? 'Active' : patient.status}
                      </Badge>
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
