import type { AppointmentListItem } from 'shared';

/**
 * M12.2 Part B + M16B analytics — pure mapping helpers for the REAL
 * dashboard. No fabricated data lives here; these only shape backend
 * responses for rendering and are unit-tested.
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

// ----------------------------------------------------------------------------
// M16B analytics helpers — all pure, no side effects, no fabricated data.
// ----------------------------------------------------------------------------

/** A single point in the encounter volume time series. */
export interface EncounterBucket {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Number of encounters whose `createdAt` falls on this date. */
  count: number;
}

/**
 * Bucket encounters by calendar day for the last `days` days, oldest first.
 * Uses the encounter's `createdAt` field. Days with no encounters are
 * represented as zero so the chart axis is contiguous.
 */
export function bucketEncountersByDay(
  encounters: ReadonlyArray<{ createdAt: string }>,
  days: number,
  now: Date = new Date(),
): EncounterBucket[] {
  const safeDays = Math.max(1, Math.floor(days));
  const today = startOfDay(now);
  const buckets: EncounterBucket[] = [];
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.push({ date: toIsoDate(d), count: 0 });
  }
  const byDate = new Map(buckets.map((b) => [b.date, b]));
  for (const enc of encounters) {
    const ts = new Date(enc.createdAt);
    if (Number.isNaN(ts.getTime())) continue;
    const key = toIsoDate(startOfDay(ts));
    const bucket = byDate.get(key);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

/**
 * Compute the distribution of encounter statuses, sorted by descending
 * count. Statuses not present in the input are omitted so the donut never
 * renders a phantom slice.
 */
export function computeEncounterStatusDistribution(
  encounters: ReadonlyArray<{ status: string }>,
): Array<{ status: string; count: number }> {
  const counts = new Map<string, number>();
  for (const enc of encounters) {
    counts.set(enc.status, (counts.get(enc.status) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Mean active-encounter age in minutes. Returns null when there are no
 * active encounters with a parseable `startedAt`. The caller decides how
 * to surface "null" (a dash with a hint, a "n/a" label, etc.) — never
 * substitute a fabricated value.
 */
export function computeAvgEncounterMinutes(
  activeEncounters: ReadonlyArray<{ startedAt: string | null | undefined }>,
  now: Date = new Date(),
): number | null {
  let sum = 0;
  let n = 0;
  for (const enc of activeEncounters) {
    if (!enc.startedAt) continue;
    const t = new Date(enc.startedAt);
    if (Number.isNaN(t.getTime())) continue;
    const minutes = (now.getTime() - t.getTime()) / 60000;
    if (minutes < 0) continue;
    sum += minutes;
    n += 1;
  }
  if (n === 0) return null;
  return Math.round((sum / n) * 10) / 10;
}

/**
 * Day-over-day delta from the last two buckets. Returns null when either
 * bucket is missing (data hasn't fully accumulated) — the dashboard then
 * hides its delta chip rather than fabricating a percentage.
 */
export function computeDayOverDayDelta(
  series: ReadonlyArray<{ date: string; count: number }>,
):
  | { direction: 'up' | 'down' | 'flat'; percent: number; yesterdayCount: number; todayCount: number }
  | null {
  if (series.length < 2) return null;
  const yesterday = series[series.length - 2];
  const today = series[series.length - 1];
  if (!yesterday || !today) return null;
  const y = yesterday.count;
  const t = today.count;
  if (y === 0 && t === 0) return null;
  if (y === 0) {
    // Infinite growth — surface as a flat "—" rather than a misleading infinity.
    return { direction: 'flat', percent: 0, yesterdayCount: y, todayCount: t };
  }
  const delta = ((t - y) / y) * 100;
  const direction = delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';
  return {
    direction,
    percent: Math.abs(Math.round(delta)),
    yesterdayCount: y,
    todayCount: t,
  };
}

/** Short weekday label (Mon, Tue, …) for chart X-axis ticks. */
export function weekdayShortLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
}

/** Pretty-print minutes as `Hh Mm`, e.g. 28.0 → "28m", 90 → "1h 30m". */
export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ----------------------------------------------------------------------------
// Internal date helpers (kept private to this module).
// ----------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}