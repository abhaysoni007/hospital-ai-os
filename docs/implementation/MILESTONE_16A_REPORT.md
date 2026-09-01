# Milestone 16A — Design System Foundation (Correction Pass)

> **Status:** COMPLETE
> **Branch:** `main`
> **Date:** 2026-09-02
> **Type:** Reconciliation pass. The M16A source files (new primitives,
> `ThemeContext`, `ThemeToggle`, design-token contract test,
> `FRONTEND_DESIGN_SYSTEM.md`) landed on `main` in commit `9e572a8`, but
> the integration steps (barrel exports, motion audit, Button → shared
> Spinner, `ThemeProvider` mount, `ThemeToggle` mount) were never
> committed. This pass reconciles the actual repository with the
> M16A acceptance criteria.

---

## 1. Root cause of the previous mismatch

The previous M16A report described work that existed only in a local
working tree. When commit `9e572a8 feat: add frontend UI components,
break-glass fixes, e2e tests, and milestone reports` landed, it imported
the **source files** for the new primitives but did not include:

* the `components/ui/index.ts` barrel updates that re-export them,
* the motion-token migration across existing components,
* the `Button` refactor to consume the shared `Spinner`,
* the `ThemeProvider` / `ToastProvider` / pre-hydration script in
  `app/layout.tsx`,
* the `ThemeToggle` mount in `AppHeader`.

`docs/design/FRONTEND_DESIGN_SYSTEM.md` and the design-token contract
test were also not present on `main` even though they existed in the
working tree.

This pass treats the **repository** as authoritative, fixes every verified
discrepancy, and updates this report with the actual validation log.

---

## 2. Files actually changed in this pass

### Barrel exports (CRITICAL fix)
* `apps/frontend/src/components/ui/index.ts` — added re-exports for
  `IconButton`, `Textarea`, `Spinner`, `Tooltip`, `Tabs`, `Toast`,
  `Divider`, and `ThemeToggle`. All seven new primitives are now
  discoverable via the canonical barrel.

### Motion-token migration (CRITICAL fix)

Every hard-coded `0.15s` / `0.2s` / `0.12s` / `0.25s` /
`transition: all` / inline `cubic-bezier(...)` in production component
CSS was replaced with `var(--duration-...)` + `var(--ease-standard)`.
Affected files:

* `apps/frontend/src/components/ui/Button/Button.module.css`
* `apps/frontend/src/components/ui/Card/Card.module.css`
* `apps/frontend/src/components/ui/Input/Input.module.css`
* `apps/frontend/src/components/ui/SidebarItem/SidebarItem.module.css`
* `apps/frontend/src/components/ui/Alert/AlertBanner.module.css`
* `apps/frontend/src/components/ui/Dropdown/Dropdown.module.css`
* `apps/frontend/src/components/ui/Skeleton/Skeleton.module.css`
* `apps/frontend/src/components/ui/Table/Table.module.css`
* `apps/frontend/src/components/dashboard/DashboardShell.module.css`
* `apps/frontend/src/components/layout/AppHeader/AppHeader.module.css`
* `apps/frontend/src/components/layout/AppSidebar/AppSidebar.module.css`
* `apps/frontend/src/components/layout/GlobalSearch/GlobalSearch.module.css`
* `apps/frontend/src/components/layout/NotificationPanel/NotificationPanel.module.css`

A `grep` for `0.15s|0.2s|0.12s|0.25s|transition: all|cubic-bezier`
across `apps/frontend/src` now returns only:

* `apps/frontend/src/styles/tokens.css` — the canonical token
  definitions themselves (correct, intentional).
* `apps/frontend/src/components/ui/Spinner/Spinner.module.css` — the
  Spinner's `animation: spin 0.8s linear infinite;` rotation cycle,
  the only legitimate animation-only value. It is paired with an
  explicit `prefers-reduced-motion: reduce` block that disables the
  rotation. (See §6 below.)

### Button now consumes the shared Spinner (CRITICAL fix)
* `apps/frontend/src/components/ui/Button/Button.tsx` — replaces the
  inline `<svg>` spinner with `<Spinner size="sm" decorative label="Loading" />`.
