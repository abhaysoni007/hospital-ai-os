# ADR-019: AI Draft Lifecycle & Atomic Clinical Binding

**Status:** ACCEPTED
**Date:** 2026-08-26
**Author:** Phase 5 — M11/M12 Architecture Ratification (adversarial challenge passed)
**References:** `ADR-015 (Decisions 2, 3, 5, 7; "AI integration" deferral)`, `ADR-017 (transaction discipline)`, `ADR-018 (capability gates, manifest)`, `ADR-020 (audit events)`, `api-architecture.md §2.8 (superseded in part)`, `packages/shared/src/api/clinical.schemas.ts`, `modules/clinical/clinical.service.ts`, `domain-model.md §2.13`

---

## Status

ACCEPTED. Governs the full AI-draft lifecycle and its single point of entry into frozen clinical machinery.

## Context

ADR-015 explicitly deferred AI draft integration (`aiDraftId` remains unused/null throughout M9) and pre-aligned the SOAP content model so note-draft output maps verbatim onto accepted records. The dormant FK `clinical_records.ai_draft_id → ai_interactions.id` awaits activation. Two contradictions require explicit resolution here: api-architecture §2.8 implied a two-step accept (`PATCH …/action` then later record creation) which permits orphaned/inconsistent states; and the frozen M9 `soapContentSchema` (tuple of four identical section schemas) tolerates duplicate headings — a laxity M9 owns, but which an AI output validator must not inherit.

## Problem

Choose the safest lifecycle connecting a probabilistic artifact to deterministic clinical machinery such that: AI can never attach itself to an unrelated record; no race can double-bind; M9 remains behaviorally byte-frozen; and provenance survives edit→sign permanently.

---

## Decision

### 1. Lifecycle

```text
commission   POST /api/v1/ai/note-draft {encounterId, recordType: 'soap'|'progress_note', instructions?}
             → ADR-018 gates → context assembly (+ manifest) → provider call OUTSIDE any tx
             → validate (Zod strict + business + grounding + gap fidelity)
             → SHORT TX: INSERT ai_interactions(user_action='pending',
                 grounding_status='grounded'|'validation_failed', requested recordType +
                 input manifest persisted in context_summary) + audit AI_DRAFT_GENERATED
             → return draft + interactionId

accept       ≡ POST /api/v1/encounters/:encounterId/clinical-records carrying optional aiDraftId
             → ONE transaction: existing M9 create path (unchanged) + invariant checks B1–B10
               + guarded interaction transition pending→accepted + audit AI_DRAFT_ACCEPTED
             → clinical_records.ai_draft_id set at birth

reject       PATCH /api/v1/ai/interactions/:id/action {action:'rejected', reasonCategory}
edit-flag    PATCH /api/v1/ai/interactions/:id/action {action:'edited'}
expire       lazy — enforced only at bind time via TTL comparison (no scheduler)

regenerate   commission again ⇒ fully independent interaction row; prior rows age out independently
```

**"Accept" means EXACTLY one thing:** atomic bind-at-clinical-record-creation. There is no separate accept state that creates a record later. PATCH action exists solely for reject/edit-related lifecycle operations defined by the contract.

### 2. Binding invariants (all mandatory, evaluated inside the create transaction)

| # | Invariant | Failure |
|---|---|---|
| B1 | Interaction exists | 404 (existence privacy for foreign ids) |
| B2 | `interaction.initiatedBy === actor.staffId` | 404 (foreign-owned indistinguishable) |
| B3 | `interaction.interactionType === 'note_draft'` | 400 (chart_search ids unusable) |
| B4 | `interaction.grounding_status === 'grounded'` | 409 INVALID_STATE |
| B5 | `interaction.user_action === 'pending'` | 409 ALREADY_RESOLVED (covers rejected/edited/double-bind) |
| B6 | TTL valid: `created_at + AI_DRAFT_TTL(default 24h) > now()` | 409 EXPIRED |
| B7 | `record.encounterId === interaction.encounterId` | 400 ENCOUNTER_MISMATCH |
| B8 | Request `recordType ===` interaction's persisted drafted type | 400 TYPE_MISMATCH |
| B9 | The existing M9 create path executes UNCHANGED (permission, assigned+active physician, author = actor, content schema) | inherited 401/403/409 |
| B10 | Concurrency guard below succeeds | zero rows ⇒ entire transaction rolls back |

