# Hospital AI OS — AI Architecture

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** AI Rules, AI Safety (Phase 2.1), Healthcare Rules  
> **Scope:** Provider abstraction, prompt architecture, RAG, structured outputs, grounding, safety, observability

---

## 1. AI Design Principles

1. **AI is a tool, not an actor.** AI has no identity, no session, no permissions. It cannot authenticate, authorize, or commit state changes.
2. **All AI output is UNVERIFIED by default.** It must pass through the evidence verification lifecycle before any clinical use.
3. **AI is non-authoritative for clinical decisions.** AI output is a recommendation for human review — never an autonomous action.
4. **Critical/panic lab classification is PROHIBITED for AI.** Deterministic configured clinical rules are the sole authority. (See `PRODUCT_SPEC.md §7`, `AI_SYSTEM.md §3`.)
5. **Provider-agnostic.** The system must work with different LLM providers without architectural changes. (See `ADR-005`.)

---

## 2. Provider Abstraction Layer

### 2.1 Architecture

```text
┌─────────────────────────────────────────┐
│          AI Orchestration Service        │  ← Public interface to other modules
├─────────────────────────────────────────┤
│         Context Assembly                 │  ← Gathers patient/encounter data
├─────────────────────────────────────────┤
│         Prompt Builder                   │  ← Constructs system + context + user prompt
├─────────────────────────────────────────┤
│         Provider Adapter Interface       │  ← Abstract interface
├──────────┬──────────┬───────────────────┤
│ Google   │ OpenAI   │  Future Provider  │  ← Concrete adapters
│ Gemini   │ (future) │                   │
└──────────┴──────────┴───────────────────┘
```

### 2.2 Provider Adapter Interface

```typescript
interface AIProviderAdapter {
  generateStructuredOutput<T>(params: {
    systemInstruction: string;
    userPrompt: string;
    context: ContextBlock[];
    outputSchema: ZodSchema<T>;
    config: GenerationConfig;
  }): Promise<AIProviderResponse<T>>;

  generateEmbedding(text: string): Promise<number[]>;
}

interface AIProviderResponse<T> {
  parsedOutput: T;
  rawResponse: unknown;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  modelName: string;
}

interface GenerationConfig {
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  timeoutMs: number;
}
```

### 2.3 Initial Provider: Google Gemini

| Property              | Value                             |
| :-------------------- | :-------------------------------- |
| **Default model**     | `gemini-2.0-flash` (configurable) |
| **Structured output** | Native JSON mode with schema      |
| **Embeddings**        | `text-embedding-004`              |
| **SDK**               | `@google/generative-ai`           |

---

## 3. AI Capability Map

| Capability                                    | Module Integration        | Risk Level | Human Review                                         |
| :-------------------------------------------- | :------------------------ | :--------- | :--------------------------------------------------- |
| **Clinical note draft** (SOAP, progress note) | Clinical → AI → Clinical  | High       | **Mandatory** — side-by-side review, clinician signs |
| **Discharge summary draft**                   | Discharge → AI → Clinical | High       | **Mandatory** — physician reviews and authorizes     |
| **Patient chart search**                      | Clinical → AI → Response  | Medium     | User evaluates relevance; grounded source links      |
| **Identity document OCR**                     | Patient → AI → Patient    | Low        | Registration clerk verifies extracted fields         |

---

## 4. Prompt Architecture

### 4.1 Prompt Structure

Every AI request follows a three-layer prompt structure:

```text
┌──────────────────────────────────┐
│      SYSTEM INSTRUCTION          │  ← Role, safety rules, output format
│  (immutable per capability)      │
├──────────────────────────────────┤
│      CONTEXT BLOCK               │  ← Patient data, encounter data, records
│  (assembled from database)       │
│  [CLINICAL_CONTEXT_START]        │  ← Explicit delimiters
│  ... patient data ...            │
│  [CLINICAL_CONTEXT_END]          │
├──────────────────────────────────┤
│      USER INSTRUCTION            │  ← Specific task request
│  (from the clinician)            │
└──────────────────────────────────┘
```

### 4.2 System Instructions

System instructions are versioned templates stored in the codebase (not database). Each capability has its own system instruction.

**Key safety clauses included in every system instruction:**

