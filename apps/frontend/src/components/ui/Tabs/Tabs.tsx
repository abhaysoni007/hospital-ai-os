'use client';

import React, { createContext, useContext, useId, useRef, useState } from 'react';
import styles from './Tabs.module.css';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  baseId: string;
  registerTabRef: (value: string, el: HTMLButtonElement | null) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export interface TabsProps {
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  /** Layout variant: underline (default) or pills. */
  variant?: 'underline' | 'pills';
  className?: string;
  children: React.ReactNode;
  /** Accessible label for the tablist. */
  ariaLabel: string;
}

/**
 * Tabs — WAI-ARIA tabs pattern.
 *  - role="tablist" container with arrow-key navigation.
 *  - Each tab uses real <button role="tab" aria-selected aria-controls>.
 *  - Each panel uses role="tabpanel" with tabindex=0 so it can receive focus.
 *  - Roving tabindex: only the active tab has tabindex=0.
 *  - Home/End jump to first/last.
 */
export function Tabs({
  value,
  defaultValue,
  onValueChange,
  variant = 'underline',
  className = '',
  ariaLabel,
  children,
}: TabsProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const current = isControlled ? (value as string) : internal;

  const baseId = useId();
  const tabsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const registerTabRef = (v: string, el: HTMLButtonElement | null) => {
    if (el) tabsRef.current.set(v, el);
    else tabsRef.current.delete(v);
  };

  const setValue = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const order = Array.from(tabsRef.current.keys());
    if (order.length === 0) return;
    const idx = order.indexOf(current);
    if (idx === -1) return;
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % order.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + order.length) % order.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = order.length - 1;
    if (nextIdx !== null) {
      e.preventDefault();
      const nextKey = order[nextIdx];
      setValue(nextKey);
      tabsRef.current.get(nextKey)?.focus();
    }
  };

  return (
    <TabsContext.Provider value={{ value: current, setValue, baseId, registerTabRef }}>
      <div className={`${styles.root} ${className}`}>
        <div
          role="tablist"
          aria-label={ariaLabel}
          className={`${styles.list} ${styles[variant]}`}
          onKeyDown={onKeyDown}
        >
          {children}
        </div>
      </div>
    </TabsContext.Provider>
  );
}

export interface TabProps {
  value: string;
  children: React.ReactNode;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function Tab({ value, children, icon, disabled = false }: TabProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tab must be used inside <Tabs>');
  const isActive = ctx.value === value;
  return (
    <button
      ref={(el) => ctx.registerTabRef(value, el)}
      type="button"
      role="tab"
      id={`${ctx.baseId}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${ctx.baseId}-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
      onClick={() => !disabled && ctx.setValue(value)}
    >
      {icon && <span className={styles.tabIcon}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  /** Force mount the panel even when inactive (preserves state). */
  forceMount?: boolean;
}

export function TabPanel({ value, children, forceMount = false }: TabPanelProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabPanel must be used inside <Tabs>');
  const isActive = ctx.value === value;
  if (!forceMount && !isActive) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      tabIndex={0}
      hidden={!isActive}
      className={styles.panel}
    >
      {children}
    </div>
  );
}
