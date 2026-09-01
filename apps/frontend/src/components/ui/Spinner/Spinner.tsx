import React from 'react';
import styles from './Spinner.module.css';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  /** Accessible label announced to screen readers. Default: "Loading". */
  label?: string;
  /** Decorative-only mode: visually present but not announced. */
  decorative?: boolean;
}

/**
 * Spinner — the canonical loading indicator for the application.
 *
 * - Token-driven sizing; honors prefers-reduced-motion (no rotation).
 * - Decorative mode (decorative=true) renders aria-hidden and lets parent
 *   provide its own live-region announcement.
 * - Button consumes this primitive so loading state has one source of truth.
 */
export function Spinner({
  size = 'md',
  label = 'Loading',
  decorative = false,
  className = '',
  ...props
}: SpinnerProps) {
  const classNames = [styles.spinner, styles[size], className].filter(Boolean).join(' ');
  return (
    <span
      className={classNames}
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? 'true' : undefined}
      {...props}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="10" strokeWidth="3" />
      </svg>
    </span>
  );
}
