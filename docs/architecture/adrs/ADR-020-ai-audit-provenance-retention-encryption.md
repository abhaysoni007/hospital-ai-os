# ADR-020: AI Audit, Provenance, Retention & Encryption

**Status:** ACCEPTED
**Date:** 2026-08-26
**Author:** Phase 5 — M11/M12 Architecture Ratification (adversarial challenge passed)
**References:** `ADR-008 (audit hash chain)`, `ADR-017 (tail-tx discipline)`, `ADR-018 (manifest, terminology)`, `ADR-019 (lifecycle)`, `backend-architecture.md §5.3`, `security-architecture.md §3.2, §10`, `domain-model.md §2.13 (superseded in one cell)`, `utils/encryption.ts`, `docs/security/SECRETS_MANAGEMENT.md`

---

## Status

ACCEPTED. Governs AI observability, provenance integrity, data lifetime, and cryptographic handling.

## Context

The repository already owns an approved field-encryption primitive (`utils/encryption.ts`: AES-256-GCM, SHA-256-derived key, envelope `base64(iv):base64(authTag):base64(ciphertext)`) which **fails closed by throwing at encryption time in production** when `ENCRYPTION_KEY` is absent or shorter than 32 characters — a use-time failure the architecture must not discover inside a clinical transaction. The domain-model currently marks `parsed_output` sensitivity "No" although it stores derived clinical narrative. Retention for AI artifacts was undefined. The audit hash chain requires every PHI-relevant mutation to be covered in-transaction.

## Problem

Choose audit events and payload rules, encryption reuse and readiness gating, sensitivity classification, and retention semantics such that provenance is permanent, no second crypto system is invented, encryption failure is a boot-time posture rather than a runtime crash, and no legal claim is implied beyond what the system actually enforces.

---

## Decision

### 1. Audit event catalog & transaction discipline

| Event | Transaction discipline | Emitted when |
|---|---|---|
| `AI_DRAFT_GENERATED` | Own short tx with the interaction INSERT | note_draft completes (grounded or validation_failed) |
| `AI_SEARCH_EXECUTED` | Own short tx with the interaction INSERT | chart_search completes |
| `AI_DRAFT_ACCEPTED` | **Joins the clinical-record creation business tx** (failure ⇒ full rollback of record + interaction transition + audit) | atomic bind succeeds (ADR-019 B10) |
| `AI_DRAFT_REJECTED` | Own short tx | clinician rejects via PATCH action |

Payloads are **metadata-only**: actor identity (`actorId/actorRole/actorDepartment`), `targetType: 'AI_INTERACTION'`, `targetId`, `patientId?`, and `actionDetail {encounterId?, capability, promptTemplateId, modelProvider, modelName, inputTokens, outputTokens, latencyMs, groundingStatus}` plus `correlationId`. **No clinical narrative, no draft text, no raw PHI in any payload** (security-architecture §10). Rejection reasons: only a bounded reason CATEGORY enters the audit payload; free-text reason remains in the access-controlled `ai_interactions.rejection_reason` column.

### 2. Encryption — reuse, never reimplement

`raw_response` is encrypted at rest using the EXISTING `encryptField` primitive verbatim; the ciphertext envelope string is stored in the `raw_response` JSONB column:

```text
AES-256-GCM · fresh random 12-byte IV per call · 128-bit authentication tag
key = SHA-256(ENCRYPTION_KEY)   [existing derivation]
envelope = base64(iv):base64(tag):base64(ciphertext)
```

Creating any second encryption implementation is prohibited. Decryption occurs only in explicitly justified admin/debug paths; no API endpoint returns `raw_response`.

### 3. Pre-flight key validation (readiness gate)

At startup wiring — before the provider adapter is constructed — the subsystem validates `ENCRYPTION_KEY` presence and length under `NODE_ENV`. Failure posture:

