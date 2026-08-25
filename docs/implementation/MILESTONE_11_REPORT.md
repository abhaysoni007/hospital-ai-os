# MILESTONE 11 REPORT — Governed AI Infrastructure

> **ADRs:** ADR-017 (runtime topology), ADR-018 (context authorization/PHI), ADR-019 (draft lifecycle), ADR-020 (audit/provenance/retention/encryption). Prompt mechanics per ratified `PROMPT_ARCHITECTURE.md`.
> **Scope discipline:** infrastructure ONLY — no M12 business capability.
> **Status: M11 VERIFIED**

| Area | Result |
|---|---|
| **Config** | ✅ Zod-validated `AI_*` keys added (all optional-with-defaults; app always boots without AI): `AI_ENABLED=false`, `AI_PROVIDER=google-gemini`, `AI_API_KEY` optional, `AI_MODEL_NAME=gemini-2.0-flash`, `AI_TIMEOUT_MS=30000`, `AI_MAX_TOKENS=4096`, `AI_DAILY_TOKEN_BUDGET=200000`, `AI_PER_USER_RATE_LIMIT=6/min`, `AI_SEMAPHORE_SIZE=4`, `AI_DRAFT_TTL_HOURS=24`. `.env.example` updated |
| **Provider abstraction** | ✅ ADR-005 interface preserved verbatim (`generateStructuredOutput` + `generateEmbedding`); failure taxonomy (`TIMEOUT/RATE_LIMITED/PROVIDER_ERROR/MALFORMED/UNAVAILABLE`) with pure tested classifier; no runtime model routing, no fallback chain |
| **Gemini adapter** | ✅ `@google/generative-ai` exact-pinned in lockfile; SDK import confined to `modules/ai/adapters/**` (gate-enforced static scan); thin request/response mapping; best-effort adapter parse is never trusted (pipeline re-validates raw text); `generateEmbedding` experimental-unused per ADR-017 §11 |
| **FakeProvider** | ✅ Deterministic, interface-identical, fault-injection modes: timeout / server_error / rate_limited / unavailable / malformed / invalid_schema / ok(scripted). All CI tests and the live gate run network-free |
| **Prompt infrastructure** | ✅ Versioned pure modules `note_draft@1`, `chart_search@1`; three-layer structure (trusted system instruction / delimited untrusted context / task+bounded ≤2,000-char clinician slot); safety clauses per ai-architecture §4.2; delimiter canonicalization neutralizes forged `[CLINICAL_CONTEXT_*]`, `[PATIENT_INPUT]`, `[SYSTEM_*]` tokens (idempotent, adversarially tested); no SDK calls from prompt modules |
| **Context projection** | ✅ Allowlist-only strict Zod block contracts (demographics = age+gender only; DOB/names/MRN/contacts structurally impossible); unknown block types FAIL CLOSED; mechanical input-manifest derivation persisted per interaction |
| **Gap validation** | ✅ Deterministic pre-provider gap computation per capability (medication/allergy gaps always surfaced honestly); prompt injects computed gaps; pipeline enforces output-gap superset fidelity — the model echoes, never invents, the authoritative list |
| **Citation validation** | ✅ Manifest-subset enforcement with exact source ids/types; foreign/fabricated citations rejected at CITATION stage; terminology fixed to SOURCE-GROUNDED (provenance-verified) — semantic entailment expressly not claimed |
| **Output validation pipeline** | ✅ PARSE → SCHEMA → BUSINESS → CITATION → GAP; AI-side SOAP rule enforces each heading exactly once (frozen M9 shared schema untouched); every rejection path unit-tested; invalid output never enters application state; failures persist as `validation_failed` telemetry only |
| **Encryption** | ✅ Existing `encryptField`/`decryptField` reused verbatim (AES-256-GCM, iv:tag:ciphertext envelope into `raw_response` JSONB); zero new crypto; DB-inspection test proves ciphertext-at-rest + decryptability |
| **Readiness** | ✅ Boot-time posture: production missing/weak `ENCRYPTION_KEY` or `AI_ENABLED=false` or absent API key ⇒ subsystem `disabled`, health reports it, orchestrator short-circuits 503 pre-cost; never plaintext fallback; never mid-tx discovery |
| **Persistence** | ✅ Zero migrations — existing M2 schema fully sufficient (`context_summary` carries manifest/gaps/block-counts metadata-only; `parsed_output` plaintext per gated-table ruling; `user_action='pending'` initial state); guarded lifecycle transition helper shipped for M12 binding (B5/B10 mechanics) |
| **Audit** | ✅ Event constants/builders for all four ratified events; `AI_DRAFT_GENERATED`/`AI_SEARCH_EXECUTED` emitted today in tail tx with interaction insert; payloads proven metadata-only by gate assertions; hash-chain continuity exercised through audit service |
| **Breaker** | ✅ In-process; consecutive-threshold + windowed-rate trip (>50% with ≥4-sample minimum so low-volume behavior follows the consecutive rule); single half-open probe; deterministic fake-clock tests incl. probe-failure re-open |
| **Rate limiting / semaphore** | ✅ Per-user sliding-window limiter (per-instance, documented); non-blocking semaphore with immediate BUSY backpressure (no invisible queueing) |
| **Budget** | ✅ Global daily token budget via DB SUM over committed interactions (UTC day boundary) — correct across replicas; enforced BEFORE provider invocation; bounded race overshoot documented (semaphore×replicas) |
| **Timeout/shutdown** | ✅ AbortController-linked hard timeout races the provider; graceful-shutdown hook aborts all in-flight calls (gate-proven drain); registration cleanup verified |
| **Health** | ✅ `/api/v1/health` now exposes `checks.ai {state: disabled\|ready\|breaker_open\|unavailable, enabled, provider, breaker}` — no secrets/credentials |
| **Security** | ✅ No AI route queries clinical tables; infrastructure consumes contract-projected blocks only; permission matrix untouched; PHI battery green over serialized prompts; injection battery proves no forged boundaries survive |
| **Tests** | ✅ shared **51/51** (+8 AI contract tests) · backend **531/531** (28 files; +44 M11: resilience/prompts/projections/pipeline/readiness/orchestrator-live-DB) · frontend **13/13** unchanged |
| **Live gate** | ✅ `scripts/m11_gate_verify.ts` — **35/35 PASS** (real app + real PostgreSQL + FakeProvider): permission path via real JWTs (physician/nurse vs receptionist/security_admin/anonymous), full pipeline persistence + encryption + metadata-only audit, citation/gap/malformed rejections, timeout, breaker open/half-open, semaphore BUSY, limiter, global budget pre-check, shutdown drain, PHI + injection batteries, provider-outage survival of manual clinical workflow, static SDK-boundary scan |
| **Build** | ✅ `pnpm install --frozen-lockfile`, `pnpm run build` PASS (shared tsc, backend tsc, frontend next build) |
| **Lint** | ✅ backend eslint clean; frontend "No ESLint warnings or errors" |
| **Format** | ✅ prettier applied across repo |

