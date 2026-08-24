'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Card } from '../../../components/ui/Card/Card';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { appointmentService } from '../../../services/appointment-service';
import { patientService } from '../../../services/patient-service';
import { createAppointmentSchema } from 'shared';
import type { PatientResponse } from 'shared';
import styles from './new-appointment.module.css';

export default function NewAppointmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<PatientResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [physicians, setPhysicians] = useState<
    { id: string; firstName: string; lastName: string; departmentId: string }[]
  >([]);

  const [formData, setFormData] = useState({
    patientId: '',
    departmentId: '',
    doctorId: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
    scheduledTime: '09:00',
  });

  useEffect(() => {
    appointmentService
      .getBookingOptions()
      .then((res) => {
        setDepartments(res.data.departments);
        setPhysicians(res.data.physicians);
      })
      .catch((err) => setError(err.message || 'Failed to load booking options.'))
      .finally(() => setOptionsLoading(false));
  }, []);

  // Debounced patient search (reuses the M17 patient directory search API)
  useEffect(() => {
    if (!patientQuery) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await patientService.getPatients({
          page: 1,
          pageSize: 10,
          query: patientQuery,
        });
        setPatientResults(res.data);
      } catch {
        setPatientResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  const availablePhysicians = useMemo(
    () =>
      physicians.filter((p) => !formData.departmentId || p.departmentId === formData.departmentId),
    [physicians, formData.departmentId],
  );

  const selectedPatient = patientResults.find((p) => p.id === formData.patientId);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validateClientSide = (): boolean => {
    const result = createAppointmentSchema.safeParse({
      ...formData,
      scheduledTime: formData.scheduledTime,
    });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    if (!validateClientSide()) return;

    setLoading(true);
    try {
      await appointmentService.bookAppointment(formData);
      router.push('/appointments');
    } catch (err) {
      const apiError = err as Error & { statusCode?: number; code?: string };
      setError(apiError.message || 'An error occurred while booking the appointment.');
      setErrorCode(apiError.code ?? null);
      setLoading(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={['Operations', 'Appointments', 'Book']}
      requiredPermission="appointment:create"
    >
      <div className={styles.container}>
        <h1 className={styles.title}>Book Appointment</h1>

        {error && (
          <AlertBanner
            severity={errorCode === 'SLOT_UNAVAILABLE' ? 'warning' : 'critical'}
            title={errorCode === 'SLOT_UNAVAILABLE' ? 'Slot unavailable' : 'Booking failed'}
            dismissible
            onDismiss={() => setError(null)}
          >
            {error}
          </AlertBanner>
        )}

        <Card>
          {optionsLoading ? (
            <Skeleton variant="rectangular" height={320} />
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.formGrid}>
                <h2 className={styles.sectionTitle}>Patient</h2>

                <div className={styles.fullWidth}>
                  <Input
                    id="patientSearch"
                    label="Search Patient"
                    placeholder="Search by name or MRN…"
                    value={
                      selectedPatient
                        ? `${selectedPatient.firstName} ${selectedPatient.lastName} (${selectedPatient.mrn})`
                        : patientQuery
                    }
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, patientId: '' }));
                      setPatientQuery(e.target.value);
                    }}
                    required
                  />
                  {(searching || patientResults.length > 0) && !selectedPatient && (
                    <ul className={styles.searchResults}>
                      {searching && <li className={styles.searchResultItem}>Searching…</li>}
                      {!searching && patientResults.length === 0 && patientQuery && (
                        <li className={styles.searchResultItem}>No patients found.</li>
                      )}
                      {patientResults.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className={styles.searchResult}
                            onClick={() => setFormData((prev) => ({ ...prev, patientId: p.id }))}
                          >
                            {p.firstName} {p.lastName} · {p.mrn} · DOB {p.dateOfBirth}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {fieldErrors.patientId && (
                    <span className={styles.fieldError}>{fieldErrors.patientId}</span>
                  )}
                </div>

                <h2 className={styles.sectionTitle}>Visit Details</h2>

                <div>
                  <label htmlFor="departmentId" className={styles.label}>
                    Department
                  </label>
                  <select
                    id="departmentId"
                    name="departmentId"
                    className={styles.select}
                    value={formData.departmentId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        departmentId: e.target.value,
                        doctorId: '',
                      }))
                    }
                    required
                  >
                    <option value="">Select department…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="doctorId" className={styles.label}>
                    Physician
                  </label>
                  <select
                    id="doctorId"
                    name="doctorId"
                    className={styles.select}
                    value={formData.doctorId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select physician…</option>
                    {availablePhysicians.map((p) => (
                      <option key={p.id} value={p.id}>
                        Dr. {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.doctorId && (
                    <span className={styles.fieldError}>{fieldErrors.doctorId}</span>
                  )}
                </div>

                <Input
                  id="scheduledDate"
                  label="Date"
                  type="date"
                  name="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={handleChange}
                  required
                  error={fieldErrors.scheduledDate}
                />
                <Input
                  id="scheduledTime"
                  label="Time (HH:mm)"
                  name="scheduledTime"
                  placeholder="09:00"
                  value={formData.scheduledTime}
                  onChange={handleChange}
                  required
                  error={fieldErrors.scheduledTime}
                />
              </div>

              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'Booking…' : 'Book Appointment'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
