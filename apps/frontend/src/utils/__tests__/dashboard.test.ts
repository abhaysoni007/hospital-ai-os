import { describe, expect, it } from 'vitest';
import type { AppointmentListItem } from 'shared';

import {
  appointmentStatusLabel,
  bucketEncountersByDay,
  computeAgeYears,
  computeAvgEncounterMinutes,
  computeDayOverDayDelta,
  computeEncounterStatusDistribution,
  formatDurationMinutes,
  mapAppointmentRows,
  todayIsoDate,
  weekdayShortLabel,
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

describe('M16B dashboard analytics helpers (real data only)', () => {
  it('bucketEncountersByDay returns zero-filled days, oldest first', () => {
    // Anchor at a fixed timestamp so the test is timezone-stable.
    const now = new Date('2026-09-02T10:00:00.000Z');
    const result = bucketEncountersByDay(
      [
        { createdAt: '2026-09-02T09:00:00.000Z' },
        { createdAt: '2026-09-02T08:00:00.000Z' },
        { createdAt: '2026-09-01T12:00:00.000Z' },
        { createdAt: '2026-08-30T12:00:00.000Z' },
        { createdAt: 'not-a-date' }, // must be ignored, not crash
      ],
      7,
      now,
    );
    expect(result).toHaveLength(7);
    // Oldest first, today last.
    expect(result[0].date).toBe('2026-08-27');
    expect(result[6].date).toBe('2026-09-02');
    expect(result[6].count).toBe(2);
    expect(result[5].count).toBe(1);
    expect(result[3].count).toBe(1);
    expect(result[2].count).toBe(0); // gap day
    expect(result[0].count).toBe(0);
  });

  it('bucketEncountersByDay handles empty array', () => {
    const now = new Date('2026-09-02T10:00:00.000Z');
    const result = bucketEncountersByDay([], 7, now);
    expect(result).toHaveLength(7);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });

  it('computeEncounterStatusDistribution is sorted by descending count', () => {
    const result = computeEncounterStatusDistribution([
      { status: 'completed' },
      { status: 'completed' },
      { status: 'active' },
      { status: 'active' },
      { status: 'active' },
      { status: 'cancelled' },
    ]);
    expect(result).toEqual([
      { status: 'active', count: 3 },
      { status: 'completed', count: 2 },
      { status: 'cancelled', count: 1 },
    ]);
  });

  it('computeAvgEncounterMinutes returns null when no active encounters', () => {
    expect(computeAvgEncounterMinutes([], new Date())).toBeNull();
    expect(computeAvgEncounterMinutes([{ startedAt: null }], new Date())).toBeNull();
    expect(
      computeAvgEncounterMinutes([{ startedAt: 'not-a-date' }], new Date()),
    ).toBeNull();
  });

  it('computeAvgEncounterMinutes averages valid startedAt timestamps', () => {
    const now = new Date('2026-09-02T10:00:00.000Z');
    const avg = computeAvgEncounterMinutes(
      [
        { startedAt: '2026-09-02T09:30:00.000Z' }, // 30 min
        { startedAt: '2026-09-02T09:00:00.000Z' }, // 60 min
        { startedAt: null }, // ignored
      ],
      now,
    );
    expect(avg).not.toBeNull();
    expect(avg!).toBeCloseTo(45, 1);
  });

  it('computeDayOverDayDelta returns null when either bucket missing', () => {
    expect(computeDayOverDayDelta([])).toBeNull();
    expect(computeDayOverDayDelta([{ date: '2026-09-01', count: 5 }])).toBeNull();
  });

  it('computeDayOverDayDelta computes correct direction and percent', () => {
    const result = computeDayOverDayDelta([
      { date: '2026-09-01', count: 10 },
      { date: '2026-09-02', count: 12 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('up');
    expect(result!.percent).toBe(20);

    const down = computeDayOverDayDelta([
      { date: '2026-09-01', count: 20 },
      { date: '2026-09-02', count: 16 },
    ]);
    expect(down!.direction).toBe('down');
    expect(down!.percent).toBe(20);

    const flat = computeDayOverDayDelta([
      { date: '2026-09-01', count: 10 },
      { date: '2026-09-02', count: 10 },
    ]);
    expect(flat!.direction).toBe('flat');
    expect(flat!.percent).toBe(0);
  });

  it('formatDurationMinutes formats minutes and hours', () => {
    expect(formatDurationMinutes(28)).toBe('28m');
    expect(formatDurationMinutes(60)).toBe('1h');
    expect(formatDurationMinutes(90)).toBe('1h 30m');
    expect(formatDurationMinutes(0)).toBe('0m');
    expect(formatDurationMinutes(NaN)).toBe('—');
    expect(formatDurationMinutes(-5)).toBe('—');
  });

  it('weekdayShortLabel returns a short weekday name for ISO dates', () => {
    // 2026-09-02 is a Wednesday.
    expect(weekdayShortLabel('2026-09-02')).toMatch(/Wed/);
    expect(weekdayShortLabel('not-a-date')).toBe('not-a-date');
  });
});