* `apps/frontend/src/components/ui/Button/Button.module.css` — removes
  the duplicate `@keyframes spin` and the spinner-specific animation;
  the `.spinner` class is now a 16×16 size wrapper around the shared
  primitive. Button loading semantics (`aria-busy`, disable-while-loading)
  are preserved.

### Theme architecture wired into the app (CRITICAL fix)
* `apps/frontend/src/app/layout.tsx` — wraps the app in
  `<ThemeProvider><ToastProvider><AuthProvider>...</AuthProvider></ToastProvider></ThemeProvider>`.
  Adds a `Script` with `strategy="beforeInteractive"` that runs the
  theme bootstrap before React mounts so the first paint already carries
  the correct `data-theme` attribute. `<html>` carries
  `suppressHydrationWarning` so React does not warn about the
  pre-hydration write.
* `apps/frontend/src/components/layout/AppHeader/AppHeader.tsx` —
  imports `ThemeToggle` and mounts it in the right section between the
  notification bell and the profile divider.

---

## 3. Primitive inventory

All seven new primitives + `ThemeToggle` are real, complete, and exported
from `apps/frontend/src/components/ui/index.ts`.

| Primitive | Source | CSS | Export | Typecheck | A11y contract | Uses tokens |
|---|---|---|---|---|---|---|
| `Spinner` | `Spinner/Spinner.tsx` | `Spinner.module.css` | yes | pass | `role="status"` (or `decorative` mode), `prefers-reduced-motion` | yes |
| `Tooltip` | `Tooltip/Tooltip.tsx` | `Tooltip.module.css` | yes | pass | `aria-describedby`, `role="tooltip"`, focus opens, Escape closes, viewport flip | yes |
| `Tabs` | `Tabs/Tabs.tsx` | `Tabs.module.css` | yes | pass | WAI-ARIA tabs, roving `tabindex`, arrow keys + Home/End, focus-visible | yes |
| `Toast` | `Toast/Toast.tsx` | `Toast.module.css` | yes | pass | `role="status"`/`role="alert"`, dismiss, auto-dismiss, reduced-motion safe | yes |
| `Textarea` | `Textarea/Textarea.tsx` | `Textarea.module.css` | yes | pass | label, `aria-invalid`, `aria-describedby`, focus-visible, disabled, required | yes |
| `IconButton` | `IconButton/IconButton.tsx` | `IconButton.module.css` | yes | pass | `aria-label` TS-required, focus-visible, hit-target 28/36/44 px | yes |
| `Divider` | `Divider/Divider.tsx` | `Divider.module.css` | yes | pass | `role="separator"` when not decorative | yes |
| `ThemeToggle` | `ThemeToggle/ThemeToggle.tsx` | `ThemeToggle.module.css` | yes | pass | real `<button>`, `aria-label`, Tooltip next-action, focus-visible, reduced-motion safe | yes |

No duplicate implementations of any of these exist elsewhere on `main`.

---

## 4. Theme verification

Verified by reading the code (the M16A report no longer claims "live
browser tested" — the work was committed without a real-time browser
check; that is captured in §9 Remaining Gaps).

* **Light / Dark / System** — `ThemeContext` exposes
  `mode: 'light' | 'dark' | 'system'`. The `cycleMode` helper walks
  through the three values.
* **localStorage persistence** — `THEME_STORAGE_KEY = 'haios.theme'`.
  Both the pre-hydration script and the React `ThemeProvider` read it.
* **matchMedia** — `ThemeProvider` registers a `change` listener on
  `(prefers-color-scheme: dark)` and recomputes `resolved` when
  `mode === 'system'`.
* **data-theme + color-scheme** — `applyResolvedTheme()` writes
  `<html data-theme>` and `<html style="colorScheme">` on every change.
* **Hydration safety** — `<html suppressHydrationWarning>`. The provider
  renders `mode: 'system'` and `resolved: 'light'` on the first render,
  then hydrates from `localStorage` inside `useEffect`.
* **Pre-hydration script** — `app/layout.tsx` injects the bootstrap
  Script with `strategy="beforeInteractive"`. It applies the same
  resolution logic before React mounts, preventing dark-mode flash.
* **ThemeToggle integration** — `AppHeader.tsx` imports `ThemeToggle`
  and renders it in the right section.

No second theme provider exists. The provider order in
`app/layout.tsx` is correct: `ThemeProvider` is outermost, then
`ToastProvider`, then `AuthProvider`.