**B10 mechanism (race-proof):**

```sql
UPDATE ai_interactions
SET    user_action = 'accepted'
WHERE  id = $1 AND user_action = 'pending';
-- zero rows updated ⇒ ROLLBACK the clinical-record INSERT + audit
```

Concurrent bind attempts on one interaction resolve to exactly one committed record.

### 3. Rejection matrix (mandated tests)

Foreign interaction · wrong physician (non-initiator) · wrong encounter · wrong record type · expired interaction · already-rejected interaction · double-bind concurrency (N parallel binds ⇒ exactly 1 success) · regenerated independence (old draft expiry does not affect new). AI can never autonomously create a clinical record — binding exists only as an authenticated human request satisfying B1–B10.

### 4. M9 behavioral freeze guarantee

- The ONLY touchpoints to M9 code are **additive**: (a) optional `aiDraftId` on the shared create contract (today unknown keys are silently stripped by the discriminated union — without this contract change a sent id would vanish SILENTLY, which is worse than rejection); (b) `ClinicalRecordResponse` gains nullable **`aiDraftId`** — additive, read-only provenance surfacing.
- Absent `aiDraftId`, behavior is byte-identical to frozen M9; the M9 suite runs unchanged-green in every freeze gate.
- Sign path untouched: signing remains physician-only, author-only, version-incrementing (ADR-015 Decision 5).
- Amendment remains unreachable (ADR-015 Decision 3).

### 5. Strict AI-side SOAP validation (frozen schema NOT modified)

The frozen shared `soapContentSchema` accepts duplicate headings (four identical section schemas in a tuple) — M9 laxity deliberately left untouched. The **AI output validator adds a stricter check**: each heading `subjective`, `objective`, `assessment`, `plan` appears **exactly once**. Stricter-side-only divergence from the frozen schema is safe and requires no change to M9 contracts or data.

### 6. Permanent prohibitions (restated, binding)

AI must never sign, never amend, never verify diagnostic results, never classify critical values (ADR-010), and never autonomously create any clinical record. Every AI capability class remains DRAFT or READ_ONLY.

### 7. Provenance permanence

`ai_draft_id`, once set, is frozen by signed-record immutability. The original AI proposal persists verbatim in `ai_interactions.parsed_output`, so the diff between what the model proposed and what the clinician signed remains reconstructable for the life of the record. Nothing AI-derived ever mutates signed content.

---

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Two-step accept (PATCH accept, then separate create per §2.8 implication) | Orphan window between accept and create; drift/inconsistency states; superseded by atomic binding (**C1 resolution**) |
| Standalone "save draft" accept endpoint | Same orphan risk; two verbs for one act |
| Silent-drop of unrecognized aiDraftId | Current Zod union strips unknown keys — silent provenance loss; contract addition makes it explicit |
| Post-hoc provenance UPDATE after creation | Mutates clinical rows outside their creation path; violates immutability discipline |
| Loosening shared SOAP schema for AI needs | Modifies frozen M9; unnecessary — stricter AI-side validation suffices |

## Security Implications

B2/B7 close cross-user and cross-encounter attachment; B1's 404 semantics prevent interaction-id enumeration; B10 closes the double-bind race. No permission changes; all gates are service-layer refinements under ADR-018.

## Audit Implications

`AI_DRAFT_ACCEPTED` joins the business transaction (failure ⇒ full rollback of record + transition + audit), preserving the backend-architecture §5.3 contract for PHI mutations. Event payloads metadata-only per ADR-020.

## Explicit Acceptance Criteria

1. Full gate: commission → cited draft → bind → edit (existing M9 PATCH) → sign (existing M9 flow) → immutable signed record retaining `aiDraftId`.
2. Every §3 rejection case returns its mapped status with zero partial writes.
3. N parallel binds ⇒ exactly one success (live-DB test).
4. Induced audit failure during bind rolls back record AND interaction transition.
5. Duplicate-heading AI output rejected by the AI validator while an equivalent human-created record continues to pass the frozen M9 schema.
6. M9 suite green and unchanged; zero migrations.
