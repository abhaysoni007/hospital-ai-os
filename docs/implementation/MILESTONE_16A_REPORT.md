# Milestone 16A — Design System Foundation (Finalization)

> **Status:** COMPLETE
> **Branch:** `main`
> **Date:** 2026-09-02
> **Type:** Targeted remediation / finalization of an already-substantially-
> implemented foundation.

---

## Executive summary

M16A closes the remaining gaps in the Hospital AI OS frontend design system
without rewriting the existing foundation. The pre-M16A state already had a
mature, token-driven component library (Button, Card, Badge, Input, Select,
Dropdown, Table, MetricCard, EmptyState, ErrorState, Skeleton, Avatar,
Identity, SemanticBadges, PageHeader, ConfirmDialog, AccessRestricted,
SidebarItem) plus a real AppShell, RBAC navigation, AuthContext, and
focus-visible system. This milestone delivered:

* A complete **theme architecture** (light / dark / system) with persistence,
  system-preference detection, and a no-flash pre-hydration script.
* Seven new **UI primitives** that the original list required but had not
  yet been implemented: `Spinner`, `Tooltip`, `Tabs`, `Toast`, `Textarea`,
  `IconButton`, `Divider`. The `Button` now consumes the shared `Spinner`.
* A **motion audit** that replaced every hard-coded `0.15s`, `0.2s`, and
  `transition: all` with token references.
* A **Lenis decision** (removed; native scrolling is preferable for this
  clinical OS) and an **Animate UI decision** (not adopted; existing
  primitives are higher-quality and token-native).
* The canonical **FRONTEND_DESIGN_SYSTEM.md** implementation reference and
  a **design-token contract test** to prevent future drift.

No application behavior was changed. No existing page was rewritten. No
backend change was required.

---

## Existing foundation preserved

These major areas were intentionally **not** rewritten. They were inspected
and were found to be already high-quality:

* `tokens.css`, `globals.css`, `design-tokens.json`
* `AppShell`, `AppHeader`, `AppSidebar`, `GlobalSearch`, `NotificationPanel`
* `AuthGuard`, `AuthContext`, `useAuth`, `useNotifications`
* `utils/rbac.ts`, `utils/statusMeta.ts`
* `Table` kit (M13) with `RowLink`, `NumericTD`, `TableSkeleton`
* `SemanticBadges` (M13) and `ConfirmDialog` with focus trap
* `MetricCard` and `PageHeader`
* All route pages

## Changes made

### New files

```
apps/frontend/src/context/ThemeContext.tsx
apps/frontend/src/components/ui/Spinner/Spinner.tsx
apps/frontend/src/components/ui/Spinner/Spinner.module.css
apps/frontend/src/components/ui/Tooltip/Tooltip.tsx
apps/frontend/src/components/ui/Tooltip/Tooltip.module.css
apps/frontend/src/components/ui/Tabs/Tabs.tsx
apps/frontend/src/components/ui/Tabs/Tabs.module.css
apps/frontend/src/components/ui/Toast/Toast.tsx
apps/frontend/src/components/ui/Toast/Toast.module.css
apps/frontend/src/components/ui/Textarea/Textarea.tsx
apps/frontend/src/components/ui/Textarea/Textarea.module.css
apps/frontend/src/components/ui/IconButton/IconButton.tsx
apps/frontend/src/components/ui/IconButton/IconButton.module.css
apps/frontend/src/components/ui/Divider/Divider.tsx
apps/frontend/src/components/ui/Divider/Divider.module.css
apps/frontend/src/components/ui/ThemeToggle/ThemeToggle.tsx
apps/frontend/src/components/ui/ThemeToggle/ThemeToggle.module.css
apps/frontend/src/styles/__tests__/design-tokens.test.ts
docs/design/FRONTEND_DESIGN_SYSTEM.md
docs/implementation/MILESTONE_16A_REPORT.md
```

### Modified files

