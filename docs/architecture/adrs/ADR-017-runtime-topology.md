# ADR-017: AI Runtime Topology — Synchronous Execution, Resilience Envelope & Deferral Ledger

**Status:** ACCEPTED
**Date:** 2026-08-26
**Author:** Phase 5 — M11/M12 Architecture Ratification (adversarial challenge passed)
**References:** `ADR-005-ai-provider-abstraction.md`, `ADR-007-bullmq-jobs.md`, `ai-architecture.md §2, §8`, `backend-architecture.md §6, §7, §8.1`, `implementation-plan.md M11/M12`, `config/index.ts`, `graceful-shutdown.ts`

---

## Status

ACCEPTED. Governs all M11/M12 AI runtime behavior.

## Context

M11 activates the AI substrate that has existed schema-only since migration 0000 (`ai_interactions`, `embeddings`). No provider client, queue consumer, or AI route exists today. ADR-007 accepted BullMQ/Redis for background jobs, and the Phase 3 plan listed "embedding generation job" under M11 — but the ratified M12 capability set (ADR-018/019) contains **zero async consumers**: chart grounding uses deterministic per-patient retrieval, not vector search. Introducing Redis + BullMQ + workers with no consumer violates the repository's Ponytail discipline. The adversarial architecture challenge required explicit rulings on execution model, transaction discipline, resilience controls, multi-replica scope honesty, shutdown behavior, and dependency policy before implementation.

## Problem

Choose the v1 runtime topology for every AI invocation such that: no clinical workflow can be degraded by AI failure; no database connection is pinned during provider latency; cost and concurrency are bounded; behavior across multiple backend replicas is explicitly understood; and future async migration is possible without redesign.

---

## Decision

### 1. Synchronous request/response v1

Every AI capability executes as a synchronous HTTP request/response. Rationale: expected latency (5–20s) is acceptable inside clinician-initiated workflows with progress UX; volumes are intranet-OPD scale; synchronous execution yields the simplest audit/provenance story (one request ⇒ one interaction row ⇒ one audit event).

### 2. Transaction discipline — NEVER hold a DB transaction across provider latency

The provider call is awaited **outside any database transaction**. Persistence of the `ai_interactions` row and its audit event happens in a **short-tail transaction after** the provider returns:

```text
authorize → assemble context → [provider call: NO tx held]
→ validate output → SHORT TX: INSERT ai_interactions + audit event → respond
```

Induced failure of the tail transaction rolls back both rows together; no clinical business transaction ever waits on Gemini.

### 3. Timeout & retry

- Provider abort at **30 seconds** (config `AI_TIMEOUT_MS`) via `AbortController`.
- **No automatic retry** on any user-facing invocation (latency-doubling avoidance). The user retries manually via the UI. Background retry infrastructure does not exist and is not created in v1.
- Timeout, malformed response, 5xx, and 429 are all breaker-counted failures.

### 4. Circuit breaker (in-process)

Parameters per `ai-architecture.md §8`: opens after 3 consecutive failures or >50% failure rate in a 60s window; open state holds 30 seconds, then admits a single half-open probe. Open breaker ⇒ `503 AI_SERVICE_UNAVAILABLE` (`AIServiceError`, already defined in shared errors) with a frontend banner. All non-AI workflows remain fully functional by construction.

### 5. Concurrency semaphore

Approximately **4 concurrent provider calls** per process (in-process counter). Overflow receives an immediate honest `503 BUSY` — backpressure is surfaced, never queued invisibly.

### 6. Per-user rate limiting

In-process sliding-window limiter on AI routes (default ≈6 invocations/min/user), layered atop the existing global express-rate-limit. This is new middleware; only the global limiter exists today (`security.middleware.ts`).

### 7. Daily token budget — GLOBAL via database

Hospital-wide daily token budget checked **before** provider invocation via an indexed `SUM(input_tokens + output_tokens)` over ALL committed `ai_interactions WHERE created_at >= start-of-day` (UTC day boundary, no user filter). Because it reads committed rows, this control is **globally correct across replicas**. Breach ⇒ `RateLimitError` (429) with explicit code. Minor race overshoot on simultaneous final-budget calls is bounded by semaphore × replicas and accepted.

> **M12.1 correction (Full System Audit finding P0-5):** the original text of this
> section said "per-user daily token budget" with a `WHERE initiated_by = ?` SQL
> sketch, contradicting this section's title, the Decision 8 scope table below,
> and every summary document (PROJECT_STATUS.md, MILESTONE_11_REPORT.md). The
> ratified contract is GLOBAL: the per-user invocation limiter (Decision 6)
> bounds individual abuse; the daily budget exists to bound TOTAL hospital spend.
> The implementation was corrected to the GLOBAL SUM in M12.1; cross-user
> enforcement is proven by `budget-scope.global.test.ts`, the M11 gate, and the
> M12.1 gate.

