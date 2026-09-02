'use client';

import { useCallback, useEffect, useState } from 'react';
import { patientService } from '../services/patient-service';
import type { PatientResponse } from 'shared';

export interface UsePatientResult {
  /** Resolved patient, or null while loading / on error / when no id is given. */
  patient: PatientResponse | null;
  loading: boolean;
  /** Human-readable failure reason; null while loading or when resolved. */
  error: string | null;
  /** Re-run the lookup (e.g. from a retry control). */
  reload: () => void;
}

/**
 * M17 — Resolve a single patient by id for context headers on clinical
 * workspaces that hold only a `patientId` (diagnostics order/result surfaces,
 * documentation forms). Uses the existing `patient:read`-authorized endpoint;
 * it never invents demographics when the lookup fails.
 */
export function usePatient(patientId: string | null | undefined): UsePatientResult {
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    patientService
      .getPatientById(patientId)
      .then((res) => {
        if (!cancelled) setPatient(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setPatient(null);
          setError('Could not load patient details.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, retryTick]);

  const reload = useCallback(() => setRetryTick((tick) => tick + 1), []);

  return { patient, loading, error, reload };
}