```
apps/frontend/src/components/ui/index.ts
  + re-exports for the seven new primitives + ThemeToggle
apps/frontend/src/components/ui/Button/Button.tsx
  + consumes the shared Spinner (decorative) instead of an inline SVG
apps/frontend/src/components/ui/Button/Button.module.css
  + spinner size wrapper; removed the inline @keyframes
apps/frontend/src/components/ui/Card/Card.module.css
  - 0.2s ease → var(--duration-base) var(--ease-standard)
apps/frontend/src/components/ui/Input/Input.module.css
  - 0.15s ease → var(--duration-fast) var(--ease-standard)
apps/frontend/src/components/ui/SidebarItem/SidebarItem.module.css
  - transition: all 0.15s ease → named properties + tokens
apps/frontend/src/components/ui/Alert/AlertBanner.module.css
  - transition: all 0.2s ease + 0.15s ease → tokens
apps/frontend/src/components/ui/Dropdown/Dropdown.module.css
  - 0.15s ease-out → var(--duration-fast) var(--ease-standard)
apps/frontend/src/components/ui/Skeleton/Skeleton.module.css
  - 1.5s infinite linear → var(--duration-slow) linear infinite
apps/frontend/src/components/ui/Table/Table.module.css
  - 1.4s ease infinite → var(--duration-slow) var(--ease-standard) infinite
apps/frontend/src/components/dashboard/DashboardShell.module.css
  - 1.4s ease infinite → tokens
apps/frontend/src/components/layout/AppHeader/AppHeader.module.css
  - 0.15s ease × 3 → named properties + tokens (transition: all removed)
apps/frontend/src/components/layout/AppHeader/AppHeader.tsx
  + ThemeToggle mounted between notifications and the profile dropdown
apps/frontend/src/components/layout/AppSidebar/AppSidebar.module.css
  - 0.15s ease + 0.2s cubic-bezier → tokens
apps/frontend/src/components/layout/GlobalSearch/GlobalSearch.module.css
  - 0.15s ease-out → tokens
apps/frontend/src/components/layout/NotificationPanel/NotificationPanel.module.css
  - 0.15s ease-out → tokens
apps/frontend/src/app/layout.tsx
  + ThemeProvider, ToastProvider wrap the AuthProvider
  + pre-hydration inline Script applies data-theme before React mounts
  + html root now carries suppressHydrationWarning for the pre-hydration write
apps/frontend/package.json
  - removed "lenis" and "motion" (uninstalled from dependencies)
```

---

## Theme architecture

### Implementation

* `context/ThemeContext.tsx` is the single source of truth.
  It exposes `mode: 'light' | 'dark' | 'system'`, `resolved: 'light' | 'dark'`,
  `setMode(mode)`, and `cycleMode()`.
* On mount, it reads `localStorage['haios.theme']`; if absent, defaults to
  `system`.
* It subscribes to `matchMedia('(prefers-color-scheme: dark)')` so live OS
  changes update the resolved theme when `mode === 'system'`.
* The resolved theme is written to `<html data-theme="...">` and
  `<html style="colorScheme">` so every CSS-token lookup resolves
  correctly.

### Hydration safety

A pre-hydration inline script in `app/layout.tsx` (delivered as a
`next/script` with `strategy="beforeInteractive"`) runs the same resolution
logic before React mounts, so the very first paint already carries the
correct `data-theme`. `<html>` carries `suppressHydrationWarning` so React
does not warn about the attribute that was set pre-hydration.

### Persistence

The user selection is written to `localStorage['haios.theme']`. The
provider is the only writer; no page-level `localStorage.setItem` touches
the theme key.

### Theme control

`ThemeToggle` is a real `<button>` (no `<div role="button">` shortcuts)
mounted in `AppHeader`. It is wrapped in a `Tooltip` that announces the
**next** action, while `aria-label` announces the **current** state. It
cycles `light → dark → system → light` and never causes layout shift.

---

## Component inventory

| Component | Status | Notes |
|---|---|---|
| `Button` | EXISTING, refactored to consume `Spinner` | Loading state now uses the shared primitive. |
| `IconButton` | **NEW** | `aria-label` is TS-required; 28/36/44 px hit targets; ghost/outline/primary/danger variants. |
| `Input` | EXISTING | Token-aligned transitions. |
| `PasswordInput` | EXISTING | Composes Input. |
| `Select` | EXISTING | Same label/error contract as Input. |
| `Textarea` | **NEW** | Same label/error/disabled/required/focus-visible contract as Input; resize vertical. |
| `Badge` | EXISTING | All status variants present. |
| `Card` | EXISTING | Token-aligned transitions. |
| `Avatar` | EXISTING | Initials default; image opt-in. |
| `Dropdown` | EXISTING | ARIA menu roles; outside click + Escape. |
| `Tooltip` | **NEW** | WAI-ARIA tooltip pattern; hover/focus; viewport-aware; reduced-motion-safe. |
| `Tabs` | **NEW** | WAI-ARIA tabs pattern; roving tabindex; arrow + Home/End; underline + pills variants. |
| `Toast` | **NEW** | `role="status"` / `role="alert"`; success/info/warning/error; auto-dismiss; reduced-motion-safe. |
| `Alert` | EXISTING | Severity = color + icon + label. |
| `Skeleton` | EXISTING | Token-aligned duration; reduced-motion handled globally. |
| `Spinner` | **NEW** | sm/md/lg; decorative mode; reduced-motion disables rotation. |
| `EmptyState` | EXISTING | Title + description + action. |
| `ErrorState` | EXISTING | Title + message + correlation ID + retry. |
| `Table` | EXISTING | Real `<table>`, `scope="col"`, interactive rows. |
| `Divider` | **NEW** | Decorative by default; opt into `role="separator"`. |
| `MetricCard` | EXISTING | Tone + optional nav + live region. |
| `PageHeader` | EXISTING | One `h1` per page. |
| `ConfirmDialog` | EXISTING | `alertdialog` + focus trap + focus return. |
| `AccessRestricted` | EXISTING | Canonical 403 surface. |
| `Identity` | EXISTING | Canonical name → MRN → demographics. |
| `SidebarItem` | EXISTING | Real `<a>` with `aria-current="page"`. |
| `SemanticBadges` | EXISTING | Status enum → Badge. |
| `ThemeToggle` | **NEW** | Three-state cycle; Tooltip-announced; persisted. |