## Explicitly NOT implemented (M12 boundary)

- **M12 hero feature = NOT IMPLEMENTED** (no note-draft business endpoint, no domain context assemblers, no atomic binding)
- **Chart brief = NOT IMPLEMENTED**
- **AI result narration / AI chat / OCR / discharge AI = NOT IMPLEMENTED**
- **Embeddings retrieval = DEFERRED** (ADR-017 ledger; pgvector table dormant)
- **AI frontend = NOT IMPLEMENTED** (no UI changes)

## Known Limitations / Notes for M12

1. Capability routes are intentionally unmounted until M12 provides authorized-readers context assembly + capability gates (ADR-018 forbids client-supplied context); the orchestrator consumes projected blocks through its service interface, which is the M12 integration seam.
2. Per-instance limiter/breaker/semaphore documented acceptable at intranet scale (ADR-017 §8); daily budget remains globally exact.
3. `AI_DRAFT_ACCEPTED`/`AI_DRAFT_REJECTED` emission activates with M12 binding/PATCH flows (constants + builders shipped here).
4. One transient parallel-run flake observed in a frozen clinical concurrency test during monorepo-wide execution; isolated and full-backend reruns were green (531/531) — no interference with M8/M9/M10 behavior (AI module touches none of their paths).

## Remaining Issues

None blocking. **M12 may start.**
