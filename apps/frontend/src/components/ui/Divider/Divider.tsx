import React from 'react';
import styles from './Divider.module.css';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  /** Decorative only — true omits the role. Defaults to true (visual). */
  decorative?: boolean;
}

/**
 * Divider — semantic or decorative separator.
 * When not decorative, exposes role="separator" with aria-orientation so
 * assistive tech can announce it.
 */
export function Divider({
  orientation = 'horizontal',
  decorative = true,
  className = '',
  ...props
}: DividerProps) {
  const classNames = [styles.divider, styles[orientation], className].filter(Boolean).join(' ');
  if (decorative) {
    return <div className={classNames} aria-hidden="true" {...props} />;
  }
  return (
    <div
      className={classNames}
      role="separator"
      aria-orientation={orientation}
      {...props}
    />
  );
}
