import React, { useEffect, useState } from 'react';
import { DiagnosticTrendResponse } from 'shared';
import { intelligenceService } from '../../services/intelligence.service';
import { LineChart } from 'lucide-react';

import { ErrorState } from '../ui/ErrorState/ErrorState';
import styles from './intelligence.module.css';

export const DiagnosticTrend: React.FC<{ patientId: string; testCode: string }> = ({
  patientId,
  testCode,
}) => {
  const [trend, setTrend] = useState<DiagnosticTrendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    intelligenceService
      .getDiagnosticTrend(patientId, testCode)
      .then(setTrend)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load trend'));
  }, [patientId, testCode]);

  if (error) {
    return (
      <div className={styles.trendCard}>
        <ErrorState title={`Cannot load trend for ${testCode}`} message={error} />
      </div>
    );
  }

  if (!trend || trend.points.length === 0) return null;

  return (
    <div className={styles.trendCard}>
      <p className={styles.trendTitle}>
        <LineChart size={14} aria-hidden="true" />
        Historical trend ({testCode})
      </p>
      <ul className={styles.trendRow}>
        {trend.points.map((pt) => (
          <li
            key={pt.resultId}
            className={`${styles.trendPoint} ${
              pt.isCritical ? styles.trendCritical : pt.isAbnormal ? styles.trendAbnormal : ''
            }`}
          >
            <span className={styles.trendDate}>{new Date(pt.occurredAt).toLocaleDateString()}</span>
            <span className={styles.trendValue}>
              {pt.valueNumber} {pt.unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
