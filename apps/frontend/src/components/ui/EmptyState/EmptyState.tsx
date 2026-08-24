import React from 'react';
import { Inbox } from 'lucide-react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.iconWrapper}>{icon || <Inbox size={32} aria-hidden="true" />}</div>
      <h4 className={styles.title}>{title}</h4>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
