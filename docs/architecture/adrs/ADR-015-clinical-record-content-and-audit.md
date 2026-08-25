# ADR-015: Clinical Record Content Model, Draft Auditing & Lifecycle Rulings

**Status:** ACCEPTED  
**Date:** 2026-08-25  
**Author:** Phase 5 — M9 Architecture Finalization  
**Supersedes:** None (resolves the api-architecture §2.5 audit gap noted against backend-architecture §1)  
**References:** `backend-architecture.md §1, §5.3`, `api-architecture.md §2.5`, `domain-model.md §2.7`, `database-design.md §2, §4, §5`, `security-architecture.md §2.3, §10`, `ai-architecture.md §6.1`, `ADR-008`, `ADR-010`, `ADR-013`

---

## Status

ACCEPTED. This ADR unblocks M9 implementation.

---

## Context

M9 (Clinical Module) is fully specified at the endpoint level (`api-architecture.md §2.5`) and the schema level (`clinical_records`, M2 migration), but the architecture review identified three gaps that block implementation:

1. **Draft-update auditing contradiction:** `backend-architecture.md` §1 mandates that *"state-changing operations emit audit events synchronously within a DB transaction boundary"*, yet the §2.5 endpoint catalog shows no audit event for `PATCH …/clinical-records/:id`. Clinical drafts are PHI/Critical.
2. **Undefined content model:** no authoritative document defines the JSON structure of SOAP sections, progress-note narrative, or vital-sign fields/units/ranges stored in `content` / `vitals` JSONB columns.
3. **Lifecycle ambiguities:** the `amended` enum value has no API contract; pharmacist/lab-technician read scopes (`meds_only`/`orders_only`) reference artifacts that do not exist before M10/M13; sign-vs-version semantics and access-audit granularity were unspecified.

## Problem

Choose authoritative rulings for each gap such that M9 can be implemented without inventing functionality, modifying the frozen M5 permission matrix, or altering the database schema.

---

## Decision

### Decision 1 — Draft updates MUST be audited: new event `CLINICAL_RECORD_DRAFT_UPDATED`

The general principle in `backend-architecture.md §1` governs over the illustrative "—" in the §2.5 table (same precedence rule as ADR-013).

- New audit event: **`CLINICAL_RECORD_DRAFT_UPDATED`**.
- Emitted synchronously inside the SAME database transaction as the record update; audit failure rolls back the update entirely (`backend-architecture.md §5.3` contract).
- Payload contains exactly: actor identity (`actorId`, `actorRole`, `actorDepartment`), `targetType: 'CLINICAL_RECORD'`, `targetId` (= recordId), `patientId`, `actionDetail: { encounterId, recordType, resultingVersion }`, `correlationId`.
- **No clinical narrative, no vitals values, no PHI content** in the payload (security-architecture §10).
- Rationale: drafts contain diagnoses and examination findings (PHI/Critical). An unaudited mutation path for PHI would make the hash-chained audit trail incomplete for exactly the data class it most needs to protect — who changed which clinical document, when, and to what version.

The event name was verified absent from every existing catalog and code path — no conflict.

### Decision 2 — Structured content model (no free-form JSON)

Content is validated per `recordType` via shared Zod schemas (discriminated union). Unrestricted free-form JSON is rejected.

**SOAP** (`recordType = 'soap'`) — `content`:
```json
{ "sections": [
    { "heading": "subjective",  "content": "…" },
    { "heading": "objective",   "content": "…" },
    { "heading": "assessment",  "content": "…" },
    { "heading": "plan",        "content": "…" }
] }
```
- Exactly these four headings; each section's `content` required, trimmed, non-empty, max 10,000 chars.

**Progress note** (`progress_note`) — `content`: `{ "narrative": string }` — required, trimmed, non-empty, max 20,000 chars.

**Vital signs** (`vital_signs`) — values stored in the dedicated `vitals` JSONB field (NOT in `content`). Ratified fields, all optional, numeric with normalized units and validated ranges; invalid values rejected:
| Field | Unit | Range |
|---|---|---|
| `temperature_c` | °C | 25–45 |
| `pulse_bpm` | beats/min | 20–300 |
| `resp_rate` | breaths/min | 4–80 |
| `bp_systolic` | mmHg | 40–300 |
| `bp_diastolic` | mmHg | 20–200 |
| `spo2_pct` | % | 50–100 |
| `weight_kg` | kg | 0.3–500 |
| `height_cm` | cm | 30–260 |

