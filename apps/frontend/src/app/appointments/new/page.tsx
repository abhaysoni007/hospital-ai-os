'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CalendarCheck, ChevronLeft, Search } from 'lucide-react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Card, CardContent } from '../../../components/ui/Card/Card';
import { PageHeader } from '../../../components/ui/PageHeader/PageHeader';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { appointmentService } from '../../../services/appointment-service';
import { patientService } from '../../../services/patient-service';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/rbac';
import { createAppointmentSchema } from 'shared';
import type { PatientResponse } from 'shared';
import styles from './new-appointment.module.css';

/**
 * M13 — Booking as a guided clinical workflow:
 * Patient → Department → Physician → Date & Time → Review → Confirm.
 * The token is allocated by the server at booking time and is never shown
 * pre-emptively. SLOT_UNAVAILABLE is handled as a recoverable warning.
 */
export default function NewAppointmentPage() {
  return (
    <Suspense
      fallback={
        <AppShell
          breadcrumbs={['Operations', 'Appointments', 'Book']}
          requiredPermission="appointment:create"
        >
          <Skeleton variant="rectangular" height={360} />
        </AppShell>
      }
    >
      <BookingFlow />
    </Suspense>
  );
}

function BookingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams?.get('patientId') ?? null;

  const [step, setStep] = useState<'details' | 'review'>('details');
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [preselectedPatient, setPreselectedPatient] = useState<PatientResponse | null>(null);
  const [patientResults, setPatientResults] = useState<PatientResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);

  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [physicians, setPhysicians] = useState<
    { id: string; firstName: string; lastName: string; departmentId: string }[]
  >([]);

  const today = new Date().toISOString().slice(0, 10);
  const [formData, setFormData] = useState({
    patientId: '',
    departmentId: '',
    doctorId: '',
    scheduledDate: today,
    scheduledTime: '09:00',
  });

  const { user } = useAuth();
  const canCreate = hasPermission(user?.role, 'appointment:create');

  // Load booking options (ADR-014).
  useEffect(() => {
    if (!canCreate) {
      setOptionsLoading(false);
      return;
    }
    appointmentService
      .getBookingOptions()
      .then((res) => {
        setDepartments(res.data.departments);
        setPhysicians(res.data.physicians);
      })
      .catch(() => setOptionsError('Booking options could not be loaded. Retry shortly.'))
      .finally(() => setOptionsLoading(false));
  }, [canCreate]);

  // Support ?patientId= handoff from the patient chart.
  useEffect(() => {
    if (!preselectedPatientId) return;
    let cancelled = false;
    patientService
      .getPatientById(preselectedPatientId)
      .then((res) => {
        if (!cancelled) {
          setPreselectedPatient(res.data);
          setFormData((prev) => ({ ...prev, patientId: res.data.id }));
        }
      })
      .catch(() => {
        /* invalid preselect — user picks manually */
      });
    return () => {
      cancelled = true;
    };
  }, [preselectedPatientId]);

  // Debounced patient search with honest error surfacing.
  useEffect(() => {
    if (!patientQuery.trim()) {
      setPatientResults([]);
      setSearchError(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await patientService.getPatients({
          page: 1,
          pageSize: 10,
          query: patientQuery.trim(),
        });
        setPatientResults(res.data);
      } catch {
        setPatientResults([]);
        setSearchError('Patient search is unavailable right now.');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  // Close the picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const handlePointerDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [pickerOpen]);

  const availablePhysicians = useMemo(
    () =>
      physicians.filter((p) => !formData.departmentId || p.departmentId === formData.departmentId),
    [physicians, formData.departmentId],
  );

  const selectedPatient =
    preselectedPatient && preselectedPatient.id === formData.patientId
      ? preselectedPatient
      : patientResults.find((p) => p.id === formData.patientId);

  const selectedDepartment = departments.find((d) => d.id === formData.departmentId);
  const selectedDoctor = physicians.find((p) => p.id === formData.doctorId);

  const validateClientSide = (): boolean => {
    const result = createAppointmentSchema.safeParse(formData);
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

  const goToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    if (!validateClientSide()) return;
    setStep('review');
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await appointmentService.bookAppointment(formData);
      router.push('/appointments');
    } catch (err) {
      const apiError = err as Error & { statusCode?: number; code?: string };
      setError(apiError.message || 'An error occurred while booking the appointment.');
      setErrorCode(apiError.code ?? null);
      setStep('details');
      setLoading(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={['Operations', 'Appointments', 'Book']}
      requiredPermission="appointment:create"
    >
      <div className={styles.container}>
        <PageHeader
          title="Book appointment"
          description="Tokens are assigned automatically by the scheduling system when the booking is confirmed."
          meta={
            <ol className={styles.stepTrail} aria-label="Booking progress">
              <li className={step === 'details' ? styles.stepCurrent : styles.stepDone}>
                <span className={styles.stepIndex} aria-hidden="true">
                  {step === 'details' ? '1' : '✓'}
                </span>
                Details
              </li>
              <li aria-hidden="true" className={styles.stepDivider} />
              <li className={step === 'review' ? styles.stepCurrent : styles.stepPending}>
                <span className={styles.stepIndex} aria-hidden="true">
                  2
                </span>
                Review &amp; confirm
              </li>
            </ol>
          }
        />

        {error && (
          <AlertBanner
            severity={
              errorCode === 'SLOT_UNAVAILABLE'
                ? 'warning'
                : errorCode === 'INVALID_TRANSITION'
                  ? 'warning'
                  : 'critical'
            }
            title={
              errorCode === 'SLOT_UNAVAILABLE'
                ? 'That slot was just taken'
                : errorCode === 'INVALID_TRANSITION'
                  ? 'This action is no longer available'
                  : 'Booking failed'
            }
            dismissible
            onDismiss={() => setError(null)}
          >
            {errorCode === 'SLOT_UNAVAILABLE'
              ? 'Someone booked this slot moments ago. Choose another time — everything else is preserved.'
              : error}
          </AlertBanner>
        )}

        {optionsError && (
          <AlertBanner severity="warning" title="Scheduling setup unavailable">
            {optionsError}
          </AlertBanner>
        )}

        <Card elevation="xs">
          {optionsLoading ? (
            <CardContent>
              <Skeleton variant="rectangular" height={320} />
            </CardContent>
          ) : step === 'details' ? (
            <form onSubmit={goToReview} noValidate>
              <CardContent>
                <fieldset className={styles.section}>
                  <legend className={styles.sectionTitle}>1 · Patient</legend>

                  {selectedPatient ? (
                    <div className={styles.selectedPatient}>
                      <div>
                        <span className={styles.selectedName}>
                          {selectedPatient.firstName} {selectedPatient.lastName}
                        </span>
                        <span className={styles.selectedMeta}>
                          MRN {selectedPatient.mrn} · DOB {selectedPatient.dateOfBirth}
                        </span>
                      </div>
                      {!preselectedPatient && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, patientId: '' }));
                            setPreselectedPatient(null);
                          }}
                        >
                          Change
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div ref={pickerRef} className={styles.pickerWrap}>
                      <Input
                        id="patientSearch"
                        label="Find patient"
                        placeholder="Search by name or MRN…"
                        value={patientQuery}
                        onChange={(e) => {
                          setPatientQuery(e.target.value);
                          setPickerOpen(true);
                        }}
                        onFocus={() => setPickerOpen(true)}
                        iconLeft={<Search size={16} aria-hidden="true" />}
                        role="combobox"
                        aria-expanded={pickerOpen && (patientResults.length > 0 || searching)}
                        aria-controls="booking-patient-results"
                        aria-autocomplete="list"
                        required
                        error={fieldErrors.patientId ?? searchError ?? undefined}
                      />
                      {pickerOpen && (patientResults.length > 0 || searching) && (
                        <ul
                          id="booking-patient-results"
                          className={styles.searchResults}
                          role="listbox"
                          aria-label="Patient matches"
                        >
                          {searching && (
                            <li className={styles.searchResultStatic} role="status">
                              Searching…
                            </li>
                          )}
                          {!searching &&
                            patientResults.map((p) => (
                              <li key={p.id} role="option" aria-selected="false">
                                <button
                                  type="button"
                                  className={styles.searchResult}
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, patientId: p.id }));
                                    setPickerOpen(false);
                                  }}
                                >
                                  <span className={styles.resultName}>
                                    {p.firstName} {p.lastName}
                                  </span>
                                  <span className={styles.resultMeta}>
                                    MRN {p.mrn} · DOB {p.dateOfBirth}
                                  </span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}
                </fieldset>

                <fieldset className={styles.section}>
                  <legend className={styles.sectionTitle}>2 · Visit</legend>
                  <div className={styles.formGrid}>
                    <div>
                      <label htmlFor="departmentId" className={styles.label}>
                        Department<span aria-hidden="true"> *</span>
                      </label>
                      <select
                        id="departmentId"
                        name="departmentId"
                        className={`${styles.select} ${fieldErrors.departmentId ? styles.selectError : ''}`}
                        value={formData.departmentId}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            departmentId: e.target.value,
                            doctorId: '',
                          }))
                        }
                        required
                        aria-invalid={fieldErrors.departmentId ? true : undefined}
                      >
                        <option value="">Select department…</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.departmentId && (
                        <span className={styles.fieldError} role="alert">
                          {fieldErrors.departmentId}
                        </span>
                      )}
                    </div>

                    <div>
                      <label htmlFor="doctorId" className={styles.label}>
                        Physician<span aria-hidden="true"> *</span>
                      </label>
                      <select
                        id="doctorId"
                        name="doctorId"
                        className={`${styles.select} ${fieldErrors.doctorId ? styles.selectError : ''}`}
                        value={formData.doctorId}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, doctorId: e.target.value }))
                        }
                        required
                        disabled={!formData.departmentId && availablePhysicians.length === 0}
                        aria-invalid={fieldErrors.doctorId ? true : undefined}
                      >
                        <option value="">
                          {formData.departmentId
                            ? 'Select physician…'
                            : 'Select a department first'}
                        </option>
                        {availablePhysicians.map((p) => (
                          <option key={p.id} value={p.id}>
                            Dr. {p.firstName} {p.lastName}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.doctorId && (
                        <span className={styles.fieldError} role="alert">
                          {fieldErrors.doctorId}
                        </span>
                      )}
                    </div>

                    <Input
                      id="scheduledDate"
                      label="Date"
                      type="date"
                      name="scheduledDate"
                      min={today}
                      value={formData.scheduledDate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))
                      }
                      required
                      error={fieldErrors.scheduledDate}
                    />
                    <Input
                      id="scheduledTime"
                      label="Time"
                      type="time"
                      name="scheduledTime"
                      value={formData.scheduledTime}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, scheduledTime: e.target.value }))
                      }
                      required
                      helperText="Clinic hours are enforced by the scheduling system."
                      error={fieldErrors.scheduledTime}
                    />
                  </div>
                </fieldset>
              </CardContent>

              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" iconRight={<CalendarCheck size={16} />}>
                  Review booking
                </Button>
              </div>
            </form>
          ) : (
            <CardContent>
              <fieldset className={styles.section}>
                <legend className={styles.sectionTitle}>Review before confirming</legend>
                <dl className={styles.reviewList}>
                  <div className={styles.reviewRow}>
                    <dt>Patient</dt>
                    <dd>
                      {selectedPatient ? (
                        <>
                          {selectedPatient.firstName} {selectedPatient.lastName}
                          <span className={styles.reviewMeta}>MRN {selectedPatient.mrn}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div className={styles.reviewRow}>
                    <dt>Department</dt>
                    <dd>{selectedDepartment?.name ?? '—'}</dd>
                  </div>
                  <div className={styles.reviewRow}>
                    <dt>Physician</dt>
                    <dd>
                      {selectedDoctor
                        ? `Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}`
                        : '—'}
                    </dd>
                  </div>
                  <div className={styles.reviewRow}>
                    <dt>Date</dt>
                    <dd>{formData.scheduledDate}</dd>
                  </div>
                  <div className={styles.reviewRow}>
                    <dt>Time</dt>
                    <dd>{formData.scheduledTime}</dd>
                  </div>
                </dl>
                <p className={styles.reviewNote}>
                  The token number is assigned by the system at confirmation.
                </p>
              </fieldset>

              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="outline"
                  iconLeft={<ChevronLeft size={16} />}
                  onClick={() => setStep('details')}
                  disabled={loading}
                >
                  Back to edit
                </Button>
                <Button variant="primary" isLoading={loading} onClick={() => void handleConfirm()}>
                  Confirm booking
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <p className={styles.hintRow}>
          <AlertCircle size={14} aria-hidden="true" />
          If a slot is taken while you book, you&apos;ll be able to pick another time without losing
          the rest of the form.
        </p>
      </div>
    </AppShell>
  );
}
