import React from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

/**
 * M13 — Standardized page header for every workspace screen.
 * One h1 per page, optional supporting description, command-oriented action
 * slot, and an optional identity/meta strip (e.g., patient context).
 */
export function PageHeader({ title, description, actions, meta }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <div className={styles.titles}>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}