For `vital_signs`, `content` carries `{ "note": string }` (optional bounded remark ≤ 2,000 chars); `vitals` MUST be a non-empty object of valid fields.

**Discharge summary** (`discharge_summary`) — the enum value remains valid and MAY be accepted at schema level (the DB contract requires it); its content model reuses the progress-note narrative shape as placeholder. **M9 implements NO discharge workflow** — authoring/workflow belongs to M13. No discharge endpoints, transitions, or UI in M9.

**AI integration:** `aiDraftId` remains unused/null throughout M9. No AI endpoints. The sections model deliberately mirrors `ai-architecture.md §6.1` so M12 note-draft output maps directly onto accepted records.

### Decision 3 — Amendment DEFERRED

`amended` exists in the authoritative pgEnum and domain model but has no API contract anywhere. Therefore:

- M9 lifecycle is exactly: **`draft ⇄ draft` (edits) → `signed`**.
- No `signed → amended`, no `amended → anything`, no amendment endpoint/schema/UI/service branch.
- The enum value REMAINS in the database (already authoritative; removing it would require a destructive migration for zero benefit).
- Amendment requires a future architectural decision (endpoint shape, versioning of superseded versions, scope) BEFORE any implementation. Tracked as deferred functionality.

### Decision 4 — Pharmacist/LabTech read scopes: temporary compatibility interpretation

The M5 matrix scopes `pharmacist → meds_only` and `lab_technician → orders_only` reference medication and diagnostic artifacts that do not exist until M10/M13. For M9 ONLY:

- Both scopes are temporarily interpreted as **department-scoped clinical-record read** (identical enforcement path to physician dept-read).
- This interpretation is explicitly TEMPORARY. At M10 planning, the scopes must be re-evaluated and tightened once diagnostic data exists.
- The M5 permission matrix itself is NOT modified — this is a service-level interpretation of existing grants, recorded here so the tightening obligation is tracked.

### Decision 5 — Signing increments version

Signing is a state-changing mutation and participates in the single monotonic version model:

```
draft @ version N  →  POST /sign (expectedVersion = N)
→ UPDATE … SET status='signed', signed_by=?, signed_at=NOW(), version=N+1
  WHERE id=? AND version=N AND status='draft'
→ signed @ version N+1   (e.g., draft v3 → signed v4)
```

- Stale `expectedVersion` → `409 VERSION_CONFLICT`.
- Already signed (version matches or not, status ≠ draft) → `409 INVALID_TRANSITION`.

### Decision 6 — Access audit granularity: one event per HTTP request

Both read endpoints emit **one** `CLINICAL_RECORD_ACCESSED` event per request:

- List endpoint: one event covering the request (identifies actor, action `LIST`, encounterId, correlationId).
- Single-record endpoint: one event identifying actor, action `READ`, encounterId, requested recordId, correlationId.
- Never one event per returned record — per-record events on list views would create write amplification and contend the `audit_events` EXCLUSIVE hash-chain lock (see ADR-008/§9 concurrency).
- No clinical content in payloads.
- Access events use their own transaction (read-only operations have no business tx to join), matching the `PATIENT_ACCESSED` precedent.

### Decision 7 — Authoring/editing scope rules

| Actor | Create | Edit own draft | Sign |
|---|---|---|---|
| Physician | `soap`, `progress_note`, `discharge_summary`(schema-level), on encounters where they are the assigned doctor AND encounter is `active` | ✅ author-only | ✅ own draft only (`createdBy === actor.staffId`) |
| Nurse | `vital_signs` ONLY, within their own department, on `active` encounters | ✅ own drafts only (`createdBy === actor.staffId`), vitals-only types | ❌ never (no `clinical_record:sign`) |

- Nurses cannot edit other staff members' drafts (`createdBy === actor.staffId` enforced server-side).
- Physicians likewise edit only their own drafts (author-only editing, symmetric with `sign: own_draft`).
- All rules enforced in the service layer; the frontend applies no security logic.

### Decision 8 — Encounter-active requirement

