# MILESTONE 16C REPORT — Motion + Visual QA + Accessibility + Final Frontend Gate

## Status

**COMPLETE**

## Scope

Final frontend quality gate for the M16A design-system foundation, M16B app shell, and the
high-fidelity dashboard redesign. Real-browser verification, responsive matrix, accessibility,
motion discipline, regression hardening. No M17/M18/M19 scope was implemented.

## Browser Matrix

Live-browser verification performed via the ZCode in-app Chromium (login as demo physician
against `http://localhost:3000`) plus Playwright (`apps/frontend/e2e/m16c-gate.spec.ts`).

| Viewport | Result    | Notes                                                                                                     |
| -------- | --------- | --------------------------------------------------------------------------------------------------------- |
| 375      | PASS      | Header overflow fixed (was 13–73px on every route from AppHeader right section); 0px on all audited routes |
| 768      | PASS      | KPI 2-up rows equal height; drawer verified at 375/768 behaviour                                          |
| 1024     | PASS      | No horizontal overflow; analytics 2-col layout aligns                                                     |
| 1280     | PASS      | No horizontal overflow; KPI 3-up rows equal                                                               |
| 1440     | PASS      | KPI bottoms 448/448/…; volume==status; rail last card == table bottom (0.00px delta after grid fix)       |
| 1920     | PASS      | Full composition verified; sparklines 88px slots, 0px bleed; delta chips compact                          |

## Accessibility

- Landmarks verified in live a11y tree: banner, complementary "Main Navigation", navigation
  "Primary"/"Breadcrumbs", main content, alert region.
- **Fixed (P1):** mobile drawer never actually set `inert` on `<main>` — React 18 silently drops
  boolean-valued unknown attributes (`inert` became a real boolean prop in React 19). Verified
  in-browser before and after; now renders `inert=""` while the drawer is open and removes it on
  close. Regression-guarded by `e2e/m16c-gate.spec.ts` (drawer test).
- Drawer focus management verified live: focus moves into the drawer on open, Tab is trapped,
  Escape closes, focus restores to the opener button.
- Focus visibility: global `:focus-visible` outline rule (globals.css) + component-level
  focus-visible styles; keyboard Escape/drawer behavior exercised via real keypresses.
- Critical alert uses `role="alert"`, is text + icon + border (not colour-only).
- Status badges carry text; contrast holds in both themes.

## Motion

Reviewed animations: staggered section entrance (`sectionEntrance`, token durations/easing only),
live-dot pulse (1.8s, subtle), card hover lift (pointer-fine only). No bouncing, no continuous
pulsing of clinical content, critical alert is static.

## Reduced Motion

`prefers-reduced-motion: reduce` verified with Playwright `emulateMedia` (Chromium):
`document.getAnimations()` running-state count is **0** on the dashboard — entrance animation and
live-dot pulse are disabled via the existing `@media (prefers-reduced-motion: reduce)` blocks.
No essential information depends on animation.

## Theme

- **Light:** verified at 375–1920 (reference-matched composition).
- **Dark:** verified — this gate surfaced and fixed the metric-card tone-class bug that painted
  light tinted backgrounds over the dark theme and made values unreadable (white-on-light).
- **System:** theme toggle cycles light → dark → follow-system; verified.

## Dashboard QA

- **KPI row:** 6 tiles, equal heights per row at every breakpoint (grid stretch + flex-column
  cards, hint/trend row pinned to bottom via `margin-top: auto`). Fixed: tone classes applied to
  the whole card overrode themed surface; delta chips compressed sparklines to 44px "broken"
  squiggles — chips now compact (`↑ 75%`, full text in tooltip/aria-label) and slots are
  `flex: 1 1 auto; min-width: 56px; max-width: 88px` with 0px measured bleed.
- **Critical alert:** dominant, single-line, no duplication, role=alert, Review-now action.
- **Analytics:** Encounter Volume line chart upgraded (smoothed Catmull-Rom curves clamped to the
  plot area, soft area gradients, data dots, legend on top); Encounter Status donut legend
  restacked (`label / count (percent)`). No fabricated analytics.
- **Active Encounters:** full-width table, controlled readability, no page-wide horizontal scroll.
- **Critical Work Queue:** restyled items (CRITICAL chip, title + timestamp, body, Review result |
  Acknowledge actions), "View all" footer.
- **Governed AI card:** communicates source-grounding + mandatory clinician review; no autonomous
  authority implied.
- **Today's Snapshot:** moved into the side rail as a 2×2 stat card; truthful values, `—` for
  unavailable.

## Browser Testing

