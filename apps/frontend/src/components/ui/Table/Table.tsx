'use client';

import React from 'react';
import styles from './Table.module.css';

/**
 * M13 — Shared clinical data-table kit.
 *
 * Every list screen renders through these primitives so that:
 * - headers always carry scope="col" (table semantics)
 * - clickable rows are real buttons-in-name only via Row onClick + keyboard
 *   activation (Tab/Enter/Space) with aria-disabled support
 * - loading, empty, and error slots share one visual language
 */

export interface TableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Accessible name for the table (required). */
  ariaLabel: string;
}

export function Table({ children, ariaLabel, className = '', ...props }: TableProps) {
  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <table className={styles.table}>
        <caption className={styles.caption}>{ariaLabel}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className={styles.head}>{children}</thead>;
}

export interface THProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export function TH({ children, align = 'left', width, ...props }: THProps) {
  return (
    <th
      scope="col"
      className={`${styles.th} ${styles[align]}`}
      style={width ? { width } : undefined}
      {...props}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export interface TRProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Makes the whole row activate on click with full keyboard support. */
  interactive?: boolean;
}

export function TR({ children, interactive = false, className = '', ...props }: TRProps) {
  const classNames = [interactive ? styles.interactiveRow : '', className]
    .filter(Boolean)
    .join(' ');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (!interactive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement;
      // Don't hijack activation when the focus is on an inner control/link.
      if (target.closest('button, a, input, select, textarea, [role="button"]')) return;
      e.preventDefault();
      props.onClick?.(e as unknown as React.MouseEvent<HTMLTableRowElement>);
    }
  };

  return (
    <tr
      className={classNames}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </tr>
  );
}

export interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
}

export function TD({ children, align = 'left', className = '', ...props }: TDProps) {
  return (
    <td className={`${styles.td} ${styles[align]} ${className}`} {...props}>
      {children}
    </td>
  );
}

/** Monospace numeric cell for tokens, values, MRNs. */
export function NumericTD({
  children,
  className = '',
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`${styles.td} ${styles.numeric} ${className}`} {...props}>
      {children}
    </td>
  );
}

/** Primary entity link inside a row — the accessible navigation affordance. */
export function RowLink({
  children,
  className = '',
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`${styles.rowLink} ${className}`} {...props}>
      {children}
    </a>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.skeletonWrap} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.skeletonRow} />
      ))}
    </div>
  );
}
