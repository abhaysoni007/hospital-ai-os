# MILESTONE 12.2 — PRODUCT INTEGRITY + CRITICAL RESULT LOOP

**Status:** COMPLETE
**Date:** 2026-08-26
**Baseline:** M12.1 Integrity Restoration (`4743da0`, VERIFIED)
**Mode:** Minimum coherent operational loop. NOT the full M14 notification/task/escalation system.

---

## 1. Objective

Turn clinically-correct primitives into a believable operational hospital loop:

```
CRITICAL LAB RESULT → NOTIFICATION → PHYSICIAN WORK QUEUE/INBOX
→ OPEN RESULT → REVIEW CONTEXT (→ optional governed AI assist)
→ CLINICIAN ACTION → AUDITABLE COMPLETION
```

Every step above is now real, server-authorized and auditable.

---

## 2. What was implemented

### Part A — Critical notification read/workflow
- `GET /api/v1/notifications` — authenticated actor; recipient scope derived
  **server-side from the JWT** (no client-supplied recipient/staff/patient
  filters); shared-Zod validated query; bounded pagination (max 100);
  deterministic `created_at DESC` ordering; optional status/priority/type
  filters backed by existing schema enums.
- `PATCH /api/v1/notifications/:id/acknowledge` — owner-only guarded
  transition `dispatched|delivered → acknowledged` using the EXISTING schema
  semantics (`acknowledgedAt`). Foreign/unknown ids are indistinguishable
  (404). Re-acknowledgement → `409 INVALID_TRANSITION`.
- **Audit:** acknowledgement emits metadata-only `NOTIFICATION_ACKNOWLEDGED`
  inside the same transaction (ADR-008 fail-safe rule). No new permission was
  required — the ratified API catalog defines both routes as "Any"
  authenticated role; M5 matrix untouched.
- **PHI boundary (ADR-016 respected):** payloads carry notification id, type,
  title/body (test name + pointer only), priority, status, timestamps,
  referenceType/referenceId, plus a server-resolved `relatedOrderId`
  navigation pointer. NO MRN, DOB, patient identifiers or clinical values.
- M10's creation logic is untouched and unreused-duplicated: the loop consumes
  exactly what the outbox already writes.

### Part B — Real dashboard data
`DashboardShell` rewritten. Removed: `DEMO_PATIENTS`, `DEMO_TASKS`, hardcoded
KPIs (24/8/6/1), fabricated critical-alert banner, ungated fake buttons
("New Encounter", "Emergency Override"), hardcoded department text.
Now rendered from live endpoints, permission-gated via the existing frontend
RBAC helpers:
- Critical alerts ← `GET /notifications` (count + work queue; banner only when
  a real unacknowledged critical exists).
- Today's schedule ← `GET /appointments?date=today` (`appointment:read` roles).
- Active encounters ← `GET /encounters?status=active` (`encounter:read`).
- Pending lab work ← two bounded `GET /diagnostic-orders?status=…&pageSize=1`
  calls; KPI uses authoritative `meta.total`s.
Every block implements loading (skeleton) / populated / empty / error-with-retry;
unauthorized blocks are hidden entirely. No fabricated fallback values anywhere.
`GlobalSearch` de-mocked: real patient-directory search (`patient:read`),
debounced with AbortController stale-response protection, honest empty/error
states, lying keyboard hints removed.

### Part C — Session refresh / 401 recovery
Centralized in `api-client.ts` against the FROZEN M4 contract (no auth
architecture changes):
- First 401 of an authenticated request → EXACTLY ONE cookie-based refresh
  (`POST /auth/refresh`, credentials include, raw fetch so it cannot recurse).
- Single-flight promise: concurrent 401s share one refresh (no storm).
- Success → original request retried exactly once (`_retried` flag prevents
  loops). A 401 after successful refresh ends the session.
- Failure → token cleared + `onSessionExpired()` listener registry fires;
  `AuthContext` resets state so `AuthGuard` routes to /login. Exactly one
  session-expiry notification per expiration event.
