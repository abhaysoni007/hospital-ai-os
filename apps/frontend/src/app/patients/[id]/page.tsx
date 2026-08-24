'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Card } from '../../../components/ui/Card/Card';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { patientService } from '../../../services/patient-service';
import { PatientResponse } from 'shared';
import styles from './profile.module.css';
import { Calendar, FileText } from 'lucide-react';
import { Button } from '../../../components/ui/Button/Button';
import { CardHeader, CardContent } from '../../../components/ui/Card/Card';

export default function PatientProfilePage() {
  const params = useParams();
  const id = params.id as string;
  
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const response = await patientService.getPatientById(id);
        setPatient(response.data);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id]);

  if (loading) {
    return (
      <AppShell breadcrumbs={['Operations', 'Patients', 'Loading...']} requiredPermission="patient:read">
        <div style={{ padding: '24px' }}>
          <Skeleton variant="rectangular" height={300} />
        </div>
      </AppShell>
    );
  }

  if (error || !patient) {
    return (
      <AppShell breadcrumbs={['Operations', 'Patients', 'Error']} requiredPermission="patient:read">
        <EmptyState
          icon={<FileText size={32} />}
          title="Patient Not Found"
          description="The patient record you are looking for does not exist or you do not have permission to view it."
        />
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={['Operations', 'Patients', patient.mrn]} requiredPermission="patient:read">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.patientName}>{patient.firstName} {patient.lastName}</h1>
            <div className={styles.mrnRow}>
              <span>{patient.mrn}</span>
              <Badge variant={patient.status === 'active' ? 'stable' : 'neutral'}>
                {patient.status}
              </Badge>
            </div>
          </div>
          <Button variant="primary">Schedule Appointment</Button>
        </div>

        <div className={styles.grid}>
          <Card>
            <CardHeader title="Demographics" />
            <CardContent>
              <div className={styles.section}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Date of Birth</span>
                  <span className={styles.infoValue}>{new Date(patient.dateOfBirth).toLocaleDateString()}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Gender</span>
                  <span className={styles.infoValue} style={{ textTransform: 'capitalize' }}>{patient.gender}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Primary Phone</span>
                  <span className={styles.infoValue}>{patient.phonePrimary}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Emergency Contact</span>
                  <span className={styles.infoValue}>{patient.emergencyContactName || 'N/A'} ({patient.phoneEmergency || 'N/A'})</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Address & Details" />
            <CardContent>
              <div className={styles.section}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Address Line 1</span>
                  <span className={styles.infoValue}>{patient.addressLine1 || 'N/A'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>City</span>
                  <span className={styles.infoValue}>{patient.addressCity || 'N/A'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>State</span>
                  <span className={styles.infoValue}>{patient.addressState || 'N/A'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Postal Code</span>
                  <span className={styles.infoValue}>{patient.addressPostalCode || 'N/A'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div style={{ gridColumn: '1 / -1' }}>
            <Card>
              <CardHeader title="Upcoming Encounters" />
              <CardContent>
                <EmptyState
                  icon={<Calendar size={24} />}
                  title="No Upcoming Encounters"
                  description="This patient has no scheduled appointments or active encounters."
                  action={<Button variant="outline">Schedule Appointment</Button>}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
