# Hospital AI OS — User Stories, Acceptance Criteria & Priority Matrix

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** Product Management Rules  
> **Scope:** Vertical-slice MVP user stories, normalized acceptance criteria, and product priority matrix.

---

## 1. Product Priority Matrix

| Capability / Feature Area | User Value | Clinical Impact | AI Leverage | Risk Level | Scope Classification | Priority |
| :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| **Patient Registration & EMPI** | High | High | Med | Med | **MVP CORE** | 1 |
| **OPD Consultation & AI Drafting** | Critical| High | High | Med | **MVP CORE** | 2 |
| **Grounded AI Chart Search** | High | Med | High | Low | **MVP CORE** | 3 |
| **Lab Ordering & Verification** | Critical| High | Med | High | **MVP CORE** | 4 |
| **Discharge Summary Authorization**| High | High | High | Med | **MVP CORE** | 5 |
| **RBAC & Break-Glass Policy** | High | High | None | High | **MVP SUPPORTING** | 6 |
| **Audit Logging Engine** | High | High | None | High | **MVP SUPPORTING** | 7 |
| **Pharmacy MAR & Dispensing** | High | High | Med | High | Phase 2 | 8 |
| **Itemized Billing Settlement** | High | Med | Med | Low | Phase 2 | 9 |

---

## 2. Vertical-Slice User Stories & Normalized Acceptance Criteria

### Story US-01: Patient Identity Registration
- **As a** Receptionist,
- **I want** to register a new patient using an uploaded government ID document,
- **so that** demographic details are auto-extracted accurately and duplicate medical record creation is prevented.
- **Acceptance Criteria:**
  - *Business:* Given a valid ID document image, when uploaded by an authorized Receptionist, the system extracts Name, DOB, Gender, and ID number into the registration form. Given a registration submission for an existing patient, the system identifies likely duplicate patient records and requires appropriate verification before creating a new identity.
  - *Safety:* Given a verified registration submission, the system issues a unique MRN and persists the patient record.
  - *Technical:* An immutable audit event is recorded (`PATIENT_REGISTERED`).

### Story US-02: Doctor AI Clinical Note Drafting
- **As an** OPD Physician,
- **I want** the AI assistant to draft a structured SOAP note based on today's examination and history,
- **so that** I can complete clinical documentation quickly while reviewing and maintaining control over the final note.
- **Acceptance Criteria:**
  - *Business:* Given an active patient encounter, when the Doctor requests note drafting, the system displays a side-by-side draft SOAP note grounded in active vitals and chief complaints.
  - *Safety:* Given the AI draft note, the system requires the Doctor to explicitly review and accept/sign the note before it can be committed to the EHR database (zero auto-commit).
  - *Technical:* Given an accepted note, the system locks the document with the Doctor's attributable signature and logs an audit event (`CLINICAL_NOTE_SIGNED`).

### Story US-03: Grounded AI Chart Search
- **As a** Physician,
- **I want** to execute natural language queries across grounded patient records,
- **so that** I can synthesize patient chart history efficiently with source evidence traceability.
- **Acceptance Criteria:**
  - *Business:* Given an authorized user prompt, the system displays a grounded summary card answering the query.
  - *Safety:* All material factual claims in the summary card must be traceable to authoritative source evidence.
  - *Technical:* Search query execution adheres to user role scope limits and generates an audit log (`AI_SEARCH_EXECUTED`).

### Story US-04: Diagnostic Lab Verification
- **As a** Pathologist,
- **I want** to review lab test analyzer outputs with automated panic value detection,
- **so that** lab results are verified safely and critical values are alerted immediately.
- **Acceptance Criteria:**
  - *Business:* Given a specimen test run, the Pathologist can review raw values, structured reports, and reference ranges.
  - *Safety:* Given a detected panic value, the system flags the result prominently and dispatches an urgent notification to the ordering physician.
  - *Technical:* Lab verification requires Pathologist sign-off and generates an audit event (`LAB_RESULT_VERIFIED`).

### Story US-05: Discharge Summary Authorization for Eligible Encounter
- **As an** Attending Physician,
- **I want** an AI-generated draft discharge summary consolidating encounter notes, lab results, and care instructions,
- **so that** discharge paperwork can be authorized efficiently without missing critical clinical details.
- **Acceptance Criteria:**
  - *Business:* Given an eligible encounter ready for discharge, when the Doctor requests a discharge summary, the system aggregates encounter history into a structured draft summary.
  - *Safety:* Mandatory physician review, editing, and attributable sign-off are required before discharge authorization (no inpatient ward subsystem required).
  - *Technical:* Authorizing discharge updates encounter status to `DISCHARGED` and records an audit event (`DISCHARGE_AUTHORIZED`).
