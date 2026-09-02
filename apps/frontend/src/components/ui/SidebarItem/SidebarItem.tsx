'use client';

import React from 'react';
import Link from 'next/link';
import styles from './SidebarItem.module.css';

export interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive?: boolean;
  isCollapsed?: boolean;
  badge?: string | number;
  onClick?: () => void;
}

export function SidebarItem({
  icon,
  label,
  href,
  isActive = false,
  isCollapsed = false,
  badge,
  onClick,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        ${styles.item}
        ${isActive ? styles.active : ''}
        ${isCollapsed ? styles.collapsed : ''}
      `}
      title={isCollapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      // M16B — when collapsed, the visible label is hidden so the link
      // would otherwise be icon-only with no accessible name. The label
      // is exposed to screen readers via an SR-only span. The `title`
      // attribute remains as a sighted-user affordance.
      aria-label={isCollapsed ? label : undefined}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      {!isCollapsed && <span className={styles.label}>{label}</span>}
      {isCollapsed && <span className={styles.srOnly}>{label}</span>}
      {!isCollapsed && badge && <span className={styles.badge}>{badge}</span>}
      {isCollapsed && badge && <span className={styles.collapsedBadgeDot} aria-hidden="true" />}
    </Link>
  );
}
