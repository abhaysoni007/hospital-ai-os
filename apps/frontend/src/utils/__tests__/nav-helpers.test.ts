import { describe, expect, it } from 'vitest';

import { isNavItemActive } from '../nav-helpers';

/**
 * M16B — Active-route contract.
 *
 * The sidebar uses this helper to determine which nav item is currently
 * active. Rules (encoded by the implementation, asserted here):
 *
 *   1. Exact match always wins.
 *   2. `/dashboard` is exact-only — no prefix matching.
 *   3. Otherwise, prefix matches only when the next character is `/` or
 *      end-of-string (boundary check). This prevents `/tasks` from
 *      matching `/tasks-archive`.
 *   4. Null/undefined pathname never matches.
 */
describe('M16B nav helpers — isNavItemActive', () => {
  it('returns true for an exact match', () => {
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true);
    expect(isNavItemActive('/patients', '/patients')).toBe(true);
    expect(isNavItemActive('/patients/abc-123', '/patients/abc-123')).toBe(true);
  });

  it('matches nested routes via prefix + boundary', () => {
    expect(isNavItemActive('/patients/abc-123', '/patients')).toBe(true);
    expect(isNavItemActive('/encounters/123/clinical-records', '/encounters')).toBe(true);
    expect(isNavItemActive('/diagnostics/order-7/result/new', '/diagnostics')).toBe(true);
  });

  it('treats /dashboard as exact-only', () => {
    expect(isNavItemActive('/dashboard/anything', '/dashboard')).toBe(false);
    expect(isNavItemActive('/dashboard-new', '/dashboard')).toBe(false);
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true);
  });

  it('rejects sibling prefixes that share a string but not a path boundary', () => {
    expect(isNavItemActive('/tasks-archive', '/tasks')).toBe(false);
    expect(isNavItemActive('/patient', '/patients')).toBe(false);
    expect(isNavItemActive('/appointment', '/appointments')).toBe(false);
    expect(isNavItemActive('/encounters-x', '/encounters')).toBe(false);
  });

  it('returns false for empty / null / undefined pathname', () => {
    expect(isNavItemActive('', '/dashboard')).toBe(false);
    expect(isNavItemActive(null, '/dashboard')).toBe(false);
    expect(isNavItemActive(undefined, '/dashboard')).toBe(false);
  });

  it('returns false when href does not appear in pathname at all', () => {
    expect(isNavItemActive('/dashboard', '/patients')).toBe(false);
    expect(isNavItemActive('/encounters', '/diagnostics')).toBe(false);
  });
});