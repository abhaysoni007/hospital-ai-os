'use client';

import React, { useEffect, useState } from 'react';
import { Search, Bell, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { ROLE_DISPLAY_NAMES } from '../../../utils/rbac';
import { Avatar } from '../../ui/Avatar/Avatar';
import { Badge } from '../../ui/Badge/Badge';
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
} from '../../ui/Dropdown/Dropdown';
import { GlobalSearch } from '../GlobalSearch/GlobalSearch';
import { NotificationPanel } from '../NotificationPanel/NotificationPanel';
import { BreakGlassStatusIndicator } from '../BreakGlassStatusIndicator';
import { useNotifications } from '../../../hooks/useNotifications';
import { ThemeToggle } from '../../ui/ThemeToggle/ThemeToggle';
import { NavigationProgressBar } from '../../ui/NavigationProgressBar/NavigationProgressBar';
import styles from './AppHeader.module.css';

export interface AppHeaderProps {
  breadcrumbs?: string[];
  onToggleMobileSidebar?: () => void;
  /**
   * Whether the mobile navigation drawer is currently open. Used to set
   * `aria-expanded` on the menu toggle (WCAG 2.2 AA — disclosure pattern).
   * Owned by AppShell.
   */
  isMobileSidebarOpen?: boolean;
}

export function AppHeader({
  breadcrumbs = ['Operations', 'Dashboard'],
  onToggleMobileSidebar,
  isMobileSidebarOpen = false,
}: AppHeaderProps) {
  const { user, logout } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  // M12.2: REAL unread state — server-derived scope, no fabricated counts.
  const {
    items: notifications,
    unreadCount,
    isLoading: notificationsLoading,
    error: notificationsError,
    acknowledge,
    reload: reloadNotifications,
  } = useNotifications();

  // The advertised Cmd/Ctrl+K shortcut is real and wired here.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email.split('@')[0] || 'Clinician';

  const roleTitle = user?.role ? ROLE_DISPLAY_NAMES[user.role] : 'Staff';

  return (
    <>
      <NavigationProgressBar />
      <header className={styles.header}>
        <div className={styles.leftSection}>
          {onToggleMobileSidebar && (
            <button
              type="button"
              className={styles.mobileMenuButton}
              onClick={onToggleMobileSidebar}
              aria-label="Toggle navigation drawer"
              aria-expanded={isMobileSidebarOpen}
              aria-controls="primary-navigation"
            >
              <Menu size={20} />
            </button>
          )}

          <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
            <ol className={styles.breadcrumbList}>
              {breadcrumbs.map((crumb, idx) => (
                <li key={idx} className={styles.breadcrumbCrumb}>
                  {idx > 0 && (
                    <span className={styles.breadcrumbSeparator} aria-hidden="true">
                      /
                    </span>
                  )}
                  <span
                    className={
                      idx === breadcrumbs.length - 1
                        ? styles.breadcrumbActive
                        : styles.breadcrumbItem
                    }
                    aria-current={idx === breadcrumbs.length - 1 ? 'page' : undefined}
                  >
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <div className={styles.rightSection}>
          {/* Global Search Trigger */}
          <button
            type="button"
            className={styles.searchTrigger}
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search patients (Control+K)"
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <span className={styles.searchText}>Search patients…</span>
            <kbd className={styles.searchKbd} aria-hidden="true">
              ⌘K
            </kbd>
          </button>

          {/* Compact search entry for small viewports */}
          <button
            type="button"
            className={styles.searchIconButton}
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search patients"
          >
            <Search size={18} />
          </button>

          {/* Break-glass session indicator (shell-level surfacing of M15). */}
          <BreakGlassStatusIndicator />

          {/* Notifications Trigger */}
          <div className={styles.notificationWrapper}>
            <button
              type="button"
              className={`
                ${styles.iconButton}
                ${isNotificationsOpen ? styles.activeIconButton : ''}
              `}
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              aria-label={
                unreadCount > 0
                  ? `Open notifications (${unreadCount} unread)`
                  : 'Open notifications'
              }
              aria-expanded={isNotificationsOpen}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className={styles.notificationDot} />}
            </button>
            <NotificationPanel
              isOpen={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
              items={notifications}
              unreadCount={unreadCount}
              isLoading={notificationsLoading}
              error={notificationsError}
              onAcknowledge={acknowledge}
              onReload={() => void reloadNotifications()}
            />
          </div>

          <ThemeToggle />

          <div className={styles.divider} />

          {/* User Profile Dropdown */}
          <Dropdown align="right">
            <DropdownTrigger>
              <div className={styles.userProfileTrigger}>
                <Avatar name={fullName} size="md" status="online" />
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{fullName}</span>
                  <span className={styles.userRole}>{roleTitle}</span>
                </div>
              </div>
            </DropdownTrigger>
            <DropdownMenu className={styles.profileMenu}>
              <div className={styles.profileMenuHeader}>
                <p className={styles.profileMenuName}>{fullName}</p>
                <p className={styles.profileMenuEmail}>{user?.email}</p>
                <div className={styles.badgeRow}>
                  <Badge variant="primary" size="sm">
                    {roleTitle}
                  </Badge>
                </div>
              </div>
              <DropdownDivider />
              <DropdownItem icon={<LogOut size={16} />} variant="danger" onClick={() => logout()}>
                Sign Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}