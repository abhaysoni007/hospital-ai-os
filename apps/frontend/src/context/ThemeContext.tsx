'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'haios.theme';

interface ThemeContextValue {
  /** The user's selection: light, dark, or system. */
  mode: ThemeMode;
  /** The actually-applied theme after resolving system preference. */
  resolved: ResolvedTheme;
  /** Set explicit user preference (persists). */
  setMode: (mode: ThemeMode) => void;
  /** Cycle through light → dark → system (convenience for toggle UI). */
  cycleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Apply a resolved theme to <html data-theme="...">. We keep the data-theme
 * attribute on the html element (not body) so initial-paint CSS can resolve
 * tokens before React hydrates.
 */
function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(mode: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme {
  return mode === 'system' ? systemTheme : mode;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * ThemeProvider — single source of truth for color theme.
 *
 *  - Wraps the entire app (mounted in app/layout.tsx).
 *  - Persists explicit user choice in localStorage under THEME_STORAGE_KEY.
 *  - Listens to OS-level color-scheme changes when mode === 'system'.
 *  - Sets data-theme on <html> so token CSS resolves on first paint
 *    (the inline <Script> bootstrap in layout.tsx keeps the first paint
 *    honest, this provider owns subsequent changes).
 *  - SSR-safe: renders in a stable mode until hydration completes.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');

  // Hydrate from storage + system preference on mount.
  useEffect(() => {
    const stored = readStoredMode();
    const sys = resolveSystemTheme();
    setModeState(stored);
    setSystemTheme(sys);
    setResolved(resolve(stored, sys));
  }, []);

  // Track OS preference changes while mounted.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? 'dark' : 'light';
      setSystemTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Apply resolved theme to <html>.
  useEffect(() => {
    applyResolvedTheme(resolved);
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((prev) => {
      const order: ThemeMode[] = ['light', 'dark', 'system'];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      setResolved(resolve(next, systemTheme));
      return next;
    });
  }, [systemTheme]);

  // Keep resolved in sync with mode + systemTheme.
  useEffect(() => {
    setResolved(resolve(mode, systemTheme));
  }, [mode, systemTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, cycleMode }),
    [mode, resolved, setMode, cycleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
