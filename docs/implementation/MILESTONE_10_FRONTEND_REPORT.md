# MILESTONE 10 — FRONTEND REPORT (Diagnostics Vertical Slice)

> **Scope:** frontend only. Backend contracts FROZEN per `MILESTONE_10_BACKEND_REPORT.md` (gate 23/23).
> **Status: IMPLEMENTED** (full M10 freeze pending next gate)

## Routes created / updated

| Route | Purpose | Permission (UX gate) |
|---|---|---|
| `/encounters/[id]` (extended) | New **Diagnostics** section: orders list (test, priority chip, status badge, ordered/collected timestamps) linking to order detail; "Order Diagnostic" button; inline "Collect Sample" actions for lab technicians on `ordered` orders | section `diagnostic_order:read`; button `diagnostic_order:create`; collect `diagnostic_order:update` |
| `/encounters/[id]/diagnostics/new` | Order form: common-test selector + custom code/name, radio priority cards (Routine/Urgent/STAT with hints), bounded clinical indication; shared-Zod client validation; 403-aware error handling; success → back to encounter | `diagnostic_order:create` |
| `/diagnostics` (replaced M8 placeholder) | **Lab queue command center**: status/priority/date filters (server-side), dept-scoped rows, STAT row emphasis (left rule + tint + icon + label), Collect Sample & Enter Result actions gated by role | `diagnostic_order:read` (+ update/enter for actions) |
| `/diagnostics/[orderId]` | Order + result detail: meta grid, values table with per-parameter verdicts and rule-limit explanations from the evaluation snapshot, persistent CRITICAL banner, lifecycle metadata, four-eyes verify flow with typed confirmation, VERIFIED & LOCKED notice | `diagnostic_order:read` / result read |
| `/diagnostics/[orderId]/result/new` | Result entry: dynamic parameter rows (name/value/unit), explicit **Review before entering** state listing test/priority/values, duplicate-submission protection, post-submit critical screen | `diagnostic_result:enter` |

## API contracts consumed

Exactly the frozen backend routes: `POST|GET /encounters/:id/diagnostic-orders`, `GET /diagnostic-orders`, `GET|PATCH …/:id` (collect/cancel), `GET|POST …/:orderId/result`, `POST …/:orderId/result/verify`. Typed via shared `DiagnosticOrderResponse`, `DiagnosticResultResponse`, `CreateDiagnosticOrderRequest`, `EnterResultRequest`. Evaluator-owned fields (`isCritical/isAbnormal/criticalRuleId`) never appear in any request payload.

## States implemented (every screen)

Loading (skeleton) · populated · empty · field validation errors · API/network error with retry · unauthorized/forbidden messaging · conflict (409 → "already collected/verified" banner + refresh of current state; no silent retries or overwrites) · success feedback.

## Critical-result UX

Dedicated post-entry critical screen (`role="alert"`, ⚠ icon, "CRITICAL RESULT" heading letter-spaced, bordered/tinted panel) stating deterministic-rule flagging, ordering-physician notification, and pending independent verification — no generic toast. On the detail page a persistent critical banner plus per-row critical verdicts with rule limits from the persisted evaluation snapshot. Icon + label + border + copy; color is never the sole signal.

## Four-eyes UX

The entering technician never sees a Verify action — instead: "Independent verification required — the entering technician cannot verify this result." Other technicians see "Verify Result" → confirmation ("Verify this diagnostic result as accurate and complete?") → verified state; 409 renders an "Already verified" banner with Refresh.

## Verified locked view

"VERIFIED & LOCKED — final and cannot be modified" notice with lock/shield icons, verified-by/at metadata, zero mutation controls.

## Responsive / Accessibility

CSS grid/flex layouts collapse to single column ≤720px; queue hides the ordered-time column ≤900px while keeping test/priority/status/actions visible; STAT left-rule keeps critical rows identifiable in narrow view. Semantic tables (`scope="col"`), labelled inputs, `fieldset/legend` + radiogroup for priority, `role="alert"` banners, aria-hidden decorative icons, visible focus rings inherited from the design system.

## Tests

New frontend vitest setup (node environment, pure-logic): 13 tests covering priority/status metadata, role gating mirrors (physician/lab-tech/nurse/denied roles/fail-closed), four-eyes helper, and result-payload builder incl. evaluator-field exclusion and per-row validation errors. Component-level DOM tests remain deferred to the M21 Playwright/testing-library milestone (no DOM harness existed).

## Integration verification

Backend walked live via `m10_gate_verify.ts` (**23/23**) immediately before and after frontend changes — same contracts the UI consumes. Full workflow proven over real HTTP+DB: physician order → collect (20-way concurrency) → normal/critical entry → four-eyes verification → completed + PHI-minimal notification assertions. Browser-level walkthrough remains M21 scope.

## Gates

install --frozen-lockfile PASS · format PASS · build PASS (all packages) · lint clean (both apps) · frontend tsc --noEmit PASS · suites: shared 43/43, frontend 13/13 (new), backend 487/487 (unmodified).

## Known limitations

- Test selection uses a static suggestion catalog + custom code input (no test-catalog API exists until later milestones).
- Author/verifier shown as short UUIDs (staff-directory UI arrives with admin endpoints).
- Browser E2E deferred to M21.
