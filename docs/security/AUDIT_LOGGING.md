# Hospital AI OS — Audit Logging Specification

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Security & Healthcare Safety Rules  
> **Scope:** Audit event classification, conceptual log schema, immutability, and compliance auditing.

---

## 1. Auditable Event Taxonomy

Every significant operation within Hospital AI OS produces an immutable audit record. The following operations are strictly auditable:

1. **Patient Data Access (Read):** Viewing patient charts, opening lab results, searching patient records.
2. **Patient Data Modification (Write):** Updating demographics, recording vitals, writing progress notes.
3. **Clinical Actions:** Placing lab orders, prescribing drugs, administering MAR doses, authorizing discharge.
4. **AI Interactions:** Querying AI search, generating note drafts, receiving AI recommendations, accepting/rejecting AI suggestions.
5. **Security & Administrative Events:** Login success/failure, role assignment changes, system config updates.
6. **Emergency Events:** Break-glass access declaration, emergency order overrides.

---

## 2. Conceptual Audit Log Schema

Audit events adhere to this explicit conceptual field structure:

```json
{
  "audit_id": "aud_987654321",
  "timestamp": "2026-08-20T09:30:00.000Z",
  "actor": {
    "user_id": "usr_doc_101",
    "role": "ROLE_DOCTOR",
    "department": "OPD_CARDIOLOGY",
    "ip_address": "10.0.4.15"
  },
  "action": "CLINICAL_NOTE_DRAFT_ACCEPTED",
  "target": {
    "resource_type": "PATIENT_ENCOUNTER",
    "resource_id": "enc_554433",
    "patient_id": "pat_112233"
  },
  "context": {
    "workflow": "OPD_CONSULTATION",
    "source_type": "AI_GENERATED_DRAFT",
    "prompt_version": "v2.1.0",
    "confidence_score": 0.94
  },
  "justification": "Routine consultation note completion",
  "approval": {
    "approved_by": "usr_doc_101",
    "approval_timestamp": "2026-08-20T09:30:00.000Z",
    "human_modified": true
  },
  "state_diff": {
    "before_summary": "Empty draft",
    "after_summary": "Verified SOAP note saved"
  },
  "result": "SUCCESS"
}
```

---

## 3. Immutability & Safety Constraints

- **Immutability:** Audit records are write-once, read-many. No user (including System Admin) can alter or delete audit records.
- **No PHI in Log Payload:** Audit log metadata records the action, resource IDs, and timestamps, but must never contain unencrypted clinical narrative PHI text in plain log streams.
- **Infrastructure Alerting:** Failure of the audit logging infrastructure causes immediate system degradation into a safe, read-only state for critical operations.
