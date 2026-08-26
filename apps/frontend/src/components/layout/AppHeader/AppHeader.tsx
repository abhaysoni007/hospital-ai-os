'use client';

import React, { useState } from 'react';
import { Search, Bell, HelpCircle, LogOut, Menu, User } from 'lucide-react';
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
import { useNotifications } from '../../../hooks/useNotifications';
import styles from './AppHeader.module.css';

export interface AppHeaderProps {
  breadcrumbs?: string[];
  onToggleMobileSidebar?: () => void;
}

export function AppHeader({
  breadcrumbs = ['Operations', 'Dashboard'],
  onToggleMobileSidebar,
}: AppHeaderProps) {
  const { user, logout } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  // M12.2: REAL unread state — replaces the previous hardcoded "(2 unread)".
  const {
    items: notifications,
    unreadCount,
    isLoading: notificationsLoading,
    error: notificationsError,
    acknowledge,
    reload: reloadNotifications,
  } = useNotifications();

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email.split('@')[0] || 'Clinician';

  const roleTitle = user?.role ? ROLE_DISPLAY_NAMES[user.role] : 'Staff';

  return (
    <>
      <header className={styles.header}>
        <div className={styles.leftSection}>
          {onToggleMobileSidebar && (
            <button
              type="button"
              className={styles.mobileMenuButton}
              onClick={onToggleMobileSidebar}
              aria-label="Toggle navigation drawer"
            >
              <Menu size={20} />
            </button>
          )}

          <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className={styles.breadcrumbSeparator}>/</span>}
                <span
                  className={
                    idx === breadcrumbs.length - 1 ? styles.breadcrumbActive : styles.breadcrumbItem
                  }
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className={styles.rightSection}>
          {/* Global Search Trigger */}
          <button
            type="button"
            className={styles.searchTrigger}
            onClick={() => setIsSearchOpen(true)}
            aria-label="Open global search (Cmd+K)"
          >
            <Search size={16} className={styles.searchIcon} />
            <span className={styles.searchText}>Search patients, orders, tasks...</span>
            <kbd className={styles.searchKbd}>⌘K</kbd>
          </button>

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

          {/* Help Button */}
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Help and clinical guidelines"
            title="Help & Guidelines"
          >
            <HelpCircle size={18} />
          </button>

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
              <DropdownItem icon={<User size={16} />}>Staff Profile & Security</DropdownItem>
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
