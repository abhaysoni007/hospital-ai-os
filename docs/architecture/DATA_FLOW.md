# Hospital AI OS — Data Domain Model & Information Flow Specification

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Scope:** Conceptual data domains, entity relationships, sensitivity levels, and vertical-slice information flow.

---

## 1. Conceptual Data Domains Catalog

> [!NOTE]
> This catalog defines conceptual business domain entities required for Phase 3 architectural design. It contains zero database table names, SQL statements, or ORM schemas.

| Domain Name | Conceptual Purpose | Primary Users | Sensitivity Level | Key Lifecycle States |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | Core demographic index and identity (EMPI). | All Roles | **PHI / High** | Active, Merged, Archived |
| **Identity** | Verification records & identity documents. | Receptionist, Admin | **PII / High** | Pending, Verified, Rejected |
| **Encounter** | Single episode of care (OPD visit, Consultation).| Doctor, Nurse, Admin | **PHI / High** | Registered, Active, Discharged, Closed |
| **Appointment** | Scheduled consultation slot. | Receptionist, Patient | **PHI / Medium** | Booked, Checked-In, In-Consult, Cancelled |
| **Clinical Record**| Notes, vitals, progress logs, SOAP entries. | Doctor, Nurse | **PHI / Critical**| Draft, Signed, Amended |
| **Diagnostic Order**| Requisition for lab test. | Doctor, Lab Tech | **PHI / High** | Ordered, Sample Collected, Completed |
| **Diagnostic Result**| Lab test values & verification. | Pathologist, Tech | **PHI / Critical**| Preliminary, Verified, Critical Flagged |
| **Staff** | Hospital employee profiles and roles. | System Admin, Admin | Internal / Medium | Active, Suspended |
| **Department** | Organizational units. | Admin, Operations | Internal / Low | Active, Inactive |
| **Task** | Operational or clinical task assignment. | All Roles | Internal / Medium | `CREATED` -> `ASSIGNED` -> `IN_PROGRESS` -> `COMPLETED` |
| **Notification** | Real-time clinical/operational alert. | All Roles | Internal / Medium | Dispatched, Delivered, Acknowledged |
| **AI Interaction** | Prompt context, AI draft, confidence signals. | AI Engine, Auditor | Internal / High | Generated, Reviewed, Accepted, Rejected |
| **Audit Event** | Immutable record of system actions. | Security Admin | **Critical / High** | Logged (Immutable) |

---

## 2. Vertical-Slice Information Flow Map

```text
PATIENT REGISTRATION
  ↓ [Creates Patient & Identity Domain]
APPOINTMENT BOOKING & CHECK-IN
  ↓ [Creates Appointment & Encounter Domain]
OPD CLINICAL CONSULTATION
  ├── [AI Observes Context → Drafts Progress Note]
  ├── Doctor Reviews & Signs → [Creates Clinical Record Domain]
  └── Doctor Orders Tests → [Creates Diagnostic Order Domain]
        ↓
DIAGNOSTIC LAB WORKFLOW
  ├── Lab Sample Collected & Test Executed
  ├── Pathologist Verifies Results → [Creates Diagnostic Result Domain]
  └── Urgent Alerts Dispatched if Panic Value Detected
        ↓
DISCHARGE SUMMARY WORKFLOW (For Eligible Encounter)
  ├── AI Observes Encounter Context → Drafts Discharge Summary
  ├── Doctor Approves & Signs Discharge Summary
  └── [Encounter State → DISCHARGED]
```

### 2.1 AI Observation & Intervention Points
1. **At Consultation:** AI observes encounter context → transforms into draft SOAP note for side-by-side doctor review.
2. **At Chart Search:** AI searches grounded patient records → synthesizes chart history summary with citations.
3. **At Diagnostics:** Deterministic rules engine (NOT AI) evaluates lab result values → detects panic values → dispatches urgent notification. (AI may surface abnormal trends for human review).
4. **At Discharge:** AI observes eligible encounter history → transforms into draft discharge summary for clinician sign-off.
