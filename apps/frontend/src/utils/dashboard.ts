import type { AppointmentListItem } from 'shared';

/**
 * M12.2 Part B — pure mapping helpers for the REAL dashboard.
 * No fabricated data lives here; these only shape backend responses for
 * rendering and are unit-tested.
 */

export interface QueueRow {
  id: string;
  token: number | null;
  patientName: string;
  mrn: string;
  ageGender: string;
  time: string;
  status: string;
}

export function computeAgeYears(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(0, Math.min(130, age));
}

export function mapAppointmentRows(rows: AppointmentListItem[]): QueueRow[] {
  return rows.map((r) => {
    const p = r.patient as
      | {
          id: string;
          mrn: string;
          firstName: string;
          lastName: string;
          dateOfBirth?: string;
          gender?: string;
        }
      | undefined;
    const age = p && typeof p.dateOfBirth === 'string' ? computeAgeYears(p.dateOfBirth) : null;
    const genderLetter =
      p?.gender === 'female' ? 'F' : p?.gender === 'male' ? 'M' : p?.gender === 'other' ? 'O' : '';
    return {
      id: r.id,
      token: r.tokenNumber,
      patientName: p?.firstName && p?.lastName ? `${p.firstName} ${p.lastName}` : 'Unknown patient',
      mrn: p?.mrn ?? '',
      ageGender: age !== null ? `${age}${genderLetter}` : '—',
      time: r.scheduledTime.slice(0, 5),
      status: r.status,
    };
  });
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function appointmentStatusLabel(status: string): string {
  switch (status) {
    case 'booked':
      return 'Waiting';
    case 'checked_in':
      return 'Checked in';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}
