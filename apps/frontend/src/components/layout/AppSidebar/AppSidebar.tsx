'use client';

import React, { useState } from 'react';
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
import { SidebarItem } from '../../ui/SidebarItem/SidebarItem';
import styles from './AppSidebar.module.css';

export interface AppSidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

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

  const navItems = getNavItemsForRole(user?.role);

  // Group nav items by section
  const operationsItems = navItems.filter((i) => i.section === 'operations');
  const clinicalItems = navItems.filter((i) => i.section === 'clinical');
  const workspaceItems = navItems.filter((i) => i.section === 'workspace');
  const adminItems = navItems.filter((i) => i.section === 'administration');

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
              isActive={
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))
              }
              isCollapsed={isCollapsed}
              onClick={onMobileClose}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div className={styles.mobileBackdrop} onClick={onMobileClose} aria-hidden="true" />
      )}

      <aside
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

        {/* Navigation Sections */}
        <div className={styles.navContent}>
          {renderSection('Operations', operationsItems)}
          {renderSection('Clinical', clinicalItems)}
          {renderSection('Workspace', workspaceItems)}
          {renderSection('Administration', adminItems)}
        </div>

        {/* Collapse Toggle Footer */}
        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={() =>
              onToggleCollapse ? onToggleCollapse() : setInternalCollapsed((p) => !p)
            }
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
