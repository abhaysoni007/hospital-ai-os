'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Activity,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  X,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { getNavItemsForRole, NavItemConfig } from '../../../utils/rbac';
import { isNavItemActive } from '../../../utils/nav-helpers';
import { SidebarItem } from '../../ui/SidebarItem/SidebarItem';
import styles from './AppSidebar.module.css';

export interface AppSidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'LayoutDashboard':
      return <LayoutDashboard size={18} />;
    case 'Users':
      return <Users size={18} />;
    case 'Calendar':
      return <Calendar size={18} />;
    case 'Stethoscope':
      return <Stethoscope size={18} />;
    case 'Activity':
      return <Activity size={18} />;
    case 'CheckSquare':
      return <CheckSquare size={18} />;
    default:
      return <LayoutDashboard size={18} />;
  }
};

export function AppSidebar({
  isMobileOpen = false,
  onMobileClose,
  isCollapsed: collapsedProp,
  onToggleCollapse,
}: AppSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = collapsedProp ?? internalCollapsed;
  const pathname = usePathname();
  const { user } = useAuth();

  // M16B — focus management for the mobile drawer.
  // When the drawer opens, remember the element that had focus (usually
  // the toggle button in AppHeader) so we can restore it on close.
  // While open, Escape closes and focus is moved into the drawer.
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isMobileOpen) return;
    lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    // Move focus into the drawer so keyboard users land inside it.
    const drawer = drawerRef.current;
    if (drawer) {
      // The first focusable element inside the drawer; fall back to the
      // drawer itself if nothing is focusable.
      const firstFocusable = drawer.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? drawer).focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onMobileClose?.();
        return;
      }
      // Focus trap: Tab cycles within the open drawer.
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the element that opened the drawer.
      lastFocusedRef.current?.focus?.();
    };
  }, [isMobileOpen, onMobileClose]);

  const navItems = getNavItemsForRole(user?.role);

  // Group nav items by section
  const operationsItems = navItems.filter((i) => i.section === 'operations');
  const clinicalItems = navItems.filter((i) => i.section === 'clinical');
  const workspaceItems = navItems.filter((i) => i.section === 'workspace');
  const adminItems = navItems.filter((i) => i.section === 'administration');

  const renderSection = (title: string, items: NavItemConfig[]) => {
    if (items.length === 0) return null;
    return (
      <div className={styles.section}>
        {!isCollapsed && <span className={styles.sectionTitle}>{title}</span>}
        {isCollapsed && <div className={styles.sectionDivider} />}
        <div className={styles.sectionList}>
          {items.map((item) => (
            <SidebarItem
              key={item.id}
              label={item.label}
              href={item.href}
              icon={getIcon(item.iconName)}
              isActive={isNavItemActive(pathname, item.href)}
              isCollapsed={isCollapsed}
              onClick={onMobileClose}
            />
          ))}
        </div>
      </div>
    );
  };

  // The sidebar element must be reachable to assistive tech when it is
  // visible on desktop or open as a drawer on mobile. When the mobile
  // drawer is closed, the sidebar is hidden via transform — but we still
  // keep it in the accessibility tree because the CSS transform does not
  // remove it from layout. (This is intentional: the close-on-Escape
  // logic relies on the sidebar being mounted.)
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div className={styles.mobileBackdrop} onClick={onMobileClose} aria-hidden="true" />
      )}

      <aside
        ref={drawerRef}
        className={`
          ${styles.sidebar}
          ${isCollapsed ? styles.collapsed : styles.expanded}
          ${isMobileOpen ? styles.mobileOpen : ''}
        `}
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <div className={styles.brandLogoCircle}>
            <HeartPulse size={20} className={styles.brandLogoIcon} />
          </div>
          {!isCollapsed && (
            <div className={styles.brandTitles}>
              <span className={styles.brandTitle}>Hospital AI OS</span>
              <span className={styles.brandSubtitle}>Clinical OS v1.0</span>
            </div>
          )}
          {isMobileOpen && onMobileClose && (
            <button
              type="button"
              className={styles.mobileCloseButton}
              onClick={onMobileClose}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Primary Navigation Landmark */}
        <nav
          id="primary-navigation"
          className={styles.navContent}
          aria-label="Primary"
        >
          {renderSection('Operations', operationsItems)}
          {renderSection('Clinical', clinicalItems)}
          {renderSection('Workspace', workspaceItems)}
          {renderSection('Administration', adminItems)}
        </nav>

        {/* Collapse Toggle Footer (desktop only — hidden on mobile via CSS) */}
        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={() =>
              onToggleCollapse ? onToggleCollapse() : setInternalCollapsed((p) => !p)
            }
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <>
                <ChevronLeft size={18} />
                <span className={styles.collapseLabel}>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}