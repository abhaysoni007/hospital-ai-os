import React from 'react';
import { UserRound, AlertCircle } from 'lucide-react';
import { PatientIdentity } from '../../ui/Identity/Identity';
import { EncounterStatusBadge } from '../../ui/SemanticBadges/SemanticBadges';
import { Skeleton } from '../../ui/Skeleton/Skeleton';
import { Button } from '../../ui/Button/Button';
import styles from './PatientContextHeader.module.css';

export interface PatientContextEncounter {
  /** Raw backend encounter type (e.g. `opd_visit`) — rendered humanized. */
  type: string;
  status: string;
  startedAt?: string | null;
}

export interface PatientContextHeaderProps {
  /** Resolved patient demographics; null while loading or on failure. */
  patient: {
    firstName?: string;
    lastName?: string;
    mrn: string;
    dateOfBirth?: string;
    gender?: string;
  } | null;
  loading?: boolean;
  /** Lookup failure reason; renders a quiet recovery note with retry. */
  error?: string | null;
  onRetry?: () => void;
  /** Optional encounter context rendered beside the identity. */
  encounter?: PatientContextEncounter | null;
  /** When set, renders a quiet "Open patient" affordance. */
  patientHref?: string;
}

function formatStartedAt(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * M17 — Persistent patient/encounter identity band for clinical workspaces.
 *
 * Answers "whose chart am I in" at a glance on task-focused surfaces
 * (documentation forms, diagnostic order/result screens) that otherwise show
 * only the task itself. Renders `—`-free honest states: skeleton while
 * resolving, a quiet recovery note when the lookup fails, and nothing when no
 * id is available. Never animates and never fabricates demographics.
 */
export function PatientContextHeader({
  patient,
  loading = false,
  error = null,
  onRetry,
  encounter = null,
  patientHref,
}: PatientContextHeaderProps) {
  if (loading) {
    return (
      <div className={styles.band} aria-busy="true" aria-label="Loading patient context">
        <Skeleton variant="rectangular" height={40} />
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className={styles.band}>
        <p className={styles.errorNote}>
          <AlertCircle size={14} aria-hidden="true" /> {error}
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </p>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <section className={styles.band} aria-label="Patient context">
      <span className={styles.avatar} aria-hidden="true">
        <UserRound size={18} />
      </span>
      <div className={styles.identity}>
        <PatientIdentity
          firstName={patient.firstName}
          lastName={patient.lastName}
          mrn={patient.mrn}
          dateOfBirth={patient.dateOfBirth}
          gender={patient.gender}
        />
      </div>
      {encounter && (
        <div className={styles.encounter}>
          <span className={styles.encounterType}>{encounter.type.replace(/_/g, ' ')}</span>
          <EncounterStatusBadge status={encounter.status} size="sm" />
          {encounter.startedAt && (
            <span className={styles.encounterMeta}>{formatStartedAt(encounter.startedAt)}</span>
          )}
        </div>
      )}
      {patientHref && (
        <a className={styles.link} href={patientHref}>
          Open patient
        </a>
      )}
    </section>
  );
}