Command: `npx playwright test e2e/m16c-gate.spec.ts --config=e2e/m16c.playwright.config.ts`

Results (final runs): overflow audit 1440/1280/1024/768 PASS (375 PASS in manual audit ×2 and
intermittently in CI — see Known Limitations), KPI equal-height + sparkline containment PASS,
volume==status PASS, rail==table PASS (after sub-pixel fix), drawer inert/Escape/focus PASS,
reduced-motion PASS. Earlier failures were (a) a real 2px sub-pixel flex-gap rounding gap between
the side rail and table card — fixed by switching the rail from flex to `grid-template-rows:
auto auto 1fr` (measured delta 0.00px) — and (b) login flake when the dev server recompiles
between viewport passes (the login form disables inputs during its health probe; the spec now
waits/retries).

A dedicated `e2e/m16c.playwright.config.ts` runs against the dev server on :3000 (serialized
workers) because the repository config targets a :3002 webServer whose parallel boots corrupted
the shared `.next` directory mid-session (dev server was restarted clean).

## Validation

| Check        | Result                                                                        |
| ------------ | ----------------------------------------------------------------------------- |
| Unit tests   | `pnpm --filter frontend test` — **179 passed** (incl. updated DonutChart contract) |
| TypeScript   | `npx tsc --noEmit` — clean                                                     |
| Lint         | `pnpm --filter frontend lint` — no warnings or errors                          |
| Build        | `npx next build` — **successful** (all routes compiled)                        |
| Formatting   | Prettier `--write` applied to changed files; `--check` clean afterwards        |
| E2E/browser  | m16c-gate.spec.ts — see Browser Testing                                        |

## Fixes

1. **MetricCard tone collision (P1, dark mode):** tone classes set light backgrounds on the whole
   card → invisible values. Split into accent-only classes (border-left) + icon chip classes.
2. **Sparkline bleed/"broken" lines (P1):** trend slot no longer overflows the tile (flex-shrink
   allowed, min 56px, max 88px, overflow hidden backstops at slot and card).
3. **Delta chips:** compact `↑ N%` with full context in `title`/`aria-label`; flat labels
   normalised to `0% vs yesterday`.
4. **Equal-height rows:** `grid-template-rows: auto 1fr` + stretch; MetricCard flex column with
   bottom-pinned footer; side rail switched to grid to kill the 2px sub-pixel mismatch.
5. **LineChart:** smoothing with clamped control points, area gradients, dots, legend on top.
6. **DonutChart:** legend stacked `label / count (%)`; `legendPercent` contract test updated.
7. **AppHeader 375px overflow (P1):** `.leftSection`/children `min-width: 0` so breadcrumbs clip;
   divider hidden ≤375px. 0px overflow on all audited routes.
8. **Drawer `inert` (P1):** React 18 drops boolean-valued unknown attributes — now passes the
   string boolean-attribute form (typed via cast), verified rendering in-browser.
9. **Dashboard composition** restructured to the approved reference: volume + status + side rail
   grid, full-width encounters table, AI card and snapshot in the rail, greeting icon.

## Known Limitations

- The 375px overflow Playwright case intermittently fails on `login` (form disables inputs during
  its server-health probe while the dev server recompiles between passes) — manual in-browser
  audit measured 0px overflow on all five routes at 375px twice after the fix; the spec waits for
  the form to enable and retries, but serializing with a cold dev server can still starve it.
- The `inert` cast (`'' as unknown as boolean`) is required until React 19, where `inert` is a
  real boolean prop.
- Sidebar items in the reference mockup (Appointments/Orders/Messages/Admin) are shell-level,
  permission-driven routes and remain out of scope for M16C.

## Files Changed

- `apps/frontend/src/components/ui/MetricCard/MetricCard.tsx` + `.module.css`
- `apps/frontend/src/components/ui/Sparkline/Sparkline.tsx` + `.module.css`
- `apps/frontend/src/components/ui/LineChart/LineChart.tsx` + `.module.css`
- `apps/frontend/src/components/ui/DonutChart/DonutChart.tsx` + `.module.css` (+ contract test)
- `apps/frontend/src/components/dashboard/DashboardShell.tsx` + `.module.css`
- `apps/frontend/src/components/layout/AppHeader/AppHeader.module.css`
- `apps/frontend/src/components/layout/AppShell/AppShell.tsx`
- `apps/frontend/e2e/m16c-gate.spec.ts` (new), `apps/frontend/e2e/m16c.playwright.config.ts` (new)
- `docs/implementation/MILESTONE_16C_REPORT.md` (new)
