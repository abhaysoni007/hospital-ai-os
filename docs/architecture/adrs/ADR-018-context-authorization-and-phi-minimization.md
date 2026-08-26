# ADR-018: AI Context Authorization, PHI Minimization & Grounding Terminology

**Status:** ACCEPTED
**Date:** 2026-08-26
**Author:** Phase 5 — M11/M12 Architecture Ratification (adversarial challenge passed)
**References:** `security-architecture.md §2.3, §5.2, §10`, `ADR-013`, `ADR-015 (Decisions 4, 7)`, `ADR-016 ("M11/M12 Boundary")`, `ai-architecture.md §4.3–§4.4`, `middleware/rbac/authorization-context.ts`, `modules/clinical/clinical.service.ts` (read-scope precedent), `PROMPT_ARCHITECTURE.md`

---

## Status

ACCEPTED. Governs every byte that enters an AI prompt.

## Context

Context assembly is the highest-consequence AI surface: a convenience query or a transitive join here becomes a silent PHI bypass invisible to the RBAC matrix. The M5 matrix grants `ai_interaction:invoke` to physician and nurse with the nurse cell annotated "(limited)" — never defined. ADR-015 established the governing precedent that capability-level refinements live in the service layer without touching the frozen matrix. The adversarial challenge identified concrete bypass vectors (wholesale patient-service reuse, cached context, prior-AI-output feedback loops) and demanded an honest grounding vocabulary.

## Problem

Choose enforceable mechanisms guaranteeing that **the AI receives exactly — and only — what the requesting clinician could read directly**, with minimum-necessary fields, deterministic gap detection, and terminology that never overclaims.

---

## Decision

### 1. Server-side, per-request assembly

All context is assembled server-side at invocation time from live authorized data. The client supplies only `{encounterId | patientId}` + optional bounded instructions. No client-supplied context is ever trusted; no context is cached or memoized across requests.

### 2. Two-layer enforcement: AUTHORIZED READERS + ALLOWLIST PROJECTIONS

Reader reuse alone is insufficient. Both layers are mandatory:

1. **Authorized readers** — rows are obtained ONLY through existing domain service readers (`clinical.service`, `diagnostics.service`, `encounter.service`) invoked with the caller's `AuthorizationContext {staffId, role, departmentId}`, inheriting every established scope check (assigned-doctor, department parity). The AI module MUST NOT query clinical/diagnostic/patient tables directly.
2. **Allowlist projections** — reader output passes through explicit per-block-type projection contracts (`ContextBlockSchema`, Zod, shared package) enumerating allowed fields. Projection is allowlist-by-construction, never strip-listing. An unknown block type fails the assembly (fail closed).

### 3. Capability gates (service layer; M5 matrix unchanged)

| Capability | Gate |
|---|---|
| `note_draft` | physician AND assigned doctor of the encounter AND encounter `active` — the exact predicate of ADR-015 Decision 7 record creation: only the eventual signer commissions the draft |
| `chart_search` | physician OR nurse, with department parity over every retrieved record (`readScopeOk` semantics) |

**Nurse AI scope — precise definition (resolves security-architecture §2.3 "(limited)"):**
A nurse holding `ai_interaction:invoke` may invoke **read-only capabilities only** (`chart_search`). Nurses cannot commission note drafts (they are never the assigned signing physician), and no write-capable AI capability exists for any role in v1. This materializes the existing "(limited)" annotation without altering the permission matrix.

### 4. Minimum-necessary field contract

| Context block | Allowed into prompt | Forbidden |
|---|---|---|
| Patient | integer age **computed server-side**, gender | name, MRN, DOB (never transmitted — age derived then discarded), contacts, address, identity numbers/images |
| Encounter | type, status, startedAt, department name, chiefComplaint where caller holds `clinical_record:read` (ADR-013 alignment) | other patients' data |
| Clinical records | section texts / narrative, recordType, recordedAt, version | author names/IDs |
| Diagnostic orders | testCode, testName, priority, status, timestamps | collectedBy identities |
| Diagnostic results | parameter, value, unit, **deterministic evaluator verdict**, reference-range snapshot, isCritical, verification status | enteredBy/verifiedBy identities |
| Staff / prior AI interactions | nothing | all staff identity; ALL prior interaction content |

> **"Minimized does not mean anonymized."** Age+gender clinical context is not k-anonymous. The control objective is least-privilege and provider-side exposure reduction — not publication-grade anonymization — and it is documented as such.

Every prompt is additionally asserted free of identifier patterns (name/MRN/phone/address/ID regex battery) in CI fixtures.

### 5. Mandatory prohibitions

