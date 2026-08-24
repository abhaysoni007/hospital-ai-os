'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Card } from '../../../components/ui/Card/Card';
import { patientService } from '../../../services/patient-service';
import styles from './new-patient.module.css';

export default function NewPatientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    phonePrimary: '',
    phoneEmergency: '',
    emergencyContactName: '',
    addressLine1: '',
    addressCity: '',
    addressState: '',
    addressPostalCode: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await patientService.registerPatient({
        ...formData,
        gender: formData.gender as "male" | "female" | "other" | "undisclosed",
      });
      router.push(`/patients/${response.data.id}`);
    } catch (err) {
      console.error(err);
      const error = err as Error;
      setError(error.message || 'An error occurred during registration.');
      setLoading(false);
    }
  };

  return (
    <AppShell breadcrumbs={['Operations', 'Patients', 'Register']} requiredPermission="patient:create">
      <div className={styles.container}>
        <h1 className={styles.title}>Register New Patient</h1>
        
        <Card>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <h2 className={styles.sectionTitle}>Basic Information</h2>
              
              <Input
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
              <Input
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
              <Input
                label="Date of Birth"
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                required
              />
              
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-slate-700)', marginBottom: '4px' }}>
                  Gender
                </label>
                <select 
                  className={styles.select} 
                  name="gender" 
                  value={formData.gender}
                  onChange={handleChange}
                  required
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="undisclosed">Undisclosed</option>
                </select>
              </div>

              <h2 className={styles.sectionTitle} style={{ marginTop: '16px' }}>Contact Details</h2>

              <Input
                label="Primary Phone"
                name="phonePrimary"
                value={formData.phonePrimary}
                onChange={handleChange}
                required
              />
              <div className={styles.fullWidth}>
                <Input
                  label="Address Line 1"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                />
              </div>
              <Input
                label="City"
                name="addressCity"
                value={formData.addressCity}
                onChange={handleChange}
              />
              <Input
                label="State"
                name="addressState"
                value={formData.addressState}
                onChange={handleChange}
              />
              <Input
                label="Postal Code"
                name="addressPostalCode"
                value={formData.addressPostalCode}
                onChange={handleChange}
              />

              <h2 className={styles.sectionTitle} style={{ marginTop: '16px' }}>Emergency Contact</h2>

              <Input
                label="Contact Name"
                name="emergencyContactName"
                value={formData.emergencyContactName}
                onChange={handleChange}
              />
              <Input
                label="Emergency Phone"
                name="phoneEmergency"
                value={formData.phoneEmergency}
                onChange={handleChange}
              />
            </div>

            {error && (
              <div style={{ color: 'var(--color-critical-600)', fontSize: 'var(--font-size-sm)', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <div className={styles.actions}>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Registering...' : 'Register Patient'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