---

## 5. Motion verification

### 5.1 What was migrated

Every `0.15s`, `0.2s`, `0.12s`, `0.25s`, `transition: all`, and
inline `cubic-bezier(...)` in production component CSS was replaced
with `var(--duration-fast|base|slow)` + `var(--ease-standard)`. The
sidebar width transition (`0.2s cubic-bezier(0.4, 0, 0.2, 1)` →
`var(--duration-base) var(--ease-standard)`) and the mobile-sidebar
transform transition (`0.25s cubic-bezier(0.4, 0, 0.2, 1)` →
`var(--duration-base) var(--ease-standard)`) were also tokenized.

### 5.2 What is intentionally NOT a token

* `Spinner.module.css` line 12: `animation: spin 0.8s linear infinite;`
  — this is the rotation cycle of a continuous loading animation, not
  a one-shot component transition. The `Spinner` CSS module also
  contains an explicit `prefers-reduced-motion: reduce` block that
  disables the rotation. A future enhancement could add a
  `--duration-spin` motion token, but it would have a single consumer
  and the existing value is the canonical continuous-rotation cycle.

### 5.3 What `prefers-reduced-motion` does

* `apps/frontend/src/styles/globals.css` already contains a global
  `prefers-reduced-motion: reduce` block that collapses every
  animation/transition to `0.01ms`.
* `Spinner`, `Tooltip`, and `Toast` each include an explicit
  per-primitive rule that disables their own animation under reduced
  motion in addition to the global rule.

---

## 6. Lenis decision

**NOT ADOPTED.** Confirmed by:

* `apps/frontend/package.json` — no `lenis` dependency.
* `grep -r "from 'lenis'" apps/frontend/src` — no matches.
* `docs/design/FRONTEND_DESIGN_SYSTEM.md` §8 — explicit decision with
  rationale (nested scroll containers, clinical tables, reduced-motion
  fall-through, native touch/trackpad behavior, no measurable UX win).

`lenis` was installed in earlier development but removed. Do not
reinstall it.

---

## 7. Animate UI / `motion` decision

**NOT ADOPTED.** Confirmed by:

* `apps/frontend/package.json` — no `motion` dependency.
* `grep -r "from 'motion'" apps/frontend/src` — no matches.
* `docs/design/FRONTEND_DESIGN_SYSTEM.md` §9 — explicit decision with
  rationale (existing primitives are token-native, no runtime animation
  library is needed, future adoption can be per-component).

`motion` was installed in earlier development but removed. Do not
reinstall it.

---

## 8. Accessibility verification

Verified by reading each primitive's source:

* **IconButton** — `aria-label` is required at the type level; real
  `<button type="button">`; `disabled` and `isLoading` short-circuit
  clicks; hit-target is 28/36/44 px; `focus-visible` is in the CSS.
* **Tooltip** — `aria-describedby` on the trigger; `role="tooltip"` on
  the bubble; opens on focus, pointer hover, and `Enter`/`Space`
  (delegated through the child); closes on Escape and pointer leave;
  viewport flip when the requested side would clip.
* **Tabs** — `role="tablist"` / `role="tab"` / `role="tabpanel"`;
  `aria-selected` and `aria-controls` wired; roving `tabindex` (only
  active tab has `tabindex=0`); arrow keys + Home/End navigate; the
  active tab sets focus after selection; panels are `tabindex=0` so
  they can be focused.
* **Toast** — `role="status"` (polite) for `info`/`success`,
  `role="alert"` (assertive) for `warning`/`error`; manual dismiss
  button; auto-dismiss is opt-in (default 4500 ms); sticky mode
  (`durationMs: 0`) is available; color is paired with an icon and a
  label, never color-only.
* **Textarea** — same `label` / `aria-invalid` / `aria-describedby` /
  disabled / required / focus-visible contract as `Input`; resize is
  vertical only.
* **Spinner** — default `role="status"` with `aria-label="Loading"`;
  `decorative` mode suppresses the role; `prefers-reduced-motion`
  disables rotation.
* **ThemeToggle** — real `<button type="button">`; `aria-label`
  announces the current state ("Light theme — click to change"); a
  Tooltip announces the next action; `focus-visible` is in the CSS;
  no emoji icons; mounted in a stable location in the AppHeader.