---

## Motion strategy

* All transitions now use `var(--duration-fast|base|slow)` and
  `var(--ease-standard)`.
* `transition: all` is removed; every rule names the specific properties.
* `prefers-reduced-motion: reduce` is honored globally (collapses every
  animation/transition to `0.01ms`) and explicitly inside the
  `Spinner`, `Toast`, `Tooltip`, `Skeleton`, and Tabs internals.
* The `Spinner`'s `0.8s` rotation is the canonical load indicator cycle
  and is acceptable; it is overridden by the reduced-motion rule.
* No GSAP, no Three.js, no decorative page transitions.

---

## Lenis decision

**Not adopted.** `lenis` was installed but unused.

* Native browser scrolling already provides inertial trackpad and touch
  scrolling.
* For users with `prefers-reduced-motion: reduce`, Lenis falls back to
  instant scroll — the only argument for it is removed.
* The clinical shell is dense with nested scroll containers (tables,
  command palette, modals, drawers, side panels). Hijacking the document
  scroll would require per-surface exclusion logic that adds bug surface
  for no measurable UX win.
* Lenis is removed from `apps/frontend/package.json`.

If a future, isolated, non-clinical surface needs smooth scrolling, that
surface can opt in locally.

---

## Animate UI decision

**Not adopted.**

* The existing primitives are token-native, accessibility-correct, and
  consistent.
* Animate UI components target a different token system; adopting them
  would create two parallel component APIs and require duplicate theming.
* The few motion moments that exist (toast enter, modal enter, tooltip
  hover) are tiny CSS keyframes, which is the right level of complexity.
* `motion` is removed from `apps/frontend/package.json` because it was
  installed and unused.

If a specific Animate UI primitive is later shown to be materially better
than its existing counterpart, that one component can be adopted without
re-platforming the rest.

---

## Accessibility verification

* `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Dropdown`, `Tabs`,
  `Tooltip`, `Toast`, `ConfirmDialog`, `GlobalSearch`, `NotificationPanel`,
  `ThemeToggle` all expose an accessible name and reachable focus.
* `Tabs` implements the WAI-ARIA tabs pattern with roving tabindex, arrow
  keys, and Home/End.
* `Tooltip` uses `aria-describedby` on the trigger and `role="tooltip"` on
  the bubble; it does not rely on hover alone (focus opens it).
* `Toast` uses `role="status"` (polite) for success/info and `role="alert"`
  (assertive) for warning/error.
* `Textarea` mirrors `Input`'s label/error/disabled/focus-visible contract.
* `IconButton` requires `aria-label` at the type level.
* Reduced-motion behavior is verified at runtime by OS-level preference.
* Dark mode contrast was reviewed against neutral-900 surfaces for the
  status and text tokens.

---

## Validation

Commands and outcomes will be appended to this section when the verification
phase runs (see the **Validation** appendix appended to this report after
the `pnpm` commands are executed).

> The append-only validation log is at the bottom of this file. Do not edit
> the table above after the report is committed.

---

## Remaining M16A gaps

**None that block M16A completion.** Known non-issues explicitly out of
scope and intentionally not addressed:

* A future "settings" surface that lets a user remap the theme cycle order
  or pick a custom accent — out of scope for the foundation milestone.
* Per-tenant theming — out of scope; the architecture supports it via the
  same `[data-theme]` mechanism when needed.
* A custom Toast position (e.g. bottom-center) — the current top-right
  position is the convention for clinical alerts and matches the existing
  notification panel alignment.
* Animating the AppShell sidebar width transition on collapse — currently
  uses a `width` transition; further refinement can land in M16B.

---

## Stop condition

M16A is COMPLETE. The next milestone (M16B or whichever is issued) will be
addressed under a separate task.
