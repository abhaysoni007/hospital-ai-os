'use client';

/**
 * M16B — Shell-level break-glass status indicator.
 *
 * Surfaces active break-glass sessions to the clinician without relying on
 * a per-page banner. Reads the same `breakGlassActive` sessionStorage key
 * that `BreakGlassBanner` writes, polls for the duration of the session,
 * and renders a quiet pill in the AppHeader right section.
 *
 * Visibility rules:
 *   - Hidden when no active sessions exist (the common case).
 *   - Visible as a single aggregate pill when 1+ session is active.
 *   - For clinicians without `break_glass:review`, the pill is a status
 *     badge only (no navigation; they cannot reach the security console).
 *   - For security admins, the pill links to `/admin/security` so they
 *     can review the session.
 *
 * Important: This is a UX surface, NOT an authorization mechanism. The
 * server (M5/M15) is the authoritative boundary; this component only
 * mirrors state the server already produced.
 *
 * No fake data: if `sessionStorage.breakGlassActive` is empty, the
 * component renders nothing.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';
import styles from './BreakGlassStatusIndicator.module.css';

const STORAGE_KEY = 'breakGlassActive';

interface ActiveSession {
  patientId: string;
  expiresAt: number;
}

function readActiveSessions(): ActiveSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    return Object.entries(parsed)
      .filter(([, expiry]) => typeof expiry === 'number' && expiry > now)
      .map(([patientId, expiresAt]) => ({ patientId, expiresAt }));
  } catch {
    /* corrupt entry — treat as no active session */
    return [];
  }
}

export function BreakGlassStatusIndicator() {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveSession[]>([]);

  // Poll once a minute; the expiry granularity is 4 hours, so minute-level
  // freshness is sufficient and avoids unnecessary re-renders.
  useEffect(() => {
    setActive(readActiveSessions());
    const id = window.setInterval(() => setActive(readActiveSessions()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (active.length === 0) return null;

  const canReview = hasPermission(user?.role, 'break_glass:review');
  const label =
    active.length === 1
      ? 'Emergency access active'
      : `${active.length} emergency sessions active`;

  const className = `${styles.indicator} ${canReview ? styles.indicatorLink : ''}`;

  const content = (
    <>
      <ShieldAlert size={14} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </>
  );

  return (
    <span className={styles.wrapper} aria-live="polite">
      {canReview ? (
        <Link href="/admin/security" className={className}>
          {content}
        </Link>
      ) : (
        <span className={className} role="status">
          {content}
        </span>
      )}
    </span>
  );
}