### 8. Control-scope classification (multi-replica honesty)

| Control | Scope | Correctness statement |
|---|---|---|
| Daily token budget | **GLOBAL** (DB SUM) | Exact across replicas |
| Per-user invocation limiter | PER-INSTANCE | Effective global limit = configured × replica count |
| Circuit breaker | PER-INSTANCE | Each replica fails independently toward open — the safe direction |
| Semaphore | PER-INSTANCE | Global cap = slots × replicas |
| Draft TTL / binding guards (ADR-019) | DB row-level | Globally exact |

Per-instance controls are **intentionally acceptable** at current hospital-intranet scale and are documented here rather than centralized prematurely. Centralization (Redis-backed counters/breaker state) arrives with, and only with, the BullMQ deferral below.

### 9. Graceful shutdown

The existing graceful-shutdown hook must fire `AbortController.abort()` on in-flight provider calls during SIGTERM drain so no AI request hangs process shutdown.

### 10. Deferral / rejection ledger (supersedes Phase 3 plan assumptions — recorded, not silent)

| Item | Disposition | Reason |
|---|---|---|
| BullMQ / Redis consumers | **DEFERRED** | Zero v1 async consumers; docker-compose redis stays provisioned but unused by app code. ADR-007 remains the sanctioned mechanism when an async consumer exists (embedding pipeline, batch drafting) |
| Embedding generation pipeline | **DEFERRED** | Chart grounding uses deterministic per-patient retrieval (small, structured, provenance-authoritative corpora); pgvector table remains dormant until a scoped retrieval design lands |
| Identity OCR | **REJECTED (v1)** | PII-heavy vision workload, low clinical value, poor differentiation |
| Discharge-summary AI draft | **DEFERRED TO M13** | Discharge authoring workflow does not exist before M13 (ADR-015 Decision 2); M13 reuses M11 wholesale |
| Fallback provider/model chain | **NO (v1)** | Models differing in instruction-following are a safety liability; provider switch/fallback is a configuration operation |

### 11. Provider dependency policy (preserves ADR-005 interface verbatim)

- The `AIProviderAdapter` interface (`generateStructuredOutput`, `generateEmbedding`) is adopted unchanged from ADR-005. `generateEmbedding` is implemented for contract completeness but marked experimental-unused; the orchestrator MUST NOT call it in v1.
- Gemini SDK version **exact-pinned** in the lockfile per dependency policy.
- **Import boundary:** provider SDK modules may be imported ONLY inside `apps/backend/src/modules/ai/adapters/**`. Business code depends solely on the interface + shared DTOs. Enforced by lint boundary rule and reviewed tests.
- A deterministic **FakeProvider** implementing the identical interface — including fault-injection modes (timeout, malformed JSON, 429, 5xx toggles) — drives all CI suites. No test depends on network access to Google.
- Adapter responses persist `modelProvider` + `modelName` (+ returned version metadata) on every `ai_interactions` row (columns exist).

---

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Async job execution now (BullMQ) | No consumer; Redis+workers greenfield for zero v1 benefit; complicates the audit story (async attribution) |
| DB-polled background jobs | Rejected precedent (ADR-007 alternatives) |
| Retry-once-on-malformed | Doubles worst-case latency; masks provider-quality signals; user manual retry suffices |
| Multi-provider runtime routing | Premature; no second-provider requirement exists; config swap achieves portability |
| Automatic fallback model on failure | Unpredictable instruction-following degrades validated-output guarantees silently |
| Holding the create-tx open while drafting inline | Pins connections for seconds under LLM latency; rejected outright (Decision 2) |

## Consequences

- AI failure modes are bounded, observable, and incapable of degrading clinical workflows (no shared locks, no shared transactions, 503-family errors only).
- Cost exposure is capped hospital-wide per day (GLOBAL budget, Decision 7/8) and observable from day one via persisted token accounting; per-user invocation frequency is separately capped by Decision 6.
- Horizontal scaling requires no coordination beyond what Decision 8 documents.
- Migration path to async preserved: orchestrator is invocation-shaped (not HTTP-shaped), so a future BullMQ worker calls it unchanged.

## Explicit Acceptance Criteria

1. Slow-provider fixture proves no DB transaction/lock spans provider latency.
2. Breaker unit tests (fake clock): threshold, open duration, single half-open probe.
3. Forced provider failure leaves ZERO rows (interaction + audit absent) and all clinical endpoints unaffected.
4. Budget exhaustion ⇒ 429 before any provider call (verified pre-call, post-auth).
5. Semaphore overflow ⇒ immediate 503 BUSY.
6. SIGTERM aborts in-flight provider calls within graceful-shutdown window.
7. No provider SDK import outside `modules/ai/adapters/**` (lint-enforced).
8. Every interaction row persists provider + model identifiers.
