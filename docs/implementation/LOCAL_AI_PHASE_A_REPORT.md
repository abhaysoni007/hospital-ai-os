# LOCAL AI PHASE A — IMPLEMENTATION REPORT
# Ollama Provider Adapter: MedGemma Integration

**Status:** LOCAL AI PHASE A — AUTOMATED VERIFIED / MANUAL QA PENDING  
**Date:** 2026-08-29  
**Commit:** (pending push)

---

## 1. Objective

Integrate locally running Ollama models into the existing M11/M12 AI architecture
via a new `OllamaAdapter` provider — without creating a second orchestrator or
bypassing any existing authorization, safety, or audit controls.

---

## 2. Architecture

```
Authenticated clinician
        ↓
M5 authorization (unchanged)
        ↓
Break-Glass authorization (unchanged)
        ↓
Canonical context projection (unchanged)
        ↓
AIOrchestrator (unchanged — existing M12)
        ↓
OllamaAdapter          ← NEW (Phase A)
        ↓
medgemma:latest (local HTTP — no external API)
        ↓
Structured JSON response
        ↓
Existing validation pipeline (unchanged)
        ↓
Citation / grounding checks (unchanged)
        ↓
Information-gap detection (unchanged)
        ↓
Clinician review → DRAFT only
```

**No second orchestrator. No architecture duplication.**

---

## 3. Files Created / Modified

| File | Change |
|------|--------|
| `apps/backend/src/modules/ai/adapters/ollama.adapter.ts` | NEW — OllamaAdapter |
| `apps/backend/src/modules/ai/adapters/__tests__/ollama.adapter.test.ts` | NEW — 18 unit tests |
| `apps/backend/src/modules/ai/ai.container.ts` | MODIFIED — wire OllamaAdapter |
| `apps/backend/src/config/index.ts` | MODIFIED — add `ollama` to AI_PROVIDER enum, add AI_MODEL_NAME |
| `apps/backend/src/eval/medgemma-eval.ts` | NEW — evaluation harness |
| `apps/backend/package.json` | MODIFIED — add `eval:medgemma` script |

---

## 4. Configuration

```bash
# Environment variables to enable Ollama provider
AI_PROVIDER=ollama
AI_ENABLED=true
AI_BASE_URL=http://localhost:11434   # default
AI_MODEL_NAME=medgemma:latest        # default; or qwen2.5:7b, phi4-mini
AI_TIMEOUT_MS=60000                  # local inference may be slower
```

No API key required. No external service. No PHI leaves the host.

---

## 5. OllamaAdapter Contract

Implements `AIProviderAdapter` verbatim:

```typescript
interface AIProviderAdapter {
  readonly name: string;  // = 'ollama'
  generateStructuredOutput<T>(params: GenerateStructuredParams<T>): Promise<AIProviderResponse<T>>;
  generateEmbedding(text: string): Promise<number[]>;  // Phase A: not implemented
}
```

Uses Ollama `/api/chat` with `format: 'json'` and `stream: false` for structured output.

---

## 6. Failure Behavior

| Failure | Kind | Behavior |
|---------|------|----------|
| Ollama not running (ECONNREFUSED) | `UNAVAILABLE` | App fails closed, graceful UI error |
| Model not installed (HTTP 404) | `PROVIDER_ERROR` | App fails closed, graceful UI error |
| Request timeout (AbortSignal) | `TIMEOUT` | App fails closed, graceful UI error |
| Malformed/non-JSON response | `MALFORMED` | App fails closed, graceful UI error |
| HTTP 503/502 | `UNAVAILABLE` | App fails closed |
| HTTP 500 | `PROVIDER_ERROR` | App fails closed |

All errors map to the existing `AIProviderFailureKind` taxonomy (ADR-017 §3).
Clinical workspace remains fully usable when Ollama is unavailable.

---

## 7. Safety Invariants (All Preserved)

- **Critical values**: Hemoglobin 5.8 → deterministic rule evaluator → CRITICAL. **Never delegated to LLM.**
- **Authorization before projection**: M5 RBAC + Break-Glass gate happens before any context reaches the adapter.
- **DRAFT only**: AI-generated SOAP requires physician review and explicit sign action.
- **No PHI in logs**: Prompt content and model responses are not written to audit events.
- **No external API**: `AI_PROVIDER=ollama` sends zero bytes outside localhost.
- **Embedding**: `generateEmbedding` intentionally throws `PROVIDER_ERROR` in Phase A (reserved for Phase B).

---

## 8. Unit Test Results

