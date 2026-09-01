'use client';

import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, ThemeMode } from '../../../context/ThemeContext';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './ThemeToggle.module.css';

const LABEL: Record<ThemeMode, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'Follow system theme',
};

const NEXT_LABEL: Record<ThemeMode, string> = {
  light: 'Switch to dark theme',
  dark: 'Switch to follow system theme',
  system: 'Switch to light theme',
};

const Icon: Record<ThemeMode, React.ReactNode> = {
  light: <Sun size={18} aria-hidden="true" />,
  dark: <Moon size={18} aria-hidden="true" />,
  system: <Monitor size={18} aria-hidden="true" />,
};

/**
 * ThemeToggle — accessible three-state cycle (light → dark → system).
 * Always renders a real <button> with a stable aria-label; the tooltip
 * announces the *next* action, the aria-label announces the *current* state.
 */
export function ThemeToggle() {
  const { mode, cycleMode } = useTheme();
  return (
    <Tooltip content={NEXT_LABEL[mode]} side="bottom">
      <button
        type="button"
        onClick={cycleMode}
        className={styles.toggle}
        aria-label={`${LABEL[mode]} — click to change`}
        data-theme-mode={mode}
      >
        {Icon[mode]}
      </button>
    </Tooltip>
  );
}
