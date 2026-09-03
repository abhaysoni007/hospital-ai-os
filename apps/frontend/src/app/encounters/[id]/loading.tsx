import React from 'react';
import { Skeleton } from '../../../components/ui';
import styles from './encounter-detail.module.css';

export default function EncounterDetailLoading() {
  return (
    <div className={styles.container} role="status" aria-label="Loading encounter workspace">
      <div style={{ marginBottom: '24px' }}>
        <Skeleton variant="text" width={260} height={32} />
        <div style={{ marginTop: '8px' }}>
          <Skeleton variant="text" width={380} height={16} />
        </div>
      </div>
      <Skeleton variant="rectangular" height={280} />
    </div>
  );
}
