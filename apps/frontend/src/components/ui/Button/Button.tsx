'use client';

import React from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      disabled,
      className = '',
      ...props
    },
    ref,
  ) => {
    const classNames = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth ? styles.fullWidth : '',
      isLoading ? styles.loading : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classNames}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading && (
          <span className={styles.spinner} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle
                cx="12"
                cy="12"
                r="10"
                strokeWidth="3"
                stroke="currentColor"
                strokeDasharray="31.4"
                strokeDashoffset="10"
              />
            </svg>
          </span>
        )}
        {!isLoading && iconLeft && <span className={styles.iconLeft}>{iconLeft}</span>}
        <span className={styles.label}>{children}</span>
        {!isLoading && iconRight && <span className={styles.iconRight}>{iconRight}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';
