import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * M16B — Shell responsive CSS contract.
 *
 * The shell CSS modules must declare explicit responsive rules for the
 * documented viewport set. This is a structural test that fails fast on
 * silent regressions (a developer removes a breakpoint without realizing
 * the clinical impact at that width).
 *
 * The set is the union of M16B acceptance gate + the actual layout work
 * in the M16B pass:
 *
 *   375px  — iPhone-SE-class; left padding collapses to --space-3
 *   768px  — mobile/tablet boundary; sidebar becomes a fixed drawer
 *   769-1023 — tablet auto-rail; sidebar collapses to icon-only
 *   1024px — desktop/tablet boundary; search trigger shrinks
 *
 * 1280/1440/1920 are width-cosmetic only — they are governed by
 * `max-width: var(--content-max-width)` (1440px) and the new `.wide`
 * variant (1600px) without a media query. No regression risk.
 */

const CSS_FILES = [
  '../../components/layout/AppShell/AppShell.module.css',
  '../../components/layout/AppHeader/AppHeader.module.css',
  '../../components/layout/AppSidebar/AppSidebar.module.css',
];

function readCss(file: string): string {
  const path = resolveAbsolute(__dirname, file);
  return readFileSync(path, 'utf8');
}

describe('M16B shell responsive CSS contract', () => {
  const shellCss = readCss(CSS_FILES[0]);
  const headerCss = readCss(CSS_FILES[1]);
  const sidebarCss = readCss(CSS_FILES[2]);

  it('AppShell declares a 375px rule', () => {
    expect(shellCss).toMatch(/@media\s*\(max-width:\s*375px\)/);
  });

  it('AppShell declares a 768px rule', () => {
    expect(shellCss).toMatch(/@media\s*\(max-width:\s*768px\)/);
  });

  it('AppShell declares a 1024px rule', () => {
    expect(shellCss).toMatch(/@media\s*\(max-width:\s*1024px\)/);
  });

  it('AppShell exposes all three content variants', () => {
    expect(shellCss).toMatch(/\.standard\s*\{/);
    expect(shellCss).toMatch(/\.wide\s*\{/);
    expect(shellCss).toMatch(/\.full\s*\{/);
  });

  it('AppHeader declares 768px and 375px rules', () => {
    expect(headerCss).toMatch(/@media\s*\(max-width:\s*768px\)/);
    expect(headerCss).toMatch(/@media\s*\(max-width:\s*375px\)/);
  });

  it('AppHeader 1024px rule appears exactly once (no duplicate)', () => {
    const matches = headerCss.match(/@media\s*\(max-width:\s*1024px\)/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('AppSidebar declares 768px (mobile drawer) and 375px rules', () => {
    expect(sidebarCss).toMatch(/@media\s*\(max-width:\s*768px\)/);
    expect(sidebarCss).toMatch(/@media\s*\(max-width:\s*375px\)/);
  });

  it('AppSidebar declares a tablet auto-rail rule (769-1023)', () => {
    expect(sidebarCss).toMatch(
      /@media\s*\(min-width:\s*769px\)\s*and\s*\(max-width:\s*1023px\)/,
    );
  });

  it('no shell CSS introduces hardcoded durations', () => {
    const all = shellCss + headerCss + sidebarCss;
    // Permitted: token names like --duration-fast inside var(--…).
    // Forbidden: literal `0.1s` / `0.15s` / `0.2s` / `0.25s` /
    // `transition: all` / raw cubic-bezier.
    expect(all).not.toMatch(/\b0\.1[0-5]?s\b/);
    expect(all).not.toMatch(/\b0\.2s\b/);
    expect(all).not.toMatch(/\b0\.25s\b/);
    expect(all).not.toMatch(/transition:\s*all\b/);
    expect(all).not.toMatch(/cubic-bezier/);
  });
});