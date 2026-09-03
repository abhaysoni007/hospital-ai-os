import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * M18 Part 2.1 — NavigationProgressBar & Sidebar Immediate Feedback Contract Test
 *
 * Requirements:
 * - NavigationProgressBar provides 0ms visible feedback when internal links are clicked.
 * - Supports programmatic notification via notifyNavigationStart and CustomEvent.
 * - Auto-clears on pathname change and has a safety timeout to prevent getting permanently stuck.
 * - Respects prefers-reduced-motion in CSS.
 * - SidebarItem supports isPending state with accessible aria-busy attribute.
 */

const PROGRESS_TSX = resolveAbsolute(__dirname, '../NavigationProgressBar.tsx');
const PROGRESS_CSS = resolveAbsolute(__dirname, '../NavigationProgressBar.module.css');
const SIDEBAR_ITEM_TSX = resolveAbsolute(__dirname, '../../SidebarItem/SidebarItem.tsx');

describe('M18 Part 2.1 Navigation Immediate Feedback Contract', () => {
  const progressTsx = readFileSync(PROGRESS_TSX, 'utf8');
  const progressCss = readFileSync(PROGRESS_CSS, 'utf8');
  const sidebarItemTsx = readFileSync(SIDEBAR_ITEM_TSX, 'utf8');

  it('NavigationProgressBar listens for global internal link clicks', () => {
    expect(progressTsx).toMatch(/window\.addEventListener\(['"]click['"],\s*handleClick/);
  });

  it('NavigationProgressBar supports custom navigation-start event', () => {
    expect(progressTsx).toMatch(/window\.addEventListener\(['"]app:navigation-start['"]/);
  });

  it('NavigationProgressBar clears when pathname/searchParams update', () => {
    expect(progressTsx).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*setIsNavigating\(false\)[\s\S]*\},\s*\[pathname,\s*searchParams\]\)/);
  });

  it('NavigationProgressBar has safety timeout against getting stuck', () => {
    expect(progressTsx).toMatch(/setTimeout\(\(\)\s*=>\s*\{[\s\S]*setIsNavigating\(false\)[\s\S]*\},\s*\d+\)/);
  });

  it('NavigationProgressBar CSS respects prefers-reduced-motion', () => {
    expect(progressCss).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*animation:\s*none;/);
  });

  it('SidebarItem supports isPending prop and aria-busy', () => {
    expect(sidebarItemTsx).toMatch(/isPending\s*\?:\s*boolean/);
    expect(sidebarItemTsx).toMatch(/aria-busy=\{isPending\s*\?\s*['"]true['"]\s*:\s*undefined\}/);
  });
});
