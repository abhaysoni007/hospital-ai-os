# ADR-013: Encounter Detail Response — PHI Permission Boundary

**Status:** ACCEPTED  
**Date:** 2026-08-25  
**Author:** Phase 5 Architecture Review  
**Supersedes:** Partially supersedes the illustrative response contract for `GET /encounters/:id` in `api-architecture.md` §2.4 (corrected in place)  
**References:** `security-architecture.md §2.3, §2.4, §10`, `api-architecture.md §2.4–§2.7`, `domain-model.md §2.6–§2.9`, `middleware/rbac/permissions.ts` (M5 matrix), `ADR-003-rest-api.md`

---

## Context

`api-architecture.md` §2.4 originally specified `GET /encounters/:id` as returning an **embedded aggregate**:

```json
{ "patient": { ... }, "clinicalRecords": [ ... ], "diagnosticOrders": [ ... ] }
```

guarded by a single permission, `encounter:read`.

The M5 role-permission matrix (`security-architecture.md` §2.3, implemented verbatim in `middleware/rbac/permissions.ts`) grants `encounter:read` to **physician, nurse, receptionist, hospital_admin** — but grants no clinical-record or diagnostic read permission to **receptionist** and **hospital_admin**.

Serving embedded `clinicalRecords[]` and `diagnosticOrders[]` under `encounter:read` alone would therefore expose clinical PHI to roles the security architecture explicitly denies it. This is a direct conflict between an illustrative API example and the normative authorization model.

---

## Precedence Rule

Where a REST example in `api-architecture.md` conflicts with `security-architecture.md`, **the security architecture governs**. Per `security-architecture.md` §2.4, authorization is enforced at the API layer per resource and per action; UI composition convenience never widens it. Endpoint examples are contracts only insofar as they respect the matrix.

---

## Decision

### 1. Response decomposition rule (general)

> A response may embed a nested collection or field of resource type R only if the caller holds R's read permission. Embedding is never authorized transitively through a parent permission.

### 2. Corrected `GET /encounters/:id` contract

The endpoint returns **encounter metadata + minimum patient demographics**, nothing else:

```json
{
  "data": {
    "id": "uuid",
    "patientId": "uuid",
    "doctorId": "uuid",
    "departmentId": "uuid",
    "encounterType": "opd | follow_up",
    "status": "registered | active | discharge_initiated | discharged | closed",
    "startedAt": "timestamp|null",
    "dischargedAt": "timestamp|null",
    "createdAt": "timestamp",
    "version": 1,
    "chiefComplaint": "text | omitted",
    "patient": {
      "id": "uuid", "mrn": "MRN-YYYY-NNNNN",
      "firstName": "...", "lastName": "...",
      "dateOfBirth": "ISO date", "gender": "..."
    }
  }
}
```

Field-level rules:

| Field group | Authorization |
|:---|:---|
| Encounter metadata (ids, type, status, timestamps, version) | `encounter:read` |
| Patient demographic block | Safe for all `encounter:read` holders — verified against the M5 matrix, every role with `encounter:read` (physician, nurse, receptionist, hospital_admin) also holds `patient:read`. No transitive grant is being invented; the block is bounded to what `patient:read` itself exposes |
| `chiefComplaint` | **Clinical narrative (PHI per domain-model §2.6).** Returned only when the caller additionally holds `clinical_record:read`; otherwise the key is **omitted entirely** (not nulled), so response shape doubles as an authorization signal that cannot be misread |

### 3. Clinical and diagnostic data remain on their own endpoints

No new permissions are invented; the existing catalog already provides correctly-gated sub-resources:

| Data | Endpoint | Required permission |
|:---|:---|:---|
| Clinical records list/detail | `GET /encounters/:encounterId/clinical-records[/:id]` (§2.5) | `clinical_record:read` |
| Diagnostic orders | `GET /encounters/:encounterId/diagnostic-orders` (§2.6) | `diagnostic_order:read` |
| Diagnostic results | `GET /diagnostic-orders/:orderId/result` (§2.7) | `diagnostic_result:read` |

Diagnostic results additionally follow every rule already defined for them (deterministic critical flags, verification workflow); this ADR changes nothing about result semantics.

### 4. Frontend consequence

The encounter detail screen composes itself from the four permitted calls above and renders each section **only when the authenticated role holds the corresponding permission** (existing `hasPermission` helper). Sections are hidden server-authoritatively regardless — the UI gate is UX, not security.

---

## Alternatives Considered

| Alternative | Reason rejected |
|:---|:---|
| Filter embedded collections per caller at runtime | Preserves the original shape but makes the response body vary invisibly by role; harder to test, easier to regress into a leak; the sub-endpoints already exist |
| Grant clinical_record:read to receptionist/hospital_admin to match the example | Modifying the security matrix to satisfy an API illustration inverts precedence; violates least privilege |
| New composite permission (e.g., `encounter:read:with_clinical`) | Inventing permissions contradicts the locked M5 vocabulary; adds matrix surface without adding meaning |

---

## Consequences

- No PHI authorization violation is possible via encounter detail; each resource class has exactly one gated access path.
- The frontend makes up to three additional requests for clinicians; acceptable for an intranet OPD tool and consistent with the existing per-resource service pattern.
- Documentation updated: `api-architecture.md` §2.4 now shows the corrected response and cites this ADR.
- Enforcement lives in the encounter service/controller (field omission + no joins into clinical/diagnostic tables), covered by RBAC matrix tests asserting receptionist/hospital_admin responses contain neither `clinicalRecords` nor `diagnosticOrders` nor `chiefComplaint`.