- "You are a clinical documentation assistant. You MUST NOT make clinical decisions."
- "All output is a DRAFT for human review. Label it as AI-generated."
- "If information is insufficient, say so. Do NOT fabricate clinical information."
- "Do NOT include information not present in the provided clinical context."
- "Cite source records for every factual claim."

### 4.3 Context Assembly

Context for AI requests is assembled by the AI Orchestration Service from data already authorized for the requesting user:

| Capability            | Context Included                                                                                                                       |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Note draft**        | Patient demographics, encounter details, vitals history, active medications, allergies, chief complaint, prior notes in this encounter |
| **Discharge summary** | All encounter clinical records, lab results, medication changes, treatment summary, pending follow-ups                                 |
| **Chart search**      | RAG-retrieved document chunks relevant to the search query (scoped to authorized patient)                                              |
| **OCR**               | Raw document image (no additional clinical context)                                                                                    |

> [!IMPORTANT]
> Context assembly respects RBAC. The AI receives only data that the requesting user is authorized to see.

### 4.4 Prompt Injection Mitigation

| Strategy                        | Implementation                                                                                                        |
| :------------------------------ | :-------------------------------------------------------------------------------------------------------------------- |
| **Delimiter separation**        | System instructions and clinical context use explicit delimiters (`[SYSTEM_START]`, `[CLINICAL_CONTEXT_START]`, etc.) |
| **Input parameterization**      | User-provided text is inserted into designated slots, never concatenated with system instructions                     |
| **Output validation**           | AI output is validated against expected Zod schemas — unexpected structures are rejected                              |
| **No tool use**                 | AI is text-in/text-out only — no function calling, no web browsing, no code execution                                 |
| **Clinical content boundaries** | Patient-authored content (e.g., complaint text) is marked as `[PATIENT_INPUT]` in context                             |

---

## 5. RAG (Retrieval-Augmented Generation) Pipeline

### 5.1 Architecture

```text
Clinical Record Saved
       │
       ▼
 [Background Job: embedding.generate]
       │
       ▼
 Text extraction from JSONB content
       │
       ▼
 Embedding generation (AI Provider)
       │
       ▼
 Store in `embeddings` table (pgvector)

---

 Chart Search Query
       │
       ▼
 Query embedding generated
       │
       ▼
 pgvector similarity search (cosine distance)
   Filtered by patient_id (mandatory)
       │
       ▼
 Top-K relevant chunks retrieved
       │
       ▼
 Chunks injected as context into LLM prompt
       │
       ▼
 LLM generates answer with source citations
```

### 5.2 Embedding Strategy

| Property             | Value                                                                                     |
| :------------------- | :---------------------------------------------------------------------------------------- |
| **What is embedded** | Clinical records (SOAP notes, progress notes), diagnostic results                         |
| **Embedding model**  | `text-embedding-004` (768 or 1536 dimensions — configurable)                              |
| **Chunking**         | Per clinical record (each record is a single chunk for MVP — records are typically short) |
| **Content hashing**  | `content_hash` column detects when a record has changed and needs re-embedding            |
| **Scope**            | Embeddings are always scoped to a single patient — cross-patient search is prohibited     |

### 5.3 Why pgvector (Not a Dedicated Vector DB)

See **ADR-006**. Single database simplicity; sufficient for MVP scale. Migration path to dedicated vector DB preserved via abstracted embedding service.

---

## 6. Structured Output & Validation

### 6.1 Output Schemas

Every AI capability has a defined Zod schema for its output:

```typescript
// Example: Note Draft Output Schema
const NoteDraftOutputSchema = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      content: z.string(),
      sourceCitations: z
        .array(
          z.object({
            sourceType: z.string(),
            sourceId: z.string(),
            excerpt: z.string(),
          }),
        )
        .optional(),
    }),
  ),
  aiConfidenceNote: z.string().optional(),
  disclaimers: z.array(z.string()),
});
```

### 6.2 Validation Pipeline

```text
AI Raw Response
     │
     ▼
 JSON Parse (reject if not valid JSON)
     │
     ▼
 Zod Schema Validation (reject if schema mismatch)
     │
     ▼
 Business Rule Validation (e.g., no empty sections, citations reference real records)
     │
     ▼
 Grounding Check (are cited sources real and accessible?)
     │
     ▼
 VALIDATED output returned to calling service
```

