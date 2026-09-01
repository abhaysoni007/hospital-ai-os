'use client';

import React from 'react';
import { Spinner } from '../Spinner/Spinner';
import styles from './IconButton.module.css';

export type IconButtonVariant = 'ghost' | 'outline' | 'primary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** Required accessible name. Icon-only buttons must be labeled. */
  icon: React.ReactNode;
  /** Accessible label, required for screen readers. */
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
}

/**
 * IconButton — square button for icon-only actions.
 *
 *  - aria-label is REQUIRED (TS enforces it).
 *  - Hit target respects the chosen size; never below 28px.
 *  - Loading state shows the Spinner and disables interaction.
 *  - For tooltip/description, wrap with the Tooltip primitive — do not
 *    invent a label prop here.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const classNames = [
      styles.button,
      styles[variant],
      styles[size],
      isLoading ? styles.loading : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classNames}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? <Spinner size="sm" decorative label="Loading" /> : icon}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