- AI subsystem state = **disabled**; health endpoint reports disabled;
- AI endpoints return **503-family errors**;
- The application boots and ALL non-AI workflows operate normally.

Never a plaintext fallback. Never a mid-clinical-transaction discovery of encryption failure. This converts the primitive's production throw-at-use into a deterministic boot-time posture.

### 4. Sensitivity classification (corrects domain-model §2.13)

| Field | Classification | Handling |
|---|---|---|
| `raw_response` | Sensitive | Encrypted at rest (§2); never returned by APIs; never logged |
| `parsed_output` | **Internal / sensitive** (supersedes the "No" cell in domain-model §2.13) | Contains derived clinical narrative; stored plaintext ONLY because the table has no read endpoint; treated as gated data in any future surface; never logged |
| `context_summary` | Metadata-only | Interaction metadata + input manifest ids (no narrative values) |
| `rejection_reason` | Potentially PHI (free-text clinician input) | Access-controlled column; whole-row purge scope (§5); category-only in audit |

Prompt-version reproducibility: every interaction persists `prompt_template_id` (e.g., `note_draft@1`) enabling exact template reconstruction.

### 5. Retention — operational default, NOT a legal/compliance claim

| Class | Policy |
|---|---|
| BOUND interactions (referenced by `clinical_records.ai_draft_id`) | Retained for the lifetime of the linked clinical record — provenance permanence. FK protection makes accidental deletion structurally impossible |
| UNBOUND / pending interactions | **90-day operational default**, purgeable |

Statements of record:

1. This is an **operational default chosen by this ADR — not a legal or regulatory compliance position**; compliance verification remains out of scope per existing healthcare-compliance scoping.
2. Purge semantics = **whole-row deletion** (ciphertext blob and `rejection_reason` die together).
3. Audit events intentionally retain metadata pointers only; a dangling `target_id` after purge is correct-by-design — the chain records who/what-metadata, never payloads.
4. Mechanical purge enforcement is deferred until scheduler infrastructure exists (ADR-017 ledger); rows are trivially small until then.

### 6. Key rotation

Rotation = decrypt-all → re-encrypt-all under the new key using the existing primitive. Volume is small (encrypted blobs only). Procedure references `docs/security/SECRETS_MANAGEMENT.md`; keys never logged, never committed; rotation documented as manual for MVP consistent with security-architecture §3.3.

---

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| New/different cipher or library for AI blobs | Second implementation of an approved primitive; key-sprawl; prohibited |
| DB-level (pgcrypto) storage encryption for raw_response | Splits key management; application-layer primitive already approved and fail-closed |
| parsed_output stays "Non-sensitive" (domain-model as written) | It contains derived clinical narrative; classification would understate real sensitivity (**C2 resolution**) |
| Retain everything forever | Unbounded growth without provenance benefit beyond bound rows |
| Aggressive purge incl. bound interactions | Destroys signed-record provenance permanently |
| Legal-retention claims in docs | System cannot verify compliance; overclaiming is worse than silence |

## Audit Implications

Catalog post-ratification adds exactly four events to the hash-chained ledger. All write events follow backend-architecture §5.3 (in-business-tx where a business mutation exists). Chain continuity must be asserted across full commission→bind→sign sequences in tests.

## Security Implications

Readiness gate removes the runtime-crash class; encrypted-at-rest + no-read-API confines raw responses; metadata-only payloads keep the chain PHI-clean.

## Explicit Acceptance Criteria

1. DB-inspection test proves `raw_response` at rest is envelope ciphertext, decryptable only with the configured key.
2. Missing/weak `ENCRYPTION_KEY` in production-mode wiring ⇒ subsystem disabled, health accurate, endpoints 503-family, zero plaintext writes.
3. All four events emitted with correct tx discipline; induced-failure rollback covers `AI_DRAFT_ACCEPTED` fully.
4. Payload assertions across all four events contain no narrative/values.
5. Hash-chain continuity green after complete AI→sign sequences.
