# Hospital AI OS — Data Domain Model & Information Flow Specification

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Scope:** Conceptual data domains, entity relationships, sensitivity levels, and cross-departmental information flow.

---

## 1. Conceptual Data Domains Catalog

> [!NOTE]
> This catalog defines conceptual business domain entities required for Phase 3 architectural design. It contains zero database table names, SQL statements, or ORM schemas.

| Domain Name | Conceptual Purpose | Primary Users | Sensitivity Level | Key Lifecycle States |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | Core demographic index and identity (EMPI). | All Roles | **PHI / High** | Active, Merged, Deceased, Archived |
| **Identity** | Government & facility verification records. | Receptionist, Admin | **PII / High** | Pending, Verified, Rejected |
| **Encounter** | Single episode of care (OPD visit, IPD stay, ER).| Doctor, Nurse, Admin | **PHI / High** | Registered, Admitted, Discharged, Closed |
| **Appointment** | Scheduled consultation slot. | Receptionist, Patient | **PHI / Medium** | Booked, Checked-In, In-Consult, Cancelled |
| **Clinical Record**| Notes, vitals, progress logs, SOAP entries. | Doctor, Nurse | **PHI / Critical**| Draft, Signed, Amended |
| **Medication** | Formulary drug master catalog. | Pharmacist, Doctor | Non-PHI / Low | Active, Restricted, Discontinued |
| **Prescription** | Prescribed drug orders for a patient. | Doctor, Pharmacist | **PHI / Critical**| Written, Verified, Dispensed, Cancelled |
| **Diagnostic Order**| Requisition for lab or radiology study. | Doctor, Lab Tech | **PHI / High** | Ordered, Sample Collected, In-Progress, Completed |
| **Diagnostic Result**| Lab test values, pathology reports, PACS images.| Pathologist, Tech | **PHI / Critical**| Preliminary, Verified, Critical Flagged |
| **Billing Record** | Rendered charges, invoices, receipts. | Billing Clerk, Admin | Financial / High | Draft, Invoiced, Paid, Disputed |
| **Insurance Record**| Pre-authorization requests and claims. | Insurance Specialist | Financial / High | Submitted, Approved, Denied, Re-submitted |
| **Staff** | Hospital employee profiles and roles. | System Admin, Admin | Internal / Medium | Active, Suspended, Off-Duty |
| **Department** | Hospital physical/logical organizational units. | Admin, Operations | Internal / Low | Active, Inactive |
| **Task** | Operational or clinical task assignment. | All Roles | Internal / Medium | `CREATED` -> `ASSIGNED` -> `IN_PROGRESS` -> `BLOCKED` -> `AWAITING_APPROVAL` -> `COMPLETED` |
| **Notification** | Real-time clinical/operational alert. | All Roles | Internal / Medium | Dispatched, Delivered, Acknowledged, Escalated |
| **AI Interaction** | Prompt context, AI response draft, confidence. | AI Engine, Auditor | Internal / High | Generated, Reviewed, Accepted, Rejected |
| **Audit Event** | Immutable record of system actions. | Security Admin | **Critical / High** | Logged (Immutable) |

---

## 2. End-to-End Information Flow Map

```text
PATIENT REGISTRATION
  ↓ [Creates Patient & Identity Domain]
APPOINTMENT BOOKING & CHECK-IN
  ↓ [Creates Appointment & Encounter Domain]
OPD CLINICAL CONSULTATION
  ├── [AI Observes Context → Drafts Progress Note]
  ├── Doctor Reviews & Signs → [Creates Clinical Record Domain]
  ├── Doctor Orders Tests → [Creates Diagnostic Order Domain]
  └── Doctor Prescribes Meds → [Creates Prescription Domain]
        ↓
  +-----------------------+-----------------------+
  |                       |                       |
DIAGNOSTIC WORKFLOW       PHARMACY WORKFLOW       BILLING WORKFLOW
  ↓ [Lab Sample Collected]  ↓ [Pharmacist Checks]   ↓ [Auto Aggregates
  ↓ [Result Verified]       ↓ [Meds Dispensed]        Services Rendered]
  ↓ [Creates Result Domain] ↓ [MAR Dose Created]     ↓ [Creates Billing]
  +-----------------------+-----------------------+
                          ↓
              DISCHARGE WORKFLOW
                ├── [AI Observes History → Drafts Discharge Summary]
                ├── Doctor Approves & Signs Discharge Summary
                ├── Billing Verification & Clearance
                └── [Encounter State → DISCHARGED]
```

### 2.1 AI Observation & Intervention Points
1. **At Consultation:** AI observes active encounter vitals/history → transforms into draft SOAP note.
2. **At Diagnostics:** AI observes lab result values → detects panic values → dispatches urgent notification.
3. **At Pharmacy:** AI observes prescription + patient allergies → calculates interaction risk score → surfaces warning to pharmacist.
4. **At Discharge:** AI observes entire encounter history (vitals, notes, labs, drugs) → transforms into comprehensive draft discharge summary.
