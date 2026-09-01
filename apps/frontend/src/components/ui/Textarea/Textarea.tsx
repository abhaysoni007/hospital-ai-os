'use client';

import React, { useId } from 'react';
import styles from './Textarea.module.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  /** Renders label for screen readers only. */
  hideLabel?: boolean;
}

/**
 * Textarea — visually + behaviorally aligned with Input.
 * Label association, aria-invalid, aria-describedby (error or description),
 * required asterisk, focus-visible state, error and disabled variants.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      description,
      error,
      hideLabel = false,
      id,
      disabled,
      className = '',
      rows = 4,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const fieldId = id || generatedId;
    const errorId = `${fieldId}-error`;
    const descriptionId = `${fieldId}-desc`;

    const describedBy = error ? errorId : description ? descriptionId : undefined;

    return (
      <div className={`${styles.container} ${className}`}>
        {label && (
          <label htmlFor={fieldId} className={hideLabel ? styles.srOnlyLabel : styles.label}>
            {label}
            {props.required && (
              <span className={styles.requiredMark} aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </label>
        )}
        {description && !error && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        <div
          className={`
            ${styles.field}
            ${error ? styles.hasError : ''}
            ${disabled ? styles.disabled : ''}
          `}
        >
          <textarea
            ref={ref}
            id={fieldId}
            rows={rows}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={styles.textarea}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className={styles.errorMessage} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