- **Creating** a clinical record requires: encounter exists AND `encounter.status = 'active'`.
- **Existing drafts** remain readable, editable (by their authors, per Decision 7) and signable after the encounter leaves `active`, subject to their normal authorization and state rules.
- Rationale: care documentation started during an active consultation must not become inaccessible because the encounter later progresses toward discharge; conversely, new documentation must not be attached to closed episodes.
- No new encounter states are created; M13 will govern late-stage documentation policy during discharge.

---

## Alternatives Considered

| Alternative | Reason rejected |
|:---|:---|
| Keep draft updates unaudited (literal §2.5 reading) | Creates an unlogged mutation path for PHI/Critical data; contradicts the normative §1 auditing principle and undermines ADR-008 tamper-evidence value |
| Free-form JSON content | No validation, no AI-schema alignment (ai-architecture §6.1 requires structured output), breaks grounding and rendering contracts |
| Field-level write permissions for nurse vitals-only | Requires inventing new permissions/claims; type-level restriction achieves the architecture's intent within the frozen matrix |
| Implement amendment now | No API contract, no supersede semantics defined anywhere; inventing them risks clinical-safety defects; deferred explicitly |
| Per-record access events | Hash-chain write amplification under list loads |
| Separate sign-version counter | Two counters break the single optimistic-concurrency model proven in M8 |
| DB trigger enforcing signed immutability | database-design §5 assigns immutability to the application layer; triggers obscure business logic (rejected precedent: ADR-011 Option D rationale) |

## Security Implications

- No permission added, removed, or reinterpreted at the matrix level; all enforcement remains backend-authoritative middleware + service scope checks.
- Signed immutability closes the post-signature tamper window at the application layer per database-design §5.
- Department/assignment scoping follows the fail-closed M8 pattern; unknown roles receive nothing.

## PHI Implications

- Clinical content/vitals appear ONLY in permission-gated API responses — never in URLs, query strings, logs, or audit payloads (security-architecture §10).
- Audit payloads carry metadata only (ids, type, version).
- ADR-013 remains fully valid: encounter detail still embeds no record content; these nested endpoints are the sole gated access path.

## RBAC Implications

- Matrix unchanged. New service-level refinements documented here: nurse vitals-only typing, author-only editing, own-draft signing, department parity for reads.
- Pharmacist/lab-tech interim dept-read (Decision 4) is a temporary interpretation requiring revisit at M10 — tracked in Deferred Functionality.

## Audit Implications

- Catalog after this ADR: `CLINICAL_RECORD_CREATED`, `CLINICAL_RECORD_DRAFT_UPDATED` (new), `CLINICAL_NOTE_SIGNED`, `CLINICAL_RECORD_ACCESSED`, `CLINICAL_RECORD_AMENDED` (reserved, untriggered until amendment is designed).
- Every clinical write joins its business transaction; audit failure ⇒ full rollback.
- `CLINICAL_RECORD_AMENDED` must NOT be emitted by M9 (Decision 3).

## Concurrency Implications

- Single monotonic `version` counter across edits and signing (Decision 5).
- Guard predicates: updates/sign include `status = 'draft'` AND `version = expectedVersion`; zero-row results classified as VERSION_CONFLICT vs INVALID_TRANSITION exactly as in M8.
- Concurrent-update and concurrent-update-vs-sign races covered by mandated live-DB tests.

## M10/M12 Compatibility

- **M12 (AI):** note-draft output (`sections[{heading,content}]`) validates against the SOAP content schema verbatim; accepted drafts land as normal `draft` records with `ai_draft_id` populated — no schema change anticipated.
- **M10 (Lab):** result verification workflows can reference signed clinical context; pharmacist/lab-tech scope tightening lands here.
- **M13 (Discharge):** owns discharge-summary authoring workflow and any amendment design; `discharge_summary` placeholder schema may be refined then without breaking M9 validation (additive).

## Deferred Functionality

| Item | Status |
|---|---|
| Amendment lifecycle (`signed → amended`) | DEFERRED — future architectural decision required before implementation |
| Discharge-summary workflow | M13 |
| AI draft integration (`aiDraftId`) | M11/M12 |
| `meds_only`/`orders_only` true scoping | M10 revisit (mandatory agenda item) |

## Consequences

- M9 unblocked: shared Zod contracts, state machine, service guards, audit wiring, and tests can now be written without ambiguity.
- One additional audit event enters the catalog; api-architecture §2.5 corrected accordingly.
- The audit chain gains coverage over PHI mutations previously unspecified — closing the highest-value traceability gap identified in review.
