'use client';

import React, { useEffect, useState } from 'react';
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

const COLLAPSE_KEY = 'haios.sidebar.collapsed';

export function AppShell({
  children,
  breadcrumbs = ['Operations', 'Dashboard'],
  requiredPermission,
  requiredRoles,
}: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Restore the clinician's preferred navigation density.
  useEffect(() => {
    try {
      setIsCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* storage unavailable — default expanded */
    }
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <AuthGuard requiredPermission={requiredPermission} requiredRoles={requiredRoles}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>
      <div className={styles.layout}>
        <AppSidebar
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />
        <div className={styles.mainWrapper}>
          <AppHeader
            breadcrumbs={breadcrumbs}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
          />
          <main className={styles.contentContainer} id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
