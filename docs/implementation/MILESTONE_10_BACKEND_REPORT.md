# MILESTONE 10 — BACKEND REPORT (Diagnostics + Lab Vertical Slice)

> **Scope:** backend only — order lifecycle, sample collection, deterministic critical-value evaluation, result entry, four-eyes verification, outbox-via-notifications critical alerts. Frontend = NOT IMPLEMENTED YET (next prompt).
> **Binding ADRs:** ADR-010 (deterministic rules), ADR-016 (lifecycle/cancellation/provenance/queue/alerts).
> **Status: BACKEND VERIFIED**

| Item | Result |
|---|---|
| **M10 backend status** | VERIFIED |
| Migration | ✅ `0004_order_collection_provenance.sql` — additive nullable `collected_at TIMESTAMPTZ` + `collected_by UUID→staff`; clean-database migration applied; rerun safe; columns verified live via `\d diagnostic_orders` |
| Shared contracts | ✅ `diagnostics.schemas.ts`: create/list-queue/cancel/result-entry/verify schemas; strict `resultValueSchema` (`.strict()`); evaluator outputs (`isAbnormal`/`isCritical`/`criticalRuleId`) structurally absent from request schemas — server-derived only; 12 shared schema tests |
| State machines | ✅ Pure module for orders (ordered→sample_collected→completed; ordered→cancelled terminal branch; `in_progress` reserved) and results (preliminary→verified / preliminary→critical_flagged→verified; verified immutable); exhaustive matrix tests |
| Critical evaluator | ✅ Pure module — no DB/HTTP/clock/randomness/AI; inclusive boundaries (`<=critical_low`, `>=critical_high`); abnormal outside normal range; UNIT_MISMATCH/NON_NUMERIC/NO_RULE/NO_BOUNDS recorded as `unevaluated` (never silently normal); multi-rule lowest-id tie-break for `criticalRuleId`; determinism proven by 25 repeated runs byte-compare; 18-test safety battery green |
| Order lifecycle | ✅ Create (assigned physician + active encounter + server-side patient/dept inheritance), collect, cancel (per grant), derived verify→completed |
| Collection | ✅ Exactly-once under 20-way parallelism (live DB); provenance populated atomically; cross-dept denied |
| Cancellation | ✅ Ordering physician, own order, pre-collection only; post-collection → 409 INVALID_TRANSITION; else-order → 403; collect-vs-cancel race deterministic (single winner) |
| Result entry | ✅ Post-collection only; duplicate → 409 RESULT_ALREADY_EXISTS (unique backstop + race-safe catch of 23505); evaluator fields never caller-settable (schema strips + service derives) |
| Critical detection | ✅ Seeded rule tripped at value ≤ critical_low → status critical_flagged, isCritical server-derived, evaluation snapshot persisted in reference_range |
| Notification persistence | ✅ Outbox-via-notifications in the SAME transaction: result + CRITICAL_VALUE_DETECTED + notification row + CRITICAL_VALUE_NOTIFIED + LAB_RESULT_ENTERED all-or-nothing; induced entry-audit failure rolled back result, audits AND notification (count-delta assertion), retry succeeded cleanly |
| Verification | ✅ Four-eyes enforced (self → 403); guarded transition; 20 concurrent verifies → exactly 1 success; verified immutable (re-attempt → 409 with zero audit trace); order atomically completed |
| RBAC | ✅ 7 roles × 9 routes over real RS256 JWTs (72 assertions) incl. the ADR-016 cancel grant; pharmacist correctly retains `diagnostic_result:read` (matrix row meds_related); M5 otherwise untouched |
| Scope | ✅ Department parity everywhere via encounter join (orders carry no department column); lab queue cannot be bypassed by query params (verified cross-department exclusion); assigned-doctor checks on create/edit paths |
| Audit | ✅ All seven events implemented; AMENDED/RULE_UPDATED reserved & absent; payloads metadata-only (asserted: no numeric values, no narrative) |
| PHI | ✅ Values only behind `diagnostic_result:read`; notification body = test name + pointers (no MRN/values/patient id — gate-asserted); ADR-013 boundary intact (encounter detail embeds nothing) |
| Concurrency | ✅ Live DB: 20 parallel collects → 1; 20 parallel verifies → 1; enter-vs-cancel race single winner; unique-index race-safe duplicate handling |
| Live gate | ✅ `apps/backend/scripts/m10_gate_verify.ts` — **23/23 PASS** |
| Tests | ✅ shared **43/43** · backend **487/487** (22 files; +139 new M10 tests incl. 18 evaluator safety tests) |
| Build | ✅ `pnpm run build` PASS |
| Lint | ✅ both apps clean |
| Format | ✅ prettier applied; suite re-run green |
| Known limitations | Qualitative parameters unevaluated (explicit NON_NUMERIC); unit comparison exact-match case-insensitive (no conversion factors v1); `in_progress` has no trigger endpoint (reserved); rule CRUD deferred (CRITICAL_RULE_UPDATED reserved); dev-only rule seed used for tests/gate |

## Explicit deferrals

- **M14** dispatcher / delivery / acknowledgement / escalation / reminders / tasks — deferred.
- **M11/M12 AI** — deferred (`ai_summary` untouched).
- **M13 discharge** — deferred.
- **M15 break-glass** — deferred.
- **Result amendment/correction** — deferred (verified results immutable; no update path exists).

## Frontend

NOT IMPLEMENTED YET — next prompt builds the M10 frontend vertical slice against these tested contracts.