---

## 9. Validation log (actual commands and outcomes)

| # | Command | Scope | Outcome |
|---|---|---|---|
| 1 | `pnpm --filter frontend test` | frontend (vitest) | **PASS** — 9 files, **136/136 tests pass** in 2.34 s. The new 78-test design-token contract suite at `src/styles/__tests__/design-tokens.test.ts` is green. |
| 2 | `pnpm --filter frontend lint` | frontend (next lint) | **PASS** — No ESLint warnings or errors. |
| 3 | `pnpm --filter frontend build` | frontend (next build) | **PASS** — `Compiled successfully`. 18 static pages generated, types valid, no runtime warnings. The route table shows every page compiled with the new providers + primitives wired. |
| 4 | `grep -rE "0.15s\|0.2s\|0.12s\|0.25s\|transition: all\|cubic-bezier" apps/frontend/src --include="*.css"` | source tree | Clean except `tokens.css` (canonical definitions) and `Spinner.module.css` (the documented rotation cycle, paired with reduced-motion). |
| 5 | `grep -E "lenis\|motion" apps/frontend/package.json` | manifest | **No matches.** |
| 6 | `grep -rE "from 'lenis'\|from 'motion'" apps/frontend/src` | source tree | **No matches.** |
| 7 | File-level inspection: `components/ui/index.ts` | barrel | Includes re-exports for `IconButton`, `Textarea`, `Spinner`, `Tooltip`, `Tabs`, `Toast`, `Divider`, `ThemeToggle`. |
| 8 | File-level inspection: `app/layout.tsx` | root layout | `ThemeProvider` → `ToastProvider` → `AuthProvider` ordering; pre-hydration `Script` present; `<html suppressHydrationWarning>`. |
| 9 | File-level inspection: `AppHeader.tsx` | header | `ThemeToggle` is imported and rendered. |
| 10 | File-level inspection: `Button.tsx` + `Button.module.css` | button primitive | Uses `<Spinner size="sm" decorative label="Loading" />`; no inline spinner markup; no inline `@keyframes spin`. |
| 11 | File-level inspection: `Spinner.module.css` | spinner primitive | Has `prefers-reduced-motion: reduce` block that disables rotation. |
| 12 | File-level inspection: `Tooltip.module.css`, `Toast.module.css` | new primitives | Both have `prefers-reduced-motion: reduce` blocks that disable their enter animations. |
| 13 | File-level inspection: `FRONTEND_DESIGN_SYSTEM.md` | docs | Exists. Covers: visual direction, principles, token hierarchy (palette/semantic/typography/spacing/radius/elevation/motion/focus/z-index/breakpoints), component inventory, theme architecture, motion philosophy, Lenis decision, Animate UI decision, accessibility, responsive behavior, clinical UX rules, iconography, anti-patterns, location rules. |
| 14 | File-level inspection: `MILESTONE_16A_REPORT.md` | this file | Exists. This version. |

### Commands deliberately not run

* `pnpm -r run test` (full monorepo) — out of scope for the M16A
  correction pass. Backend pre-existing audit-hash-isolation failures
  (already documented in the previous M16A report) are unaffected by
  this pass; they will be addressed in a future backend milestone.
* `pnpm format` — intentionally **not** run during this pass because
  the user is working in parallel on the same repository; reformatting
  unrelated files would be a scope violation.

---

## 10. Remaining gaps

None that block M16A completion. Known non-issues (out of scope):

* A live browser walkthrough of the theme toggle was not performed; the
  code is in place and the contract test is green, but visual
  confirmation is left to a future manual QA milestone.
* `motion` token does not exist as a separate variable; the Spinner's
  `0.8s` rotation is the only place a continuous-rotation duration is
  used. A `--duration-spin` token could be added in a future polish
  pass, but it would have a single consumer.
* The `globals.css` global reduced-motion rule reduces every
  `transition` and `animation` to `0.01ms`; per-primitive rules are
  additive. This is intentional and the documentation in
  `FRONTEND_DESIGN_SYSTEM.md` §7 reflects it.

---

## 11. Stop condition

M16A is COMPLETE. No M16B work, no AppShell redesign, no M17 work, no
clinical workspace, no AI UX, no admin feature work, and no unrelated
refactor is included in this pass.
