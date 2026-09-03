import React from 'react';
import { Skeleton, TableSkeleton } from '../../components/ui';
import styles from './patients.module.css';

export default function PatientsLoading() {
  return (
    <div className={styles.container} role="status" aria-label="Loading patients">
      <div style={{ marginBottom: '24px' }}>
        <Skeleton variant="text" width={220} height={32} />
        <div style={{ marginTop: '8px' }}>
          <Skeleton variant="text" width={340} height={16} />
        </div>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <Skeleton variant="rectangular" height={42} />
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}