- No tokens logged; no persistent storage; skipAuth endpoints never trigger
  recovery.

### Part D — Minimum staff identity projection
- New read-only `GET /api/v1/staff/identity?ids=` (≤50 UUIDs/call): projects
  ONLY `{id, displayName, role}` for any authenticated role (same posture as
  `/auth/me`). No email, credentials, department assignment, no CRUD.
- Frontend `staff-service` adds batched fetches with module-level cache +
  in-flight dedupe (no N+1 storms), wired into the diagnostics order detail
  page (`enteredBy` / `verifiedBy` now render human names, falling back to
  truncated ids if projection is unavailable).

### Part E — UX quality
New surfaces use the existing design system (Card/Badge/Button/Skeleton/
AlertBanner/AppHeader patterns). Notification panel and work queue expose
loading/empty/error states, semantic icons + text labels (no color-only
status), `aria-live` regions, `role="alert"` failures, keyboard-operable
buttons/links, honest relative-free timestamps.

---

## 3. Security review summary

- Server derives recipient scope; arbitrary ids cannot leak foreign
  notifications (404 semantics proven in tests + gate).
- Cross-role matrix verified: physician B denied; receptionist/hospital_admin/
  security_admin see only their own (empty) lists; unauthenticated → 401.
- Staff identity exposes minimum fields; >50 ids rejected; unknown ids omitted.
- Refresh contract test re-proves RS256 enforcement and rotation revocation.
- All new mutations audited atomically; hash-chain continuity asserted after
  full loop execution.

## 4. Tests (exact counts)

| Suite | Count |
|---|---|
| shared | **51/51** |
| backend | **569/569** (35 files) — was 555; +14 new |
| frontend | **37/37** (4 files) — was 26; +11 new |

New backend: notification integration (7), staff identity (4), session-refresh
contract (3). New frontend: auth-recovery regression (6), dashboard mapping
helpers (5).

## 5. Live gates

| Gate | Result |
|---|---|
| m6/m17 gate_api_verify (live :3001) | **27/27** |
| m8 | **13/13** |
| m9 | **30/30** |
| m10 | **23/23** |
| m11 | **38/38** |
| m12 | **27/27** |
| m12.1 | **27/27** |
| **m12_2_product_integrity_gate_verify (new)** | **24/24** |

The M12.2 gate walks the entire operational loop live: booking → check-in →
activation → stat order → collection → deterministically-classified CRITICAL
result (ADR-010 rule seeded per-run) → persisted outbox notification →
recipient-scoped retrieval with resolved order pointer → unauthorized denials
→ real result retrieval with evaluation snapshot → governed AI draft path →
audited acknowledgement → hash-chain continuity → staff identity projection →
dashboard endpoint behavior per permission.

## 6. Build/Lint/Format
All PASS across shared/backend/frontend.

## 7. Performance observations (documented, not load-tested)
- Notification list query rides existing `idx_notifications_recipient`;
  page size hard-bounded ≤100 by shared schema; related-order resolution is a
  single batched IN query (no N+1).
- Dashboard issues ≤4 bounded parallel requests; pending-lab counters use
  `meta.total` of pageSize=1 queries instead of fetching rows.
- Frontend staff-identity batching dedupes concurrent lookups; negative-cache
  prevents refetch loops within a session.
- Future load-test focus: notification fan-out per physician during mass
  critical events; dashboard request burst at shift start.

## 8. Deferred work (explicit)
- Escalation schedules, reminders, reassignment, task management → **M14**
- Discharge workflow → **M13**
- Full staff administration → **M20**
- Break-glass → **M15**
- Browser E2E → **M21**

## 9. Verdict

M12.1 integrity restoration remains fully intact (all seven historical gates
re-passed unchanged). M12.2 adds product-integrity capabilities on top without
altering any frozen M8–M12 contract. The critical-result operational loop is
genuinely usable end-to-end with real data only.
