'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Card, CardContent } from '../../../components/ui/Card/Card';
import { PageHeader } from '../../../components/ui/PageHeader/PageHeader';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { patientService } from '../../../services/patient-service';
import { registerPatientSchema } from 'shared';
import { parseApiError } from '../../../utils/error-parser';
import styles from './new-patient.module.css';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'undisclosed',
  phonePrimary: '',
  phoneEmergency: '',
  emergencyContactName: '',
  addressLine1: '',
  addressCity: '',
  addressState: '',
  addressPostalCode: '',
};

/**
 * M13 — Patient registration. Client-side validation mirrors the frozen
 * shared contract (registerPatientSchema); server errors are surfaced
 * verbatim through the standard alert channel — never raw dumps.
 */
export default function NewPatientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState(EMPTY_FORM);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validateClientSide = (): boolean => {
    const result = registerPatientSchema.safeParse(formData);
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
    if (!validateClientSide()) return;

    setLoading(true);
    try {
      const response = await patientService.registerPatient({
        ...formData,
        gender: formData.gender as 'male' | 'female' | 'other' | 'undisclosed',
        phoneEmergency: formData.phoneEmergency || undefined,
        emergencyContactName: formData.emergencyContactName || undefined,
        addressLine1: formData.addressLine1 || undefined,
        addressCity: formData.addressCity || undefined,
        addressState: formData.addressState || undefined,
        addressPostalCode: formData.addressPostalCode || undefined,
      });
      router.push(`/patients/${response.data.id}`);
    } catch (err) {
      const parsed = parseApiError(err);
      setError(
        parsed.requestId
          ? `${parsed.message} (Incident ID: ${parsed.requestId})`
          : parsed.message,
      );
      if (Object.keys(parsed.fieldErrors).length > 0) {
        setFieldErrors(parsed.fieldErrors);
      }
      setLoading(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={['Operations', 'Patients', 'Register']}
      requiredPermission="patient:create"
    >
      <div className={styles.container}>
        <PageHeader
          title="Register patient"
          description="Create a medical record with a system-assigned MRN. Identity documents can be verified after registration."
        />

        {error && (
          <AlertBanner
            severity="critical"
            title="Could not register patient"
            dismissible
            onDismiss={() => setError(null)}
          >
            {error}
          </AlertBanner>
        )}

        <Card elevation="xs">
          <form onSubmit={handleSubmit} noValidate>
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>Identity</legend>
              <div className={styles.formGrid}>
                <Input
                  id="firstName"
                  label="First name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  error={fieldErrors.firstName}
                />
                <Input
                  id="lastName"
                  label="Last name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  error={fieldErrors.lastName}
                />
                <Input
                  id="dateOfBirth"
                  label="Date of birth"
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  required
                  error={fieldErrors.dateOfBirth}
                />
                <div>
                  <label htmlFor="gender" className={styles.label}>
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    className={styles.select}
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    aria-invalid={fieldErrors.gender ? true : undefined}
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                    <option value="undisclosed">Undisclosed</option>
                  </select>
                  {fieldErrors.gender && (
                    <span className={styles.fieldError} role="alert">
                      {fieldErrors.gender}
                    </span>
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>Contact</legend>
              <div className={styles.formGrid}>
                <Input
                  id="phonePrimary"
                  label="Primary phone"
                  name="phonePrimary"
                  type="tel"
                  value={formData.phonePrimary}
                  onChange={handleChange}
                  required
                  helperText="5–20 digits; used for appointment reminders."
                  error={fieldErrors.phonePrimary}
                />
                <Input
                  id="addressLine1"
                  label="Address line"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  error={fieldErrors.addressLine1}
                />
                <Input
                  id="addressCity"
                  label="City"
                  name="addressCity"
                  value={formData.addressCity}
                  onChange={handleChange}
                  error={fieldErrors.addressCity}
                />
                <Input
                  id="addressState"
                  label="State"
                  name="addressState"
                  value={formData.addressState}
                  onChange={handleChange}
                  error={fieldErrors.addressState}
                />
                <Input
                  id="addressPostalCode"
                  label="Postal code"
                  name="addressPostalCode"
                  value={formData.addressPostalCode}
                  onChange={handleChange}
                  error={fieldErrors.addressPostalCode}
                />
              </div>
            </fieldset>

            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>Emergency contact</legend>
              <div className={styles.formGrid}>
                <Input
                  id="emergencyContactName"
                  label="Contact name"
                  name="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={handleChange}
                  error={fieldErrors.emergencyContactName}
                />
                <Input
                  id="phoneEmergency"
                  label="Emergency phone"
                  name="phoneEmergency"
                  type="tel"
                  value={formData.phoneEmergency}
                  onChange={handleChange}
                  error={fieldErrors.phoneEmergency}
                />
              </div>
            </fieldset>

            <CardContent className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={loading}>
                Register patient
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
