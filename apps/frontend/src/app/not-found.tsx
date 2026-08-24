'use client';

import React from 'react';
import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button/Button';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconCircle}>
          <FileQuestion size={40} className={styles.icon} />
        </div>
        <span className={styles.badge}>404 — Not Found</span>
        <h1 className={styles.title}>Resource Not Found</h1>
        <p className={styles.description}>
          The clinical record, workspace module, or page you requested could not be located. Please
          check the URL or return to the Mission Control dashboard.
        </p>
        <Link href="/dashboard" passHref>
          <Button variant="primary" size="md" iconLeft={<ArrowLeft size={16} />}>
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
