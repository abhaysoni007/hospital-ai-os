'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Search, Plus, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Badge } from '../../components/ui/Badge/Badge';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { patientService } from '../../services/patient-service';
import { PatientResponse } from 'shared';
import styles from './patients.module.css';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';
import { StaffRole } from '../../types/auth';

export default function PatientsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const canCreate = hasPermission(user?.role as StaffRole, 'patient:create');

  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      try {
        const response = await patientService.getPatients({
          page: 1,
          pageSize: 50,
          query: searchQuery || undefined,
        });
        setPatients(response.data);
      } catch (error) {
        console.error('Failed to fetch patients', error);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(() => {
      fetchPatients();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCreate = () => {
    router.push('/patients/new');
  };

  const handleRowClick = (id: string) => {
    router.push(`/patients/${id}`);
  };

  return (
    <AppShell breadcrumbs={['Operations', 'Patients']} requiredPermission="patient:read">
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Patient Directory</h1>
          {canCreate && (
            <Button
              variant="primary"
              size="md"
              iconLeft={<Plus size={16} />}
              onClick={handleCreate}
            >
              Register Patient
            </Button>
          )}
        </div>

        <div className={styles.searchBar}>
          <div style={{ flex: 1 }}>
            <Input
              id="search"
              placeholder="Search by name, MRN, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              iconLeft={<Search size={16} />}
            />
          </div>
        </div>

        <div className={styles.tableContainer}>
          {loading ? (
            <div style={{ padding: '24px' }}>
              <Skeleton variant="rectangular" height={200} />
            </div>
          ) : patients.length === 0 ? (
            <EmptyState
              icon={<UserPlus size={32} />}
              title="No patients found"
              description={
                searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Register a new patient to get started.'
              }
              action={
                canCreate ? <Button onClick={handleCreate}>Register Patient</Button> : undefined
              }
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date of Birth</th>
                  <th>Gender</th>
                  <th>Phone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id} onClick={() => handleRowClick(patient.id)}>
                    <td>
                      <div className={styles.patientName}>
                        {patient.firstName} {patient.lastName}
                      </div>
                      <div className={styles.mrn}>{patient.mrn}</div>
                    </td>
                    <td>{new Date(patient.dateOfBirth).toLocaleDateString()}</td>
                    <td style={{ textTransform: 'capitalize' }}>{patient.gender}</td>
                    <td>{patient.phonePrimary}</td>
                    <td>
                      <Badge variant={patient.status === 'active' ? 'stable' : 'neutral'}>
                        {patient.status}
                      </Badge>
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
