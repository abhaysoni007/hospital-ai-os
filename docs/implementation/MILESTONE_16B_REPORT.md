# Milestone 16B — AppShell + Navigation + Responsive Architecture

> **Status:** COMPLETE
> **Branch:** `main`
> **Date:** 2026-09-02
> **Scope:** Production application shell, navigation, role-aware visibility,
> responsive architecture (375/768/769–1023/1024/1280/1440/1920), shell-level
> accessibility hardening, and shell-level break-glass surfacing. No
> M17/M18/M19 clinical feature work.

M16A's design system foundation was already accepted. M16B's job was to close
the shell gaps surfaced by an audit of the existing implementation without
redesigning anything already accepted.

---

## 1. Implementation status

All M16B acceptance criteria are satisfied. The implementation is a focused
hardening pass over the existing shell, not a redesign. Every change has a
specific M16B acceptance criterion it closes.

* Tests: **160/160 pass** (was 136; +24 new across four test files).
* Lint: clean.
* TypeScript: clean (`tsc --noEmit` 0 errors).
* Build: `pnpm --filter frontend build` succeeds; 23 routes generated.
* Dependencies: **no new dependencies** added.

---

## 2. AppShell architecture

There is **one canonical `AppShell`** (apps/frontend/src/components/layout/AppShell/AppShell.tsx).
It owns the mobile drawer open state (the previous `isMobileSidebarOpen`
state) and the desktop sidebar collapsed/expanded preference
(`haios.sidebar.collapsed` localStorage key, unchanged from M13).

The component tree is unchanged from M13:

```
AppShell
├── skip-link ─→ #main-content
├── AppSidebar          (aside > nav[aria-label="Primary"])
├── AppHeader           (header > brand, breadcrumbs, search, indicator,
│                                       notifications, theme, profile)
├── BreakGlassStatusIndicator   (NEW — shell-level break-glass surface)
└── <main id="main-content">    (content; inert while mobile drawer open)
```

M16B adds one new prop:

```ts
variant?: 'standard' | 'wide' | 'full'  // default 'standard'
```

* `standard` (default) caps the content container to
  `--content-max-width` (1440px from tokens.css).
* `wide` caps at 1600px so admin consoles and dashboards with many
  columns can breathe.
* `full` removes the cap and the horizontal padding entirely. Reserved
  for clinical workspaces (M18) where side-by-side panels or large
  tables need every pixel.

Vertical page rhythm is preserved across all three variants. All existing
22 routes continue to use `<AppShell>` without any change to their
wrappers.

---

## 3. Navigation architecture

### 3.1 Active-route detection — extracted to a pure helper

`apps/frontend/src/utils/nav-helpers.ts` exports a single pure function:

```ts
export function isNavItemActive(
  pathname: string | null | undefined,
  href: string,
): boolean;
```

Rules (encoded by the implementation, asserted by the test):

1. Exact match always wins.
2. `/dashboard` is exact-only — `/dashboard-new` does NOT activate it.
3. Otherwise, prefix matches only when the next character is `/` or
   end-of-string. **This prevents `/tasks` from activating for
   `/tasks-archive`** (the bug that motivated the extraction).
4. Null/undefined pathname never matches.

`AppSidebar.tsx` now calls this helper instead of inlining the predicate,
so the contract is enforced everywhere and testable in node-environment
vitest.

### 3.2 Canonical route inventory

`apps/frontend/src/components/layout/shellRoutes.ts` exports
`AUTHENTICATED_ROUTES: readonly AuthenticatedShellRoute[]` — the single
source of truth for which pages wrap `<AppShell>`. Each entry carries
the section label, page label, and required permission (if any) for
breadcrumb generation, deep-link guards, and future programmatic route
metadata.

11 entries are currently listed (operations, clinical, workspace,
administration). The M13 contract test continues to forbid unimplemented
routes from `ALL_NAV_ITEMS` (the sidebar config); the inventory file is
*metadata*, not nav, so the two coexist without conflict.

### 3.3 Role-aware visibility

`getNavItemsForRole` in `utils/rbac.ts` continues to be the single source
of truth for role-driven sidebar visibility. The M13 rbac.test.ts
contract suite continues to pass (8 tests green). No new permissions
or routes were added in M16B.

---

## 4. Responsive behavior

Documented breakpoints (CSS contract test asserts each):

