/**
 * Hospital AI OS — Frontend Navigation Helpers
 *
 * Pure functions used by AppShell/AppSidebar to determine active-route state.
 * Extracted from the sidebar render path so the contract can be exercised by
 * node-environment vitest without rendering React.
 *
 * The canonical nav item list and permission helpers remain in `utils/rbac.ts`
 * (per the M13 contract). This module only owns the active-route predicate,
 * which has its own acceptance criteria: `/tasks` must NOT match
 * `/tasks-archive`, `/dashboard` must be exact-only, etc.
 *
 * Hidden navigation is UX, not authorization. The backend (M5) remains the
 * authoritative boundary. This helper is presentational only.
 */

/**
 * Determine whether a sidebar item should appear active for the current
 * pathname.
 *
 * Rules:
 *  1. Exact match always wins.
 *  2. `/dashboard` is exact-only — siblings like `/dashboard-new` do NOT
 *     activate the dashboard entry (literal-prefix collision guard).
 *  3. Otherwise, the item is active when `pathname` begins with `href`
 *     AND the character immediately following the href boundary in
 *     `pathname` is either `/` (nested route) or the end-of-string.
 *     This prevents `/tasks` from activating for `/tasks-archive`.
 *
 * Inputs are not normalized; callers pass the raw `usePathname()` value
 * and the nav item href verbatim. Both are already lower-case URL paths
 * in this codebase, so no case-folding is performed.
 */
export function isNavItemActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === '/dashboard') return false;
  if (!pathname.startsWith(href)) return false;
  // Boundary check: the next character must be '/' (nested route) or end.
  const nextChar = pathname.charAt(href.length);
  return nextChar === '/' || nextChar === '';
}