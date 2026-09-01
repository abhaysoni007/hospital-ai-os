# Hospital AI OS — Frontend Design System

> **Status:** M16A — Design System Foundation
> **Scope:** All authenticated and public surfaces of the Hospital AI OS frontend.
> **Authority:** This document is the single implementation reference for M16A and
> all later frontend milestones (M17–M23). When a future change conflicts with
> this document, this document wins; update it first, then change code.

---

## 1. Purpose

The frontend design system is responsible for:

* **Visual coherence** — every screen reads as the same product, regardless of
  role, route, or density.
* **Clinical clarity** — status, identity, and timing are obvious without
  color alone.
* **Accessibility baseline** — every primitive meets WCAG 2.2 AA out of the box.
* **Velocity** — a single source of truth for tokens, primitives, and
  interaction rules so later milestones never re-invent a button or a badge.
* **Predictable motion** — restrained, semantic, reduced-motion-safe.

It is **not** responsible for application content, business logic, or backend
contracts. Those live in the architecture docs.

---

## 2. Design principles

The product follows one hierarchy: every decision ranks strictly below the
preceding one.

```text
Clinical usability
>
information hierarchy
>
accessibility
>
consistency
>
visual polish
>
motion
```

The interface should feel:

* **Quiet** — no shouting visuals, no marketing gradients, no decorative
  animation.
* **Precise** — alignment, spacing, and typography are deliberate.
* **Confident** — the system answers the question, then gets out of the way.
* **Premium** — surfaces are calm, motion is restrained, type is set with care.
* **Responsive** — interactivity is immediate; feedback is timely.
* **Trustworthy** — clinical data, audit, and permissions are first-class.

Specific clinical rules derived from the principles:

* Status is **never** color alone. Every status chip pairs color + text + (for
  critical states) icon. STAT is unmistakable: icon + text + dot + critical
  color.
* Patient identity uses a canonical hierarchy (name → MRN → demographics)
  rendered by `Identity`, not hand-rolled per page.
* AI surfaces are always presented as **drafts**, never as answers. The user
  always sees the source citation and the gap list.
* Critical information (lab values, alerts, break-glass) is never
  hidden behind hover-only interactions.

---

## 3. Design tokens

The token architecture follows the standard layered model:

```text
design tokens (raw values)
   ↓
semantic tokens (role-bound)
   ↓
component tokens (primitive-internal)
   ↓
page composition
```

### 3.1 Source of truth

* **CSS source of truth** — `apps/frontend/src/styles/tokens.css`
  consumed via CSS custom properties.
* **JSON source of truth** — `docs/design/design-tokens.json` (Figma sync
  artifact). Generated from the CSS; do not hand-edit it independently.

A test in `apps/frontend/src/styles/__tests__/design-tokens.test.ts` enforces
that every documented token remains present in `tokens.css`. A regression in
the file is a regression of the system.

### 3.2 Color

Deep healthcare indigo primary, slate neutral scale, semantic status colors.

