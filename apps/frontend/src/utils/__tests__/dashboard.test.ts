import { describe, expect, it } from 'vitest';
import type { AppointmentListItem } from 'shared';

import {
  appointmentStatusLabel,
  computeAgeYears,
  mapAppointmentRows,
  todayIsoDate,
} from '../dashboard';

/**
 * M12.2 Part B — dashboard mapping helpers (pure logic over REAL API shapes).
 */

function appointment(overrides: Partial<AppointmentListItem>): AppointmentListItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    patientId: '22222222-2222-4222-8222-222222222222',
    doctorId: '33333333-3333-4333-8333-333333333333',
    departmentId: '44444444-4444-4444-8444-444444444444',
    scheduledDate: '2030-01-01',
    scheduledTime: '09:05:00',
    tokenNumber: 7,
    status: 'booked',
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-01T00:00:00.000Z',
    patient: {
      id: '22222222-2222-4222-8222-222222222222',
      mrn: 'MRN-2030-00001',
      firstName: 'Rohan',
      lastName: 'Sharma',
      dateOfBirth: '1990-06-15',
      gender: 'male',
    },
    doctor: { id: '33333333-3333-4333-8333-333333333333', firstName: 'A', lastName: 'B' },
    ...overrides,
  } as AppointmentListItem;
}

describe('dashboard mapping helpers (real backend shapes)', () => {
  it('maps appointments to queue rows with derived age/gender and HH:MM time', () => {
    const rows = mapAppointmentRows([appointment({})]);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.patientName).toBe('Rohan Sharma');
    expect(row.mrn).toBe('MRN-2030-00001');
    expect(row.token).toBe(7);
    expect(row.time).toBe('09:05');
    expect(row.ageGender).toMatch(/^\d{1,3}M$/);
  });

  it('handles missing patient gracefully without fabricating identity', () => {
    const row = mapAppointmentRows([
      appointment({
        patient: undefined,
        tokenNumber: null,
      } as unknown as Partial<AppointmentListItem>),
    ])[0];
    expect(row.patientName).toBe('Unknown patient');
    expect(row.mrn).toBe('');
    expect(row.ageGender).toBe('—');
  });

  it('computeAgeYears is UTC-correct', () => {
    // Someone born 2000-01-01 is >20 years old in 2026 regardless of TZ.
    expect(computeAgeYears('2000-01-01')).toBeGreaterThanOrEqual(26);
    expect(computeAgeYears('not-a-date')).toBeNull();
  });

  it('status labels are human-readable and deterministic', () => {
    expect(appointmentStatusLabel('booked')).toBe('Waiting');
    expect(appointmentStatusLabel('checked_in')).toBe('Checked in');
    expect(appointmentStatusLabel('completed')).toBe('Completed');
    expect(appointmentStatusLabel('cancelled')).toBe('Cancelled');
    expect(appointmentStatusLabel('mystery')).toBe('mystery'); // never invents
  });

  it('todayIsoDate returns YYYY-MM-DD', () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
