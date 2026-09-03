import React from 'react';
import { Skeleton, TableSkeleton } from '../../components/ui';
import styles from './tasks.module.css';

export default function TasksLoading() {
  return (
    <div className={styles.container} role="status" aria-label="Loading tasks">
      <div style={{ marginBottom: '24px' }}>
        <Skeleton variant="text" width={180} height={32} />
        <div style={{ marginTop: '8px' }}>
          <Skeleton variant="text" width={300} height={16} />
        </div>
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}
