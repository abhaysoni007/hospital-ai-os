import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import styles from './BreakGlassBanner.module.css';

interface BreakGlassBannerProps {
  patientId: string;
}

export function BreakGlassBanner({ patientId }: BreakGlassBannerProps) {
  const [isActive, setIsActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    // Check local storage for active session on this patient
    const activeSessions = JSON.parse(sessionStorage.getItem('breakGlassActive') || '{}');
    const expiry = activeSessions[patientId];
    if (expiry && expiry > Date.now()) {
      setIsActive(true);
      setExpiresAt(expiry);
    }
  }, [patientId]);

  if (!isActive) return null;

  return (
    <div className={styles.banner} role="alert">
      <ShieldAlert size={18} className={styles.icon} />
      <div className={styles.content}>
        <strong>BREAK-GLASS ACTIVE</strong> — You are accessing this record under temporary emergency authorization.
        {expiresAt && (
          <span className={styles.expiry}>
            {' '}Access expires at {new Date(expiresAt).toLocaleTimeString()}.
          </span>
        )}
      </div>
    </div>
  );
}