---

## 7. Evidence Verification Lifecycle

As defined in `AI_SAFETY.md §1`:

```text
UNVERIFIED → GROUNDED → VALIDATED → HUMAN_REVIEWED → APPROVED → COMMITTED → VERIFIED
```

| Stage              | Actor                  | What Happens                                                                   |
| :----------------- | :--------------------- | :----------------------------------------------------------------------------- |
| **UNVERIFIED**     | AI Provider            | Raw LLM response received                                                      |
| **GROUNDED**       | System (deterministic) | Schema validated; source citations verified against real records               |
| **VALIDATED**      | System (deterministic) | Business rules checked; structural correctness confirmed                       |
| **HUMAN_REVIEWED** | Clinician              | Draft presented to user with "AI-Generated" label; user reads, edits if needed |
| **APPROVED**       | Clinician              | User explicitly clicks "Sign" or "Accept"                                      |
| **COMMITTED**      | System                 | Record saved to database; audit event emitted                                  |
| **VERIFIED**       | System                 | Confirmation displayed to user                                                 |

At any stage, the clinician can **reject** the draft. Rejection is a first-class outcome, logged with reason.

---

## 8. Circuit Breaker & Fallback

### 8.1 Circuit Breaker

| Parameter               | Value                                                              |
| :---------------------- | :----------------------------------------------------------------- |
| **Failure threshold**   | 3 consecutive failures or >50% failure rate in 60s window          |
| **Open state duration** | 30 seconds (then half-open — single probe request)                 |
| **Timeout per request** | 30 seconds (configurable via `AI_TIMEOUT_MS`)                      |
| **Monitored failures**  | HTTP errors (5xx), timeouts, rate limit (429), malformed responses |

### 8.2 Fallback Behavior

When the circuit breaker is **open**:

- AI endpoints return `503 AI_SERVICE_UNAVAILABLE`
- Frontend displays "AI assistance temporarily unavailable" banner
- **All non-AI workflows remain fully functional** (core product requirement)
- Manual clinical note entry, discharge summary, lab result entry — all continue normally

### 8.3 Retry Policy

- **No automatic retry** for user-facing AI requests (to avoid latency doubling)
- User can manually retry via the UI
- Background jobs (embedding generation) retry with exponential backoff (2 retries)

---

## 9. AI Observability

### 9.1 Metrics Tracked

| Metric                            | Granularity                    |
| :-------------------------------- | :----------------------------- |
| Request count                     | Per capability, per model      |
| Latency (p50, p95, p99)           | Per capability                 |
| Token usage (input + output)      | Per request, per user, per day |
| Error rate                        | Per capability, per error type |
| Circuit breaker state changes     | Per event                      |
| Cache hit rate (embedding lookup) | Per query                      |
| User acceptance/rejection rate    | Per capability                 |

### 9.2 AI Interaction Logging

Every AI invocation is logged to the `ai_interactions` table:

- Prompt template version
- Context summary (no raw PHI — summary metadata only)
- Model used
- Token counts
- Latency
- Grounding status
- User action (accepted/rejected/edited)
- Rejection reason (if rejected)

### 9.3 Cost Controls

- Per-user daily token budget (configurable)
- Per-request maximum context size (configurable via `AI_MAX_TOKENS`)
- Monthly usage dashboards (admin)
- Alert on unusual token consumption spikes

---

## 10. Deterministic vs AI Boundary Summary

| Function                              | Mechanism                                   | AI Permitted?       |
| :------------------------------------ | :------------------------------------------ | :------------------ |
| **Critical/panic lab classification** | Deterministic clinical rules                | **NO — PROHIBITED** |
| **Abnormal trend surfacing**          | AI (grounded, human-reviewed)               | Yes                 |
| **Clinical note drafting**            | AI (side-by-side human review)              | Yes                 |
| **Discharge summary drafting**        | AI (physician authorization required)       | Yes                 |
| **Chart search**                      | AI + RAG (grounded source citations)        | Yes                 |
| **Document OCR**                      | AI (human verification of extracted fields) | Yes                 |
| **Clinical state changes**            | Human clinician only                        | **NO — PROHIBITED** |
