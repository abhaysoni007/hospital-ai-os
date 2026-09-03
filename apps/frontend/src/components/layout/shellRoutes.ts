/**
 * Hospital AI OS — Canonical Shell Route Inventory
 *
 * Single source of truth for which Next.js pages are wrapped by the
 * authenticated `<AppShell>`. Used by:
 *
 *   - The M16B shellRoutes test (asserts every wrapped route is listed here).
 *   - Documentation in `MILESTONE_16B_REPORT.md`.
 *   - Future programmatic route metadata (deep-link guards, breadcrumbs,
 *     per-route permission gating) — kept here so the list does not scatter
 *     across components.
 *
 * Hidden navigation is UX, not authorization. Routes listed here are still
 * gated by `AuthGuard` (authenticated) and the page-level `requiredPermission`
 * prop on `<AppShell>`. Unauthenticated routes (`/login`) are intentionally
 * absent.
 *
 * Adding a new authenticated route?
 * 1. Create `app/<route>/page.tsx` wrapping with `<AppShell>`.
 * 2. Add the route to this list with its required permission (if any) and
 *    the human section label used in breadcrumbs.
 * 3. Add a matching assertion to `shellRoutes.test.ts`.
 */

import type { Permission } from '../../types/auth';

export interface AuthenticatedShellRoute {
  /** URL path prefix. Must start with `/`. */
  href: string;
  /** Section label rendered as the first breadcrumb crumb. */
  section: 'Operations' | 'Clinical' | 'Workspace' | 'Administration' | 'Account';
  /** Human-readable page label, used as the second breadcrumb crumb by default. */
  label: string;
  /** Permission required by `AuthGuard` via AppShell's `requiredPermission` prop. */
  requiredPermission?: Permission;
}

export const AUTHENTICATED_ROUTES: readonly AuthenticatedShellRoute[] = [
  // Operations — operational mission control surfaces
  { href: '/dashboard', section: 'Operations', label: 'Dashboard' },
  {
    href: '/patients',
    section: 'Operations',
    label: 'Patients',
    requiredPermission: 'patient:read',
  },
  {
    href: '/appointments',
    section: 'Operations',
    label: 'Appointments',
    requiredPermission: 'appointment:read',
  },
  {
    href: '/encounters',
    section: 'Operations',
    label: 'Encounters',
    requiredPermission: 'encounter:read',
  },
  {
    href: '/intelligence',
    section: 'Operations',
    label: 'Intelligence',
    requiredPermission: 'intelligence:read',
  },

  // Clinical — diagnostic + clinical record surfaces
  {
    href: '/diagnostics',
    section: 'Clinical',
    label: 'Diagnostics',
    requiredPermission: 'diagnostic_order:read',
  },
  {
    href: '/clinical-records',
    section: 'Clinical',
    label: 'Records',
    requiredPermission: 'clinical_record:read',
  },

  // Workspace — clinician personal task + AI surfaces
  {
    href: '/tasks',
    section: 'Workspace',
    label: 'My Work',
    requiredPermission: 'task:read',
  },
  {
    href: '/ai-workspace',
    section: 'Workspace',
    label: 'AI Assistance',
    requiredPermission: 'ai_interaction:invoke',
  },

  // Administration — admin/security surfaces
  {
    href: '/admin/staff',
    section: 'Administration',
    label: 'Staff Management',
    requiredPermission: 'staff:manage',
  },
  {
    href: '/admin/audit',
    section: 'Administration',
    label: 'Audit',
    requiredPermission: 'audit_event:read',
  },
  {
    href: '/admin/security',
    section: 'Administration',
    label: 'Security',
    requiredPermission: 'break_glass:review',
  },
] as const;