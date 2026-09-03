'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { Permission, StaffRole } from '../../types/auth';
import { hasPermission } from '../../utils/rbac';
import { AccessRestricted } from '../ui/AccessRestricted/AccessRestricted';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import styles from './AuthGuard.module.css';

export interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  requiredRoles?: StaffRole[];
}

export function AuthGuard({ children, requiredPermission, requiredRoles }: AuthGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const returnParam =
        pathname && pathname !== '/login' ? `?returnUrl=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${returnParam}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  // Loading Screen Skeleton during initial session hydration
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.skeletonSidebar}>
          <div className={styles.skeletonLogo}>
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="text" width={120} height={18} />
          </div>
          <div className={styles.skeletonNav}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={36} borderRadius={8} />
            ))}
          </div>
        </div>
        <div className={styles.skeletonMain}>
          <div className={styles.skeletonHeader}>
            <Skeleton variant="text" width={200} height={20} />
            <div className={styles.skeletonHeaderRight}>
              <Skeleton variant="circular" width={36} height={36} />
              <Skeleton variant="circular" width={36} height={36} />
            </div>
          </div>
          <div className={styles.skeletonContent}>
            <Skeleton variant="card" height={100} />
            <div className={styles.skeletonGrid}>
              <Skeleton variant="card" height={160} />
              <Skeleton variant="card" height={160} />
              <Skeleton variant="card" height={160} />
              <Skeleton variant="card" height={160} />
            </div>
            <Skeleton variant="card" height={300} />
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Role validation
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <AccessRestricted />;
  }

  // Permission validation
  if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
    return <AccessRestricted requiredPermission={requiredPermission} />;
  }

  return <>{children}</>;
}
