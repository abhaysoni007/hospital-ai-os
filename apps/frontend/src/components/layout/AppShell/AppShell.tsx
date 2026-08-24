'use client';

import React, { useState } from 'react';
import { AuthGuard } from '../../auth/AuthGuard';
import { AppSidebar } from '../AppSidebar/AppSidebar';
import { AppHeader } from '../AppHeader/AppHeader';
import { Permission, StaffRole } from '../../../types/auth';
import styles from './AppShell.module.css';

export interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: string[];
  requiredPermission?: Permission;
  requiredRoles?: StaffRole[];
}

export function AppShell({
  children,
  breadcrumbs = ['Operations', 'Dashboard'],
  requiredPermission,
  requiredRoles,
}: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <AuthGuard requiredPermission={requiredPermission} requiredRoles={requiredRoles}>
      <div className={styles.layout}>
        <AppSidebar
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />
        <div className={styles.mainWrapper}>
          <AppHeader
            breadcrumbs={breadcrumbs}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
          />
          <main className={styles.contentContainer} id="main-content">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
