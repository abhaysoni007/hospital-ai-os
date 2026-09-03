import React from 'react';
import { Skeleton, TableSkeleton } from '../../components/ui';
import styles from './encounters.module.css';

export default function EncountersLoading() {
  return (
    <div className={styles.container} role="status" aria-label="Loading encounters">
      <div style={{ marginBottom: '24px' }}>
        <Skeleton variant="text" width={200} height={32} />
        <div style={{ marginTop: '8px' }}>
          <Skeleton variant="text" width={320} height={16} />
        </div>
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}
