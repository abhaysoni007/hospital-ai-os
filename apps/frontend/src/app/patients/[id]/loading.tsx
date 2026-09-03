import React from 'react';
import { Skeleton } from '../../../components/ui';
import styles from './profile.module.css';

export default function PatientDetailLoading() {
  return (
    <div className={styles.container} role="status" aria-label="Loading patient details">
      <div className={styles.profileHeader}>
        <Skeleton variant="circular" width={64} height={64} />
        <div className={styles.profileHeaderText}>
          <Skeleton variant="text" width={240} height={28} />
          <Skeleton variant="text" width={160} height={16} />
        </div>
      </div>
      <div className={styles.sectionsGrid}>
        <Skeleton variant="card" height={220} />
        <Skeleton variant="card" height={220} />
        <Skeleton variant="card" height={220} />
        <Skeleton variant="card" height={220} />
      </div>
    </div>
  );
}
