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
    >
      <span className={styles.icon}>{icon}</span>
      {!isCollapsed && <span className={styles.label}>{label}</span>}
      {!isCollapsed && badge && <span className={styles.badge}>{badge}</span>}
      {isCollapsed && badge && <span className={styles.collapsedBadgeDot} aria-hidden="true" />}
    </Link>
  );
}
