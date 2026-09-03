import React from 'react';
import { Skeleton, TableSkeleton } from '../../components/ui';
import styles from './diagnostics.module.css';

export default function DiagnosticsLoading() {
  return (
    <div className={styles.container} role="status" aria-label="Loading diagnostic queue">
      <div style={{ marginBottom: '24px' }}>
        <Skeleton variant="text" width={200} height={32} />
        <div style={{ marginTop: '8px' }}>
          <Skeleton variant="text" width={380} height={16} />
        </div>
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}