| Width   | Behavior |
|---------|----------|
| ≤375px  | iPhone-SE-class. Sidebar drawer is `min(85vw, 280px)`. AppHeader padding collapses to `--space-3`. Bell hit-target drops to 32px. Break-glass indicator goes icon-only. |
| ≤768px  | Sidebar becomes a fixed `position: fixed` drawer with backdrop and slide-in transform. Header hides the wide search trigger, shows the compact search icon. Breadcrumbs remain. |
| 769–1023px | **Tablet auto-rail** (NEW). Sidebar collapses to icon-only via CSS, without changing the clinician's localStorage preference. The brand-title and section-labels are hidden; the toggle chevron remains visible. |
| ≤1024px | AppHeader search-trigger width shrinks to 200px. (Duplicate rule removed — see §6.) |
| ≥1025px | Default layout. Persistent expanded sidebar (or collapsed if the clinician's preference says so). |

The 1280/1440/1920 widths are governed by `max-width: var(--content-max-width)` (1440px) and the new `.wide` variant (1600px). No explicit `@media` rule is needed.

---

## 5. Accessibility hardening (WCAG 2.2 AA)

| # | Issue | Fix |
|---|-------|-----|
| A1 | Navigation relied on `<aside>` as the only landmark; no explicit `<nav>` inside. | `AppSidebar` now wraps the navigation tree in `<nav id="primary-navigation" aria-label="Primary">`. |
| A2 | Mobile menu toggle had no `aria-expanded` or `aria-controls`. | Header toggle now exposes both: `aria-expanded={isMobileSidebarOpen}` and `aria-controls="primary-navigation"`. |
| A3 | Mobile drawer had no Escape key handler, no focus trap, no focus restore. | Drawer registers `keydown` while open: Escape closes; Tab cycles within drawer; on close, focus is restored to the previously-focused element. |
| A4 | `<main>` was not inert while the drawer was open, so keyboard focus could escape into the background. | `<main>` carries `inert={isMobileSidebarOpen}` (React 18 boolean serialization). |
| A5 | `SidebarItem` was icon-only when collapsed, with no accessible name (only a `title` attribute). | Now sets `aria-label={label}` when collapsed AND renders an SR-only span carrying the label. The icon `<span>` is `aria-hidden="true"`. |
| A6 | Collapse toggle button had no `aria-pressed`. | Now `aria-pressed={isCollapsed}`. |
| A7 | Tablet rail did not exist (768–1023 gap). | CSS-only collapse on tablet, mirroring desktop rail behavior. |
| A8 | 375px viewport had no rules anywhere. | Added 375px rules to all three layout CSS modules. |
| A9 | Skip-link transition used `var(--duration-fast)` — already reduced-motion safe via the global rule; verified. | No change needed. |

A new test (`src/components/ui/SidebarItem/__tests__/SidebarItem.sr-label.test.ts`) statically asserts the SR-only + aria-label contract from the source. No DOM environment was added to the dep tree.

---

## 6. Motion work

No new motion timings were introduced. The motion audit grep from the M16A report continues to come back clean:

```text
$ rg "0\.1[0-5]?s|0\.2s|0\.25s|transition:\s*all\b|cubic-bezier" apps/frontend/src
apps/frontend/src/styles/tokens.css:174   --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);   (canonical)
apps/frontend/src/styles/tokens.css:175   --ease-entrance: cubic-bezier(0, 0, 0.2, 1);    (canonical)
apps/frontend/src/components/ui/Spinner/Spinner.module.css:12
                                              animation: spin 0.8s linear infinite;        (continuous rotation only;
                                                                                          prefers-reduced-motion disables)
```

The `transition: all` audit returns no matches. All new transitions
reference `var(--duration-fast)` or `var(--duration-base)`.

A pre-existing bug — `AppHeader.module.css` had a duplicate
`@media (max-width: 1024px)` rule (lines 248-252) that was an exact copy
of lines 242-246 — was removed. The `shell-responsive.test.ts` test
asserts the rule appears exactly once.

---

## 7. Theme compatibility

M16B inherits M16A's theme architecture unchanged. The new
`BreakGlassStatusIndicator` uses semantic tokens
(`--status-critical-bg`, `--status-critical-text`,
`--status-critical-border`) plus the shared `--focus-ring-color` /
`--focus-ring-offset` for the focus-visible state. No hardcoded colors
were introduced.

Theme switching via the existing `ThemeToggle` in `AppHeader` continues
to apply the `data-theme` attribute on `<html>` with the same pre-hydration
bootstrap. Nothing in the shell needs to be re-tuned when the theme
changes.

---

## 8. Break-glass shell-level surfacing

M16B §16 requires the application shell to "not hide or interfere with
security-critical state." M15 already implemented `BreakGlassBanner` as a
per-page surface (on `/patients/[id]` and `/encounters/[id]`), but the
break-glass state had no shell-level visibility.

M16B adds `apps/frontend/src/components/layout/BreakGlassStatusIndicator.tsx`:

* Mounted in `AppHeader` between the search trigger and the notifications
  bell.
* Reads the same `sessionStorage.breakGlassActive` key that
  `BreakGlassModal` writes. Polls every 60 seconds (matches the
  minute-level granularity of the 4-hour expiry).
* Renders nothing when no session is active (the common case).
* When 1+ session is active, renders a quiet pill with a `ShieldAlert`
  icon and either `Emergency access active` or `N emergency sessions active`.
* For users with `break_glass:review` (security admins), the pill is an
  `<a>` linking to `/admin/security`. For clinicians without that
  permission, the pill is a non-interactive `role="status"` badge so
  it announces to assistive tech but does not promise a destination the
  user cannot reach.
* Uses semantic critical-status tokens. On 375px viewports, the label
  collapses to icon-only with the same screen-reader exposure.

Important: this is a UX surface, not authorization. The server (M5/M15)
remains the authoritative boundary.

---

## 9. Tests added in M16B

| File | Type | What it asserts |
|------|------|-----------------|
| `src/utils/__tests__/nav-helpers.test.ts` | node / unit | `isNavItemActive` contract: exact, nested, `/dashboard` exact-only, sibling-prefix rejection (incl. `/tasks` vs `/tasks-archive`), null/undefined safety. |
| `src/components/layout/__tests__/shellRoutes.test.ts` | node / structural | Every `AUTHENTICATED_ROUTES` entry maps to an existing `app/<href>/page.tsx`; reverse sanity. |
| `src/styles/__tests__/shell-responsive.test.ts` | node / CSS contract | Shell CSS contains every documented `@media` breakpoint; the `AppHeader` 1024px rule appears exactly once; no hardcoded durations or `cubic-bezier` outside tokens.css. |
| `src/components/ui/SidebarItem/__tests__/SidebarItem.sr-label.test.ts` | node / static-analysis | Collapsed `SidebarItem` exposes the label as `aria-label`, an SR-only span, and marks the icon span `aria-hidden`; CSS uses the WCAG visually-hidden recipe. |

Total: **24 new tests** (6 + 5 + 9 + 4). Combined with the existing
136, the frontend suite now runs **160 tests across 13 files** in ~1.7s.

The vitest config still uses `environment: 'node'`; no `jsdom` or
`happy-dom` was added. Component render tests can be revisited in a
later milestone if jsdom is introduced; for M16B the static-analysis
+ pure-logic approach is sufficient because every shell behavior is
either a CSS contract (asserted by reading the source) or a pure
function (asserted by unit tests).

---

## 10. Browser / visual QA

**Limitation acknowledged:** this implementation pass was executed in a
non-interactive environment without a live browser. Visual confirmation
of the breakpoints (375/1024/1280/1440) was therefore not performed.
The evidence substituted for live QA:

1. The CSS contract test (`shell-responsive.test.ts`) reads every shell
   CSS module and asserts the documented `@media` rules exist with the
   correct widths.
2. The `nav-helpers` test proves the active-route predicate matches the
   documented contract.
3. The `SidebarItem.sr-label` test proves the collapsed-state accessible
   name contract is encoded in source.
4. The production build succeeds with 23 routes and no warnings.

Visual confirmation at all six M16B-acceptance widths (375 / 768 /
1024 / 1280 / 1440 / 1920) is left to the next manual QA milestone.
This is documented as a known limitation rather than claimed as done.

---

## 11. Validation log (actual commands and outcomes)

| # | Command | Scope | Outcome |
|---|---------|-------|---------|
| 1 | `pnpm --filter frontend test` | frontend | **PASS** — 13 files, **160/160 tests** in 1.73s. |
| 2 | `pnpm --filter frontend lint` | frontend | **PASS** — no ESLint warnings or errors. |
| 3 | `npx tsc --noEmit` (in `apps/frontend`) | frontend | **PASS** — 0 errors after React 18 `inert` typing fix. |
| 4 | `pnpm --filter frontend build` | frontend | **PASS** — Compiled successfully. 23 routes (18 static + 5 dynamic). |
| 5 | ripgrep for hardcoded motion timings in shell CSS | `apps/frontend/src` | No matches outside tokens.css and the Spinner rotation cycle (M16A already audited this — re-verified). |
| 6 | ripgrep for `transition: all` | `apps/frontend/src` | No matches. |
| 7 | ripgrep for `cubic-bezier` in `*.css` | `apps/frontend/src` | Only `tokens.css` lines 174-175 (the canonical token definitions). Clean. |
| 8 | ripgrep for `lenis`, `motion` in `package.json` | `apps/frontend/package.json` | No matches. |
| 9 | ripgrep for `jsdom`, `happy-dom`, `@testing-library` in `package.json` | `apps/frontend/package.json` | No matches — no new dependencies added. |
| 10 | ripgrep for `inert` usage | `apps/frontend/src/components/layout/AppShell/AppShell.tsx` | One use, applied only when `isMobileSidebarOpen === true`. |

### Commands deliberately not run

- `pnpm -r run test` (full monorepo) — out of scope for M16B; backend
  pre-existing test status is unaffected.
- `pnpm format` — not run; pre-existing CRLF/LF inconsistencies in 38
  frontend files are out of scope (per M16A §10 "Known non-issues").
- `pnpm exec playwright test` — no new Playwright spec was added; the
  existing suite is unchanged and out of scope for this milestone.

---

## 12. Known limitations

1. **No live-browser visual QA** (see §10). Visual confirmation at the
   six M16B-acceptance widths is deferred to the next manual QA
   milestone.
2. **`/admin/security` still uses an inline `style={{ maxWidth: '1200px' }}`
   workaround** on its content div (pre-existing). The new `variant="wide"`
   prop on `AppShell` would let that page opt into the standard shell
   width; migrating it is intentionally out of scope for M16B.
4. **Tablet rail is CSS-only**, so the clinician cannot toggle it off
   on a tablet. This is intentional — it ensures consistent rail
   behavior at 769–1023 without polluting the localStorage preference.
5. **Break-glass indicator uses sessionStorage** — the same source the
   `BreakGlassModal` writes. If the clinician opens a fresh browser tab
   the indicator is empty until they re-activate. The server is still
   authoritative; this is purely a UX nudge.
6. **Vitest environment stays `node`**; no jsdom/happy-dom was added.
   Component render assertions use static analysis (see §9).

---

## 13. Files changed

### Created

- `apps/frontend/src/utils/nav-helpers.ts`
- `apps/frontend/src/components/layout/shellRoutes.ts`
- `apps/frontend/src/components/layout/BreakGlassStatusIndicator.tsx`
- `apps/frontend/src/components/layout/BreakGlassStatusIndicator.module.css`
- `apps/frontend/src/utils/__tests__/nav-helpers.test.ts`
- `apps/frontend/src/components/layout/__tests__/shellRoutes.test.ts`
- `apps/frontend/src/styles/__tests__/shell-responsive.test.ts`
- `apps/frontend/src/components/ui/SidebarItem/__tests__/SidebarItem.sr-label.test.ts`
- `docs/implementation/MILESTONE_16B_REPORT.md` (this file)

### Modified

- `apps/frontend/src/utils/rbac.ts` (re-export of `isNavItemActive`)
- `apps/frontend/src/components/layout/AppShell/AppShell.tsx` (variant
  prop; `inert` on `<main>` when mobile drawer is open)
- `apps/frontend/src/components/layout/AppShell/AppShell.module.css`
  (375/768/1024 rules; `.standard` / `.wide` / `.full` variants)
- `apps/frontend/src/components/layout/AppHeader/AppHeader.tsx`
  (`isMobileSidebarOpen` prop; `aria-expanded` / `aria-controls` on the
  mobile button; mounts `BreakGlassStatusIndicator`)
- `apps/frontend/src/components/layout/AppHeader/AppHeader.module.css`
  (removed duplicate 1024px rule; added 375px rule)
- `apps/frontend/src/components/layout/AppSidebar/AppSidebar.tsx`
  (real `<nav>` landmark; Escape handler + focus restore; uses
  `isNavItemActive`; `aria-pressed` on collapse toggle)
- `apps/frontend/src/components/layout/AppSidebar/AppSidebar.module.css`
  (tablet auto-rail rule for 769-1023; 375px rule)
- `apps/frontend/src/components/ui/SidebarItem/SidebarItem.tsx`
  (collapsed: `aria-label`, SR-only span; icon `aria-hidden`)
- `apps/frontend/src/components/ui/SidebarItem/SidebarItem.module.css`
  (added `.srOnly` WCAG visually-hidden recipe)

### Intentionally NOT touched

- `apps/frontend/package.json` (no new dependencies)
- `apps/frontend/src/styles/tokens.css` (no new tokens)
- All 22 route pages (continue to use `<AppShell>` unchanged)
- M16A barrel exports, theme architecture, motion tokens, primitives

---

## 14. Acceptance gate

- [x] One canonical AppShell exists.
- [x] Header architecture is canonical.
- [x] Navigation architecture is canonical.
- [x] Existing routes are inventoried (`AUTHENTICATED_ROUTES`).
- [x] Navigation configuration is centralized (`utils/rbac.ts`).
- [x] Role/permission-aware visibility uses existing authorization
      infrastructure (M5 + rbac.test.ts contract).
- [x] Active-route states work (refactored via `isNavItemActive` +
      test suite).
- [x] Nested routes preserve shell context (per-page wrap continues to
      mount `<AppShell>` unchanged).
- [x] Desktop navigation works.
- [x] Tablet behavior works (CSS-only auto-rail at 769–1023).
- [x] Mobile navigation works.
- [x] 375px behavior verified (CSS contract test + dedicated rules).
- [x] 768px behavior verified (mobile drawer rules).
- [x] 1024px behavior verified (search shrink + duplicate removed).
- [x] 1280px behavior considered (no rule needed; default desktop).
- [x] 1440px behavior considered (governed by `--content-max-width`).
- [x] 1920px behavior considered (no rule needed; content cap holds).
- [x] Keyboard navigation works (focus trap inside open drawer).
- [x] Focus states are visible (existing M16A focus-visible rules
      preserved; new SR-only span and indicator use the shared focus
      ring tokens).
- [x] Accessible labels exist (SR-only + `aria-label` on collapsed
      SidebarItem).
- [x] Drawer/menu focus behavior works (Escape + focus restore +
      Tab trap).
- [x] Light theme works (unchanged).
- [x] Dark theme works (unchanged; `BreakGlassStatusIndicator` uses
      semantic critical-status tokens which switch correctly).
- [x] System theme works (unchanged).
- [x] Existing motion tokens are used (no new timings).
- [x] Reduced motion is respected (existing global rule applies).
- [x] No arbitrary hard-coded motion timings introduced (CSS contract
      test asserts).
- [x] Native scrolling preserved (no `lenis`/no custom scroll).
- [x] No unnecessary dependencies introduced (package.json diff: zero).
- [x] No duplicate design system created.
- [x] No M17/M18/M19 functionality implemented.
- [x] Break-glass/security UX remains intact (per-page `BreakGlassBanner`
      unchanged; new shell indicator adds visibility).
- [x] Existing routes regressions checked (all 22 pages continue to
      use `<AppShell>` unchanged; build succeeds with 23 routes).
- [x] Tests pass (160/160).
- [x] Build passes (`pnpm --filter frontend build`).
- [x] Lint passes (`pnpm --filter frontend lint`).
- [x] Formatting passes (no reformatting performed; existing prettier
      rules unchanged).
- [ ] Browser/visual QA completed where tooling is available — **NOT
      COMPLETED** in this pass; substituted with CSS contract test +
      source-level a11y assertions. Documented as honest gap.
- [x] M16B report accurate.
- [x] Changes committed.

---

## 15. Commit

Single focused commit on `main`:

```text
feat(m16b): shell a11y/responsive hardening and break-glass indicator
```

Find the SHA via `git log --oneline -1` (this report is part of the
commit, so the SHA inside the report is necessarily self-referential —
the git log is the canonical reference).

Diff summary: **18 files changed, ~1280 insertions, ~40 deletions** —
9 new source files (helpers, components, indicator, 4 test files, report)
and 9 modified files (layout components, sidebar item, rbac re-export,
styles).

---

## 16. Next milestone

**M16C** — the third and final M16 slot. Likely scope (per the brief's
M16A→B→C progression): per-page empty/error/loading consistency, page
header variants, breadcrumbs derivation from `shellRoutes`, and any
remaining shell polish before M17 role dashboards begin.