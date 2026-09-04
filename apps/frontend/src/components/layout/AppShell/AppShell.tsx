'use client';

import React, { useEffect, useState } from 'react';
import { AuthGuard } from '../../auth/AuthGuard';
import { AppSidebar } from '../AppSidebar/AppSidebar';
import { AppHeader } from '../AppHeader/AppHeader';
import { CommandMenu } from '../../navigation/CommandMenu';
import { Permission, StaffRole } from '../../../types/auth';
import styles from './AppShell.module.css';

export interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: string[];
  requiredPermission?: Permission;
  requiredRoles?: StaffRole[];
  /**
   * Content width variant.
   *
   *   `standard` (default) caps the content container to the design-system
   *                content max-width (`--content-max-width`) and applies the
   *                default horizontal padding. Use for operational screens.
   *   `wide`              caps at 1600px so admin consoles, dashboards, and
   *                       multi-column tables can breathe without scrolling.
   *   `full`              removes the max-width cap and the horizontal
   *                       padding. Reserved for clinical workspaces where
   *                       side-by-side panels or large tables need every
   *                       pixel.
   *
   * Vertical page rhythm (header offset + footer breathing room) is
   * preserved across all three variants. Only the content container's
   * max-width and horizontal padding differ.
   */
  variant?: 'standard' | 'wide' | 'full';
}

const COLLAPSE_KEY = 'haios.sidebar.collapsed';

export function AppShell({
  children,
  breadcrumbs = ['Operations', 'Dashboard'],
  requiredPermission,
  requiredRoles,
  variant = 'standard',
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

  const variantClass =
    variant === 'wide' ? styles.wide : variant === 'full' ? styles.full : styles.standard;

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
            isMobileSidebarOpen={isMobileSidebarOpen}
          />
          <main
            className={`${styles.contentContainer} ${variantClass}`}
            id="main-content"
            tabIndex={-1}
            // While the mobile drawer overlays content, mark <main> as inert
            // so keyboard focus cannot escape into the background. React 18
            // silently drops boolean-valued unknown attributes (`inert` only
            // became a real boolean prop in React 19), so pass the empty
            // string — the valid boolean-attribute form — and cast it to the
            // prop type React 18's typings expect. Verified in-browser:
            // `inert=""` renders while the drawer is open and is removed
            // when it closes.
            inert={isMobileSidebarOpen ? ('' as unknown as boolean) : undefined}
          >
            {children}
          </main>
        </div>
      </div>
      <CommandMenu />
    </AuthGuard>
  );
}
