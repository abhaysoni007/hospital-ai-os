'use client';

import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../Button/Button';
import { useAuth } from '../../../hooks/useAuth';
import { ROLE_DISPLAY_NAMES } from '../../../utils/rbac';
import styles from './AccessRestricted.module.css';

export interface AccessRestrictedProps {
  requiredPermission?: string;
  className?: string;
}

export function AccessRestricted({ requiredPermission, className = '' }: AccessRestrictedProps) {
  const { user } = useAuth();
  const roleDisplay = user?.role ? ROLE_DISPLAY_NAMES[user.role] : 'Unknown Role';

  return (
    <div
      className={`${styles.container} ${className}`}
      role="region"
      aria-label="Access Restricted"
    >
      <div className={styles.card}>
        <div className={styles.iconCircle}>
          <ShieldAlert size={40} className={styles.icon} aria-hidden="true" />
        </div>
        <span className={styles.badge}>403 — Unauthorized</span>
        <h1 className={styles.title}>Access Restricted</h1>
        <p className={styles.description}>
          Your account does not have the required permissions to view this resource. Access policies
          in Hospital AI OS are strictly regulated by role-based access control (RBAC).
        </p>

        {user && (
          <div className={styles.contextBox}>
            <div className={styles.contextRow}>
              <span className={styles.contextLabel}>Current Role:</span>
              <span className={styles.contextValue}>{roleDisplay}</span>
            </div>
            {requiredPermission && (
              <div className={styles.contextRow}>
                <span className={styles.contextLabel}>Required Permission:</span>
                <span className={styles.contextCode}>{requiredPermission}</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <Link href="/dashboard" passHref>
            <Button variant="primary" size="md" iconLeft={<ArrowLeft size={16} />}>
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
