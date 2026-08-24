'use client';

import React from 'react';
import { AlertOctagon, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import styles from './AlertBanner.module.css';

export type AlertSeverity = 'critical' | 'urgent' | 'warning' | 'info' | 'success';

export interface AlertBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  severity?: AlertSeverity;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function AlertBanner({
  severity = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  action,
  icon,
  className = '',
  ...props
}: AlertBannerProps) {
  const getDefaultIcon = () => {
    switch (severity) {
      case 'critical':
        return <AlertOctagon size={20} aria-hidden="true" />;
      case 'urgent':
      case 'warning':
        return <AlertTriangle size={20} aria-hidden="true" />;
      case 'success':
        return <CheckCircle2 size={20} aria-hidden="true" />;
      case 'info':
      default:
        return <Info size={20} aria-hidden="true" />;
    }
  };

  const classNames = [styles.banner, styles[severity], className].filter(Boolean).join(' ');

  return (
    <div className={classNames} role="alert" {...props}>
      <div className={styles.iconWrapper}>{icon || getDefaultIcon()}</div>
      <div className={styles.content}>
        {title && <h4 className={styles.title}>{title}</h4>}
        <div className={styles.message}>{children}</div>
      </div>
      {action && <div className={styles.actionWrapper}>{action}</div>}
      {dismissible && onDismiss && (
        <button
          type="button"
          className={styles.dismissButton}
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
