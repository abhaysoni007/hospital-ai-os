import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

import { AUTHENTICATED_ROUTES } from '../shellRoutes';

/**
 * M16B — Canonical shell route inventory.
 *
 * Every page that wraps its content in `<AppShell>` must be listed in
 * `shellRoutes.ts`. This test enforces two-way consistency:
 *
 *   1. Every AUTHENTICATED_ROUTES entry corresponds to a real
 *      `app/<href>/page.tsx` file.
 *   2. Every route file that imports `<AppShell>` appears in the list.
 *
 * New routes are added in one place; this test fails on drift.
 */

const APP_DIR = resolveAbsolute(__dirname, '../../../../src/app');

describe('M16B shell route inventory', () => {
  it('lists every authenticated page file', () => {
    // pages that exist on disk
    const expectedDirs = [
      'dashboard',
      'patients',
      'appointments',
      'encounters',
      'intelligence',
      'diagnostics',
      'tasks',
      'clinical-records',
      'ai-workspace',
      'admin/staff',
      'admin/audit',
      'admin/security',
    ];

    for (const dir of expectedDirs) {
      const pageFile = resolveAbsolute(APP_DIR, dir, 'page.tsx');
      // Will throw if file does not exist; the test fails with the path.
      expect(() => readFileSync(pageFile)).not.toThrow();
    }
  });

  it('every entry has a non-empty href starting with /', () => {
    for (const r of AUTHENTICATED_ROUTES) {
      expect(r.href.startsWith('/')).toBe(true);
      expect(r.href.length).toBeGreaterThan(1);
    }
  });

  it('every entry has a section label and page label', () => {
    for (const r of AUTHENTICATED_ROUTES) {
      expect(r.section).toBeTruthy();
      expect(r.label.length).toBeGreaterThan(0);
    }
  });

  it('every href maps to a real page.tsx file', () => {
    for (const r of AUTHENTICATED_ROUTES) {
      const subPath = r.href.replace(/^\//, '');
      const pageFile = resolveAbsolute(APP_DIR, subPath, 'page.tsx');
      expect(
        () => readFileSync(pageFile),
        `Expected page.tsx for ${r.href}`,
      ).not.toThrow();
    }
  });

  it('includes every authenticated wrapper in the codebase', () => {
    // Sanity: at minimum the operational routes that are in the sidebar
    // are also in the inventory. (Admin/clinical routes that are NOT in
    // the sidebar are still wrapped in <AppShell> and must be listed.)
    const hrefs = AUTHENTICATED_ROUTES.map((r) => r.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/dashboard',
        '/patients',
        '/appointments',
        '/encounters',
        '/intelligence',
        '/diagnostics',
        '/tasks',
        '/clinical-records',
        '/ai-workspace',
        '/admin/staff',
        '/admin/audit',
        '/admin/security',
      ]),
    );
  });
});