import React from 'react';
import styles from './Identity.module.css';

export interface PatientIdentityProps {
  firstName?: string;
  lastName?: string;
  mrn: string;
  dateOfBirth?: string;
  gender?: string;
  /** Renders compactly for dense table rows. */
  compact?: boolean;
}

export interface StaffIdentityProps {
  displayName: string;
  role?: string;
  compact?: boolean;
}

function computeAge(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(0, Math.min(130, age));
}

const GENDER_LETTER: Record<string, string> = {
  male: 'M',
  female: 'F',
  other: 'O',
};

/**
 * M13 — Canonical patient identity presentation.
 * Name dominates; MRN is the verifiable identifier; demographics are secondary.
 */
export function PatientIdentity({
  firstName,
  lastName,
  mrn,
  dateOfBirth,
  gender,
  compact = false,
}: PatientIdentityProps) {
  const name = firstName && lastName ? `${firstName} ${lastName}` : 'Unknown patient';
  const age = typeof dateOfBirth === 'string' ? computeAge(dateOfBirth) : null;
  const demoParts: string[] = [];
  if (age !== null) demoParts.push(`${age}y`);
  if (gender && GENDER_LETTER[gender]) demoParts.push(GENDER_LETTER[gender]);

  return (
    <div className={compact ? styles.patientCompact : styles.patient}>
      <span className={styles.patientName}>{name}</span>
      <span className={styles.patientMeta}>
        <span className={styles.mrn}>{mrn}</span>
        {demoParts.length > 0 && (
          <>
            <span className={styles.dot} aria-hidden="true" />
            <span>{demoParts.join(' ')}</span>
          </>
        )}
      </span>
    </div>
  );
}

/** Canonical staff identity line (resolved via the M12.2 identity projection). */
export function StaffIdentity({ displayName, role, compact = false }: StaffIdentityProps) {
  return (
    <span className={compact ? styles.staffCompact : styles.staff}>
      <span className={styles.staffName}>{displayName}</span>
      {role && role !== 'unknown' && <span className={styles.staffRole}>{role}</span>}
    </span>
  );
}
