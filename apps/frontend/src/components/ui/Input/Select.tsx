import React from 'react';
import styles from './Input.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  label?: string;
  options: SelectOption[];
  /** First placeholder option (value=''). */
  placeholder?: string;
  hideLabel?: boolean;
  error?: string;
}

/**
 * M13 — Shared select field matching Input's visual language and a11y contract
 * (label association, aria-invalid, error announcement).
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { id, label, options, placeholder, hideLabel = false, error, className = '', ...props },
    ref,
  ) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;

    return (
      <div className={className}>
        {label && (
          <label htmlFor={selectId} className={hideLabel ? styles.srOnlyLabel : styles.label}>
            {label}
            {props.required && (
              <span className={styles.requiredMark} aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`${styles.select} ${error ? styles.hasError : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <span id={errorId} className={styles.errorMessage} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