| Layer | Token examples | Notes |
|---|---|---|
| Primary palette | `--color-primary-50…950` | Used for CTAs, focus, active nav. |
| Neutral palette | `--color-neutral-0…950` | Surfaces, text, borders. |
| Semantic surfaces | `--bg-app`, `--bg-surface`, `--bg-subtle` | Always use these; never hard-code `#fff` etc. |
| Borders | `--border-subtle`, `--border-strong` | Two-step scale, no in-between. |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary` | Three steps, no fourth. |
| UI status | `--color-success/warning/danger/info-*` | For non-clinical UI states. |
| Clinical status | `--status-critical/urgent/stable/pending/ai-*` | Mandatory pair-with-icon rule. |

Color is never the only signal. Critical states pair with an icon
(`AlertOctagon`), a label, and a dot. STAT priority uses `Zap` + label.

### 3.3 Typography

| Level | Use | Size | Weight |
|---|---|---|---|
| Display | Splash / brand | 36 / 44 | 700 |
| H1 | Page title (`PageHeader`) | 30 / 38 | 600 |
| H2 | Section header | 24 / 32 | 600 |
| H3 | Card / modal title | 20 / 28 | 600 |
| H4 | Widget / panel header | 16 / 24 | 600 |
| Body Large | Long clinical notes | 16 / 24 | 400 |
| Body | Default body, table cells, form fields | 14 / 20 | 400 |
| Body Medium | Table headers, active list rows | 14 / 20 | 500 |
| Small | Metadata, timestamps | 12 / 16 | 400/500 |
| Caption | MRN tags, field descriptions | 11 / 14 | 400/600 |
| Overline | Category labels (UPPERCASE) | 11 / 14 | 600 + tracking |

Inter is loaded via `next/font/google` and wired through `--font-inter`.

Numeric / KPI text uses `.numeric` (`tabular-nums` + mono family) for
clinical tables and lab values. `NumericTD` is the table-cell primitive for
token numbers, MRNs, and time-stamps.

### 3.4 Spacing

A 4/8 px grid. The full scale:

```text
--space-1   4px
--space-2   8px
--space-3  12px
--space-4  16px
--space-5  20px
--space-6  24px
--space-8  32px
--space-10 40px
--space-12 48px
--space-16 64px
--space-20 80px
```

Arbitrary values (e.g. `13px`, `17px`) are **not** allowed. If a layout
genuinely needs a different value, it escalates back to the design system.

### 3.5 Radius

```text
--radius-xs   4px   tooltips, small badges
--radius-sm   6px   form inputs, dropdowns
--radius-md   8px   buttons, table rows, cards
--radius-lg  12px   modals, drawers
--radius-xl  16px   (reserved for large surfaces)
--radius-full pill   status pills, avatars
```

### 3.6 Elevation

```text
--shadow-xs    hairline cards
--shadow-sm    active cards, buttons
--shadow-md    dropdowns, popovers
--shadow-lg    drawers, toasts
--shadow-modal modals, command palette
```

Restrained by design. Cards default to `xs` elevation. Stacked surfaces use
borders first, shadows second.

### 3.7 Motion

Motion tokens are the **only** source of timing.

| Token | Value | When |
|---|---|---|
| `--duration-fast` | 120 ms | Hover, focus, micro-feedback |
| `--duration-base` | 180 ms | Surfaces entering / leaving |
| `--duration-slow` | 240 ms | Larger transitions, skeletons |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default |
| `--ease-entrance` | `cubic-bezier(0, 0, 0.2, 1)` | Enter animations |

Hard-coded `0.15s`, `0.2s`, `transition: all` are forbidden in the codebase
and have been removed. Animation-only tokens (rotation, shimmer) use
`prefers-reduced-motion` to fall back to static styling.

### 3.8 Focus & z-index

* **Focus** — `--focus-ring-color: var(--color-primary-600)` and
  `--focus-ring-offset: 2px`. Every interactive primitive must expose a
  visible focus indicator.
* **z-index** — use the scale; do not invent new values.

```text
--z-sticky   100   sticky header
--z-drawer   400   side drawers
--z-backdrop 900   modal scrim
--z-modal   1000   modal dialogs
--z-toast   1100   toast viewport, tooltips
```

### 3.9 Breakpoints

Mobile-first responsive behavior. The exact media queries are written into
each component, not driven by a JS hook.

| Width | Behavior |
|---|---|
| `< 768 px` (mobile) | Sidebar collapses to drawer, dense nav → compact search icon, breadcrumbs hide, page padding 16 px. |
| `768–1023 px` (tablet) | Sidebar visible at full width, page padding 24 px, table cells tighten. |
| `1024–1279 px` (laptop) | Default shell, search trigger 200 px. |
| `1280–1439 px` (desktop) | Default shell, content max 1440 px. |
| `≥ 1440 px` (large) | Content centers at 1440 px, additional whitespace. |

---

## 4. Theme architecture

The product supports **three** theme states:

* `light` — explicit light.
* `dark` — explicit dark.
* `system` — follow the OS color scheme (default for new users).

### 4.1 Mechanism

* A single React context (`context/ThemeContext.tsx`) owns the source of
  truth. It exposes `mode`, `resolved`, `setMode`, and `cycleMode`.
* Persistence: explicit user selection is written to
  `localStorage['haios.theme']`. No server round-trip.
* The resolved theme (`light` or `dark`) is written to
  `<html data-theme="...">` so the very first paint already carries the
  right tokens.
* A pre-hydration inline script in `app/layout.tsx` runs **before** React
  hydrates to prevent the dark-mode flash on first navigation.
* When `mode === 'system'`, the provider subscribes to
  `matchMedia('(prefers-color-scheme: dark)')` and updates the resolved
  theme live.

### 4.2 Hydration safety

* The HTML root carries `suppressHydrationWarning` because the pre-hydration
  script may set `data-theme` before React mounts.
* The provider renders `mode: 'system'` and `resolved: 'light'` on first
  render, then hydrates from `localStorage` in a `useEffect`. This avoids
  any client/server mismatch.
* `colorScheme` is also set on `<html>` so native form controls and
  scrollbars track the active theme.

### 4.3 Theme control

* The toggle is `ThemeToggle`, mounted in `AppHeader` next to the
  notification bell.
* It is a real `<button>` with a stable `aria-label`, a Tooltip announcing
  the **next** action, and `data-theme-mode` for any future CSS hooks.
* It cycles through `light → dark → system → light` and persists.

### 4.4 Dark-mode tokens

Dark-mode overrides live in `tokens.css` under `[data-theme='dark']`. They
override semantic surfaces and the clinical status set; the primary and
neutral palettes stay constant so the brand reads identically in both
modes.

---

## 5. Component inventory

Authoritative primitives live in `apps/frontend/src/components/ui/`, exported
from `index.ts`. **All new pages must use these primitives.** Hand-rolling a
button, badge, or dialog is a review block.

| Component | Purpose | Key a11y rule |
|---|---|---|
| `Button` | Primary action surface | `isLoading` consumes `Spinner`; focus-visible always present. |
| `IconButton` | Icon-only action | `aria-label` is **required** (TS-enforced). Square hit-target ≥ 28 px. |
| `Input` | Single-line text field | `label`, `aria-invalid`, `aria-describedby` to error/helper. |
| `PasswordInput` | Password field with show/hide | Composes Input; toggle has its own `aria-label`. |
| `Select` | Native select | Same label/error contract as Input. |
| `Textarea` | Multi-line input | Same label/error contract; resize vertical only. |
| `Badge` | Status pill | Status badge always pairs with text; never color-only. |
| `SemanticBadges` | Frozen-enum status chips | Single source of truth via `utils/statusMeta`. |
| `Card` | Surface container | `elevation` and `padding` are the only knobs. |
| `Avatar` | Identity pictogram | Initials are the source of truth; image is opt-in. |
| `Dropdown` | Popover menu | Closes on Escape and outside click; ARIA menu roles. |
| `Tooltip` | Hover/focus hint | `aria-describedby` on the trigger; `role="tooltip"` on the bubble. |
| `Tabs` | WAI-ARIA tablist | Roving tabindex, arrow keys, Home/End, focus-visible. |
| `Toast` | Ephemeral notification | `role="status"` / `role="alert"`; auto-dismiss; reduced-motion-safe. |
| `Alert` | Inline banner | Severity = color + icon + label. |
| `Skeleton` | Loading placeholder | `aria-hidden`; parent announces state. |
| `Spinner` | Loading indicator | `role="status"` (or `decorative` mode); reduced-motion disables rotation. |
| `EmptyState` | No-data surface | Title + description + action. |
| `ErrorState` | Failure surface | Title + message + optional correlation ID + retry. |
| `Table` | Clinical data table | Real `<table>` semantics, `scope="col"`, interactive rows support keyboard. |
| `Divider` | Visual separator | Decorative by default; opt into `role="separator"`. |
| `MetricCard` | Dashboard metric | Tone + optional navigation; live region when value updates. |
| `PageHeader` | Page title | One `h1` per page. |
| `ConfirmDialog` | Irreversible confirmation | `alertdialog` + focus trap + focus return. |
| `AccessRestricted` | 403 state | Single canonical 403 surface. |
| `Identity` | Patient/staff identity | Canonical name → MRN → demographics. |
| `SidebarItem` | Sidebar nav row | Real `<a>`; `aria-current="page"`. |
| `ThemeToggle` | Color theme control | `aria-label` + Tooltip + persistent state. |

### Component rules

* **No duplicate primitives.** If you need a variant, extend the canonical
  one with a prop or a new `variant`. Do not create `BigButton.tsx`.
* **Composition over boolean soup.** Components expose minimal props and
  compose; do not stack a dozen `isX` flags.
* **No emoji icons.** Icons come from `lucide-react` only. Tooltip every
  unfamiliar icon-only control.
* **No inline `style` for color/spacing.** Use tokens. The linter cannot
  catch every case, so review must.

---

## 6. Iconography

* **Source:** `lucide-react` only.
* **Sizes:** 16 (metadata), 18 (control), 20 (navigation), 24 (prominent).
* **Stroke:** default (1.5 px) — do not change.
* **Color:** `currentColor` so the parent can theme the icon. Do not
  pass explicit colors.
* **Icon-only buttons:** must use `IconButton` with `aria-label` and a
  Tooltip.
* **Prohibited:** emoji, mixed icon families, decorative SVGs.

---

## 7. Motion strategy

Motion communicates state change, navigation, hierarchy, feedback, and
continuity. It does **not** decorate.

| May animate | Should not animate |
|---|---|
| Hover/focus affordance | Cards floating on a list |
| Surface enter/leave (modal, toast, dropdown) | Continuous background animation |
| Status transition (dot, badge swap) | Page-level transitions |
| Skeleton shimmer (reduced-motion safe) | Parallax, particles, gradients |
| Chart trace | Decorative text reveal |

The global `prefers-reduced-motion` block in `globals.css` collapses every
animation and transition to `0.01ms`. The `Spinner`, `Toast`, `Tooltip`, and
`Skeleton` each include an explicit `prefers-reduced-motion` rule that
disables their own animation in addition.

### What we never do

* GSAP, Three.js, or other heavy animation libraries.
* Decorative page transitions.
* Continuous looping background animation.
* Motion that delays a clinical workflow (e.g. a confirm button that
  bounces before allowing submit).

---

## 8. Lenis decision — NOT ADOPTED

Lenis was installed but unused. We have **not** integrated it. Native
scrolling is preferable for a clinical operating system:

* **Nested scroll containers** — tables, modals, side panels, and command
  palettes all have their own scroll. Hijacking the document scroll would
  require careful exclusion logic for every one of them, multiplying bug
  surface.
* **Clinical tables** — clinicians scroll a lab list at speed. Smooth
  interpolation adds latency to a workflow that should feel direct.
* **Reduced motion** — for users with `prefers-reduced-motion: reduce`,
  Lenis already falls back to instant scroll, removing the only argument
  for adding it.
* **Touch and trackpad** — both already provide inertial, predictable
  scrolling.
* **Long clinical records** — native scroll is the OS's job; we should
  not re-implement it.

The `lenis` package has been removed from `apps/frontend/package.json`. If a
future, isolated surface (e.g. a marketing page) needs smooth scrolling,
that page can opt in **locally** without affecting the clinical shell.

---

## 9. Animate UI decision — NOT ADOPTED

Animate UI is **not** adopted.

* The existing primitives are already high-quality, consistent, and
  themed via tokens.
* Animate UI components are designed for a different token system; adopting
  them would create two parallel component APIs and require duplicate
  theming work.
* The few animation moments that matter (toast enter, modal enter, tooltip
  hover) are tiny and have been written with token-driven CSS keyframes.
  Adopting a runtime animation library for them would be a downgrade.

If a specific Animate UI component is later proven materially better than
its existing counterpart, that one component can be adopted without
re-platforming the rest.

---

## 10. Accessibility

Target: **WCAG 2.2 AA** across every primitive and every page.

* **Keyboard** — every interaction reachable by Tab, operable by
  Enter/Space/Escape. Tabs implement the standard arrow-key roving model.
* **Visible focus** — global `:focus-visible` rule + per-component
  `outline` declarations; no `outline: none` without replacement.
* **Semantic HTML** — `<button>` for buttons, `<a>` for navigation,
  `<table>` for tabular data, `<label>` for form fields, `<h1>`–`<h4>` for
  hierarchy, one `h1` per page.
* **ARIA** — used only when HTML cannot express the relationship (e.g.
  `aria-describedby` for error messages, `role="alert"` for live
  announcements, `aria-current="page"` for active nav).
* **Live regions** — `role="status"` for non-urgent toasts; `role="alert"`
  for errors. `MetricCard` exposes an opt-in live region for streaming
  values.
* **Reduced motion** — honored globally and per primitive.
* **Contrast** — every semantic surface meets 4.5:1 text / 3:1 UI. Dark
  theme overrides were chosen against neutral 900 surfaces, not appended
  blindly.
* **Error relationships** — every form field with an error announces it
  via `aria-describedby` and a visible message; `aria-invalid` is set
  when the error is present.
* **Icon-only controls** — `aria-label` is required (TS-enforced on
  `IconButton`); unfamiliar controls add a Tooltip.

---

## 11. Responsive behavior

The shell is mobile-first. The design assumes:

* The user may be at a workstation, a tablet on a cart, or a phone.
* The information density does not collapse on small screens — instead,
  it **restructures** (drawers, stacked sections, compact metadata).
* The clinical workflow is never broken by viewport size. Priority order
  of actions is preserved on every breakpoint.

Concrete behavior is in §3.9. New pages must declare their responsive
behavior during planning, not retrofit it.

---

## 12. Clinical UX rules

These rules are non-negotiable. They are referenced by every M17–M23
page-builder review.

* **Real data only.** No fabricated counts, no invented KPIs, no demo
  patients. Loading shows skeletons; failure shows truthful errors; empty
  means empty.
* **Status is never color alone.** Critical states always include an
  icon and a label.
* **AI is always a draft.** Every AI-generated surface is presented as
  draft, requires human acceptance, and exposes citations and gaps.
* **Critical actions are obvious.** A cancel/save/break-glass button is
  never hidden behind a hover or a chevron.
* **Audit is a first-class citizen.** Every state-changing action lands
  in the audit log via the server; the UI must not lie about that.
* **Keyboard-heavy workflows win.** No critical path requires a mouse.
* **Persistent context.** Patient identity stays visible across the
  encounter workspace. The "where am I, who is this" question is always
  answered at a glance.
* **PHI handling** — the UI never logs PHI; the error handler strips
  identifiers; identity documents stay encrypted; the layout never
  embeds PHI in tooltips.

---

## 13. Anti-patterns

These are explicit "do not" examples. PRs that introduce them are rejected
at review.

* A new button component because "the existing one is too generic."
* A new spinner because "the existing one is too small."
* A new modal because "the existing one doesn't fit my page."
* Tailwind classes scattered in a CSS-Modules project.
* A page that uses `<div onClick>` instead of `<button>`.
* An icon-only button without `aria-label` or Tooltip.
* A toast that auto-dismisses a destructive error.
* A skeleton that uses a real `Spinner` (it is decorative, not live).
* Hard-coded `#fff`, `0.15s`, `transition: all`, `font-size: 14px` outside
  of `tokens.css`.
* Emoji in a button label, badge, or alert.
* A theme "color" that is actually a hex literal.

---

## 14. Where to put new work

* A new primitive → `apps/frontend/src/components/ui/<Name>/`.
* A new composite → `apps/frontend/src/components/<area>/`.
* A new page → `apps/frontend/src/app/<route>/page.tsx`.
* A new token → `apps/frontend/src/styles/tokens.css` first, then
  re-export in `docs/design/design-tokens.json`.
* A new status → `apps/frontend/src/utils/statusMeta.ts` (single source of
  truth for status semantics), then a new variant in `Badge`.

Always re-export from `components/ui/index.ts` if you add a primitive.
