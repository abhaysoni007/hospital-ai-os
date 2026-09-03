import React from 'react';
import { Skeleton } from '../../../components/ui';
import styles from './order-detail.module.css';

export default function DiagnosticOrderDetailLoading() {
  return (
    <div className={styles.container} role="status" aria-label="Loading diagnostic order">
      <div style={{ marginBottom: '24px' }}>
        <Skeleton variant="text" width={240} height={32} />
        <div style={{ marginTop: '8px' }}>
          <Skeleton variant="text" width={320} height={16} />
        </div>
      </div>
      <Skeleton variant="rectangular" height={280} />
    </div>
  );
}
