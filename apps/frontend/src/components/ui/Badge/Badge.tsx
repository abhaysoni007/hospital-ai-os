import React from 'react';
import styles from './Badge.module.css';

export type BadgeVariant =
  'critical' | 'urgent' | 'stable' | 'pending' | 'info' | 'ai-assist' | 'neutral' | 'primary';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  showDot?: boolean;
  icon?: React.ReactNode;
}

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  showDot = false,
  icon,
  className = '',
  ...props
}: BadgeProps) {
  const classNames = [styles.badge, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classNames} {...props}>
      {showDot && <span className={styles.dot} aria-hidden="true" />}
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{children}</span>
    </span>
  );
}