1. **No context caching** — assemblies are never persisted or reused as a cache.
2. **No AI-history-as-context** — prior `ai_interactions` content (including one's own `parsed_output`) never enters context assembly.
3. **No chained-AI-output-as-context** — output of one capability (e.g., chart brief) is never input to another.
4. **No embeddings retrieval in v1** — the `embeddings` table stays dormant until a scoped design exists (ADR-017).
5. **No cross-encounter note-draft context** — note-draft manifests are strictly encounter-scoped by construction.

### 6. Deterministic information-gap detection BEFORE provider invocation

The assembler deterministically computes which expected blocks were empty/absent *before* the LLM runs (e.g., no chief complaint ⇒ SUBJECTIVE gap flagged; no vitals records ⇒ OBJECTIVE gap flagged; no medication module ⇒ medication gap). Computed gaps are injected into the prompt and validated post-generation: **output `informationGaps` ⊇ computed gaps** — gap fidelity is machine-checked, making "Not documented" markers carry system authority rather than model candor.

### 7. Citation & grounding terminology (binding)

- Adopted term: **"SOURCE-GROUNDED (provenance-verified)."**
- Forbidden claims everywhere (UI, docs, marketing): "clinically correct", "verified accurate", "AI-validated diagnosis".
- Structural grounding proves schema integrity + citation provenance + gap fidelity. It does **NOT** prove semantic entailment between a cited source and a generated sentence. Human review is the sole semantic control.

### 8. Input manifest persistence

Each assembly persists an input manifest — `{sourceType, sourceId, version?, capturedAt}[]` — inside the interaction's `context_summary` JSONB. This manifest is the sole basis of citation validation (ADR-019) and the audit reconstruction basis (ADR-020). No migration required.

### 9. Mixed-department authorization fixtures (mandated tests)

A seeded patient with encounters in two departments MUST demonstrate: physician/nurse `chart_search` excludes out-of-department encounters from both the assembled manifest and the serialized prompt; `note_draft` denies non-assigned/cross-department physicians; nurse `note_draft` → 403 despite holding the permission.

### 10. M10 non-coupling

No AI invocation may enter M10 transactional workflows (result entry, verification, critical-alert chain). A future result-narration capability executes outside M10 transactions, writes nothing to `diagnostic_results` (the `ai_summary` column remains null per ADR-016), and classifies nothing. Deterministic classification remains the sole authority (ADR-010).

### 11. Prompt-injection posture (summary; mechanics in PROMPT_ARCHITECTURE.md)

Clinical text is untrusted data: trusted instruction layer vs delimited untrusted slots, delimiter canonicalization, no tool surface, schema-only output acceptance. Residual risk stated honestly: injection may degrade draft prose (caught by mandatory human review); it cannot mutate state, escalate authorization, fabricate validatable citations, or exfiltrate beyond the caller's own authority.

> **M12.1 correction (Full System Audit finding P0-2):** the versioned prompt
> template is the SINGLE authoritative rendering path. The Gemini adapter
> previously prepended its own `JSON.stringify(context)` ahead of the template
> output, bypassing canonicalization on the real provider wire and doubling
> context tokens. Adapters now send the template-rendered `userPrompt` verbatim;
> adversarial wire-format tests (`gemini-adapter.wire.test.ts`, M11 gate, M12.1
> gate) assert the rendered request contains exactly one canonical context
> boundary and zero forged slot/system tokens.

---

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Reader reuse alone without projections | Wholesale patient rows would import forbidden identifiers; allowlist layer is the enforcement point for minimum-necessary |
| Raw queries with hand-rolled filters | Duplicates scope logic; drifts silently; defeats single-source-of-truth authorization |
| Post-hoc redaction of full records | Strip-listing fails open on new fields; allowlisting fails closed |
| Cached/shared context blocks | Cross-user leakage vector; violates per-request authorization freshness |
| Vector retrieval for chart grounding now | Requires job infra with zero consumers; deterministic retrieval is more auditable at this scale (ADR-017) |

## Security Implications

- No permission added, removed, or reinterpreted at the matrix level; nurse limitation is a service-layer refinement under the ADR-015 precedent.
- Fail-closed throughout: unknown role/block/projection ⇒ denial before any provider call.
- Prompt contents provably a subset of the caller's direct-read authority (fixture-proven).

## PHI Implications

- Direct identifiers never reach the provider; DOB never leaves the server.
- Manifests and audit payloads carry ids/metadata only (security-architecture §10 preserved).

## Audit Implications

Manifest enables post-hoc reconstruction of exactly which sources grounded each draft (consumed by ADR-020 payload rules).

## Explicit Acceptance Criteria

1. Mixed-department fixture suite green (§9 assertions).
2. Identifier-pattern battery over serialized prompts green.
3. Unknown ContextBlock type ⇒ assembly error (unit-tested).
4. Nurse note_draft → 403; receptionist/admin/security_admin → 403 on all AI routes (matrix extension suite).
5. Gap-fidelity validation rejects outputs omitting system-computed gaps.