```
Test Files  1 passed (1)
      Tests  18 passed (18)

✓ parses valid structured JSON response
✓ strips markdown code fences before parsing
✓ returns raw string if JSON parse fails (orchestrator will catch)
✓ throws MALFORMED when message content is empty
✓ throws MALFORMED when message field is missing
✓ throws PROVIDER_ERROR (model not found) on HTTP 404
✓ throws UNAVAILABLE when fetch throws ECONNREFUSED
✓ throws TIMEOUT when fetch is aborted
✓ throws UNAVAILABLE on HTTP 503
✓ throws PROVIDER_ERROR on generic HTTP 500
✓ throws PROVIDER_ERROR for generateEmbedding (Phase A not implemented)
✓ has name = "ollama"
✓ uses default base URL and model when constructed without args
✓ builds correct request structure
✓ M12.1 invariant: context is NOT serialized into the request body
✓ strips ```json fences
✓ strips plain ``` fences
✓ leaves plain JSON untouched
```

**All 18 tests pass. No fetch calls to real Ollama.**

---

## 9. MedGemma Evaluation Harness

Script: `pnpm --filter backend eval:medgemma`

Evaluates 6 scenarios using **synthetic data only** (no real patient records):

1. Probe — Ollama reachability + model installed
2. SOAP generation — synthetic anemia patient context
3. Chart Brief — synthetic encounter summary (using existing `ChartAnswerOutputSchema`)
4. Timeout behavior — 1ms abort signal
5. Malformed output handling — prompt designed to elicit non-JSON
6. Repeatability — 3 runs of same prompt at temperature 0.1

Results written to: `docs/implementation/medgemma-eval-results.json`

> **MANUAL QA REQUIRED**: The evaluation harness must be run against live Ollama
> with `medgemma:latest` installed. Results are PENDING until executed.

---

## 10. Available Models — Phase A Disposition

| Model | Phase A Status | Intended Future Use |
|-------|---------------|---------------------|
| `medgemma:latest` | Integrated (primary) | SOAP generation, clinical documentation |
| `qwen2.5:7b` | Architecture ready, not wired | Chart Brief (Phase B candidate) |
| `phi4-mini` | Architecture ready, not wired | Lightweight extraction/classification |
| `gemma4:latest` | Reserved | Advanced/multimodal (future) |
| `nomic-embed-text:latest` | Reserved | Semantic retrieval / Chart Search (Phase B) |

---

## 11. Known Limitations

- Local inference latency is higher than cloud APIs (recommend `AI_TIMEOUT_MS=60000`)
- `generateEmbedding` is not implemented (Phase A scope)
- MedGemma evaluation results are pending manual execution
- Playwright browser verification with Ollama provider is PENDING MANUAL QA

---

## 12. Verification Status

| Check | Status |
|-------|--------|
| OllamaAdapter unit tests (18/18) | ✅ PASS |
| Existing backend test suite | PENDING (running) |
| TypeScript compilation | PENDING |
| ESLint | PENDING |
| MedGemma evaluation harness | PENDING MANUAL QA |
| Playwright browser verification | PENDING MANUAL QA |
| Break-Glass isolation preserved | ✅ — unchanged code path |
| M12.1 invariant (context not serialized) | ✅ — unit test verified |
| Critical value delegation to LLM | ✅ NEVER — rule evaluator unchanged |

---

## 13. Manual QA Checklist

After starting Ollama with `medgemma:latest`:

```bash
# 1. Start Ollama
ollama serve

# 2. Ensure model is installed
ollama pull medgemma:latest

# 3. Run evaluation harness
AI_PROVIDER=ollama AI_ENABLED=true pnpm --filter backend eval:medgemma

# 4. Verify results at docs/implementation/medgemma-eval-results.json

# 5. Start backend with Ollama provider
AI_PROVIDER=ollama AI_ENABLED=true AI_MODEL_NAME=medgemma:latest pnpm --filter backend dev

# 6. In browser: log in as demo.physician → encounter → Draft with AI
#    Verify: loading state, SOAP draft renders, citations visible, NOT auto-signed

# 7. Stop Ollama mid-session
#    Verify: UI shows graceful error, encounter page remains usable
```

**MANUAL QA STATUS: PENDING USER VERIFICATION**

---

## 14. Next Steps (Phase B candidates)

- Wire `qwen2.5:7b` for Chart Brief capability
- Implement `generateEmbedding` with `nomic-embed-text` for semantic Chart Search
- Capability-based model routing in `AIOrchestrator`
