'use client';

import React, { useState } from 'react';
import { Input, InputProps } from './Input';
import { Eye, EyeOff } from 'lucide-react';
import styles from './Input.module.css';

export type PasswordInputProps = Omit<InputProps, 'type' | 'iconRight'>;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (props, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    const toggleButton = (
      <button
        type="button"
        onClick={toggleVisibility}
        className={styles.toggleVisibilityButton}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={0}
      >
        {showPassword ? (
          <EyeOff size={16} aria-hidden="true" />
        ) : (
          <Eye size={16} aria-hidden="true" />
        )}
      </button>
    );

    return (
      <Input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        iconRight={toggleButton}
        {...props}
      />
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
