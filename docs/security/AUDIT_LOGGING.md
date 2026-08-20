# Hospital AI OS — Audit Logging Specification

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** Security & Healthcare Safety Rules  
> **Scope:** Auditable events taxonomy, conceptual log requirements, immutability, and compliance auditing.

---

## 1. Product Security Requirements for Auditability

1. **Mandatory Auditability:** Every significant system action — including patient data reads, clinical note signing, order entry, AI recommendation drafting, AI draft acceptance/rejection, break-glass activation, and role modifications — must generate an audit record.
2. **Immutability & Tamper-Evidence:** Audit records must be immutable (write-once, read-many) and tamper-evident.
3. **PHI Protection in Logs:** Audit log streams must record action metadata, timestamps, and resource identifiers without exposing raw unencrypted PHI text in log outputs.
4. **Audit Fail-Safe:** Failure of the audit infrastructure must degrade the system safely into a protected state rather than permitting un-audited state changes.

---

## 2. Conceptual Audit Log Fields

Audit records capture the following conceptual fields:

- **Actor Context:** User ID, Assigned Role, Department, Access Scope.
- **Action Description:** Specific action performed (e.g. `CLINICAL_NOTE_SIGNED`, `BREAK_GLASS_ACTIVATED`, `AI_DRAFT_ACCEPTED`).
- **Target Resource:** Resource Type, Resource Identifier, Patient Identifier.
- **Provenance & AI Context:** Source Type (Human vs AI), Prompt Version, Grounding Context Reference.
- **Justification & Approval:** Approval ID, Approver User ID, Mandatory Rationale Text.
- **Timestamp & Result:** Event Timestamp, Execution Status (Success / Failure).

_(Note: Specific JSON log formatting, hash-chaining algorithms, and database storage backends are DEFERRED TO PHASE 3 ARCHITECTURE)._
