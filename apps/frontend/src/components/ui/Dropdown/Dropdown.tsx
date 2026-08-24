'use client';

import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import styles from './Dropdown.module.css';

interface DropdownContextType {
  isOpen: boolean;
  close: () => void;
  toggle: () => void;
}

const DropdownContext = createContext<DropdownContextType | undefined>(undefined);

export interface DropdownProps {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ children, align = 'right', className = '' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggle = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  // Close on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, close, toggle }}>
      <div ref={dropdownRef} className={`${styles.container} ${styles[align]} ${className}`}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({ children }: { children: React.ReactNode }) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownTrigger must be used inside Dropdown');

  return (
    <div
      onClick={context.toggle}
      className={styles.trigger}
      aria-haspopup="true"
      aria-expanded={context.isOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          context.toggle();
        }
      }}
    >
      {children}
    </div>
  );
}

export function DropdownMenu({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenu must be used inside Dropdown');

  if (!context.isOpen) return null;

  return (
    <div className={`${styles.menu} ${className}`} role="menu" tabIndex={-1}>
      {children}
    </div>
  );
}

export interface DropdownItemProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  className?: string;
}

export function DropdownItem({
  children,
  icon,
  onClick,
  variant = 'default',
  disabled = false,
  className = '',
}: DropdownItemProps) {
  const context = useContext(DropdownContext);

  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    if (context) context.close();
  };

  return (
    <button
      type="button"
      className={`
        ${styles.item}
        ${styles[variant]}
        ${disabled ? styles.disabled : ''}
        ${className}
      `}
      onClick={handleClick}
      disabled={disabled}
      role="menuitem"
    >
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      <span className={styles.itemLabel}>{children}</span>
    </button>
  );
}

export function DropdownDivider() {
  return <div className={styles.divider} role="separator" />;
}
