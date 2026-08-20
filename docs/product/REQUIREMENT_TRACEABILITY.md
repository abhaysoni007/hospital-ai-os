# Hospital AI OS — User Stories, Acceptance Criteria & Priority Matrix

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Product Management Rules  
> **Scope:** Concise MVP user stories, testable acceptance criteria, and product priority matrix.

---

## 1. Product Priority Matrix

Capabilities are ranked by: User Value (UV), Clinical/Ops Impact (CI), AI Leverage (AL), Implementation Complexity (IC), Risk (R), and MVP Status.

| Capability / Feature Area | UV | CI | AL | IC | R | MVP Status | Priority Rank |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: |
| **Patient Registration & EMPI** | High | High | Med | Low | Med | **MUST HAVE** | 1 |
| **OPD Consultation & AI Drafting** | Critical| High | High | Med | Med | **MUST HAVE** | 2 |
| **Lab Ordering & Verification** | Critical| High | Med | Med | High | **MUST HAVE** | 3 |
| **Pharmacy Dispensing & MAR** | Critical| High | Med | Med | High | **MUST HAVE** | 4 |
| **Discharge Summary AI Draft** | High | High | High | Med | Med | **MUST HAVE** | 5 |
| **Itemized Billing & Clearance** | High | Med | Med | Low | Low | **MUST HAVE** | 6 |
| **AI Search & Chart Summarizer** | High | Med | High | Med | Low | **MUST HAVE** | 7 |
| **RBAC & Break-Glass Access** | High | High | None | Low | High | **MUST HAVE** | 8 |
| **Insurance Pre-Auth & Claims** | Med | Med | Med | High | Med | Phase 2 | 9 |
| **Radiology PACS Viewer** | Med | Med | Med | High | High | Phase 2 | 10 |

---

## 2. MVP User Stories & Acceptance Criteria

### Story US-01: Patient Identity Registration
- **As a** Receptionist,
- **I want** to register a new patient using an uploaded government ID document,
- **so that** demographic details are auto-extracted accurately and duplicate medical record creation is prevented.
- **Acceptance Criteria:**
  1. Given a valid ID document image, when uploaded by an authorized Receptionist, the system extracts Name, DOB, Gender, and ID number into the registration form within 2,000 ms.
  2. Given a registration attempt for an existing patient, when the name and DOB match an existing EMPI record by >= 85% confidence, the system displays a "Potential Duplicate Patient" warning listing matching MRNs.
  3. Given a verified registration submission, the system issues a unique MRN, persists the patient record, and writes an audit event (`PATIENT_REGISTERED`).

### Story US-02: Doctor AI Clinical Note Drafting
- **As an** OPD Physician,
- **I want** the AI assistant to draft a structured SOAP note based on today's examination and history,
- **so that** I can complete clinical documentation quickly while reviewing and maintaining control over the final note.
- **Acceptance Criteria:**
  1. Given an active patient encounter, when the Doctor clicks "Generate Draft Note", the system displays a side-by-side draft SOAP note within 3,000 ms grounded in active vitals and chief complaints.
  2. Given the AI draft note, the system requires the Doctor to explicitly click "Accept & Sign" before the note can be committed to the EHR database.
  3. Given an accepted note, the system locks the document with the Doctor's attributable signature and logs an audit event (`CLINICAL_NOTE_SIGNED`).

### Story US-03: Pharmacy Drug Interaction & Dispensing Verification
- **As a** Pharmacist,
- **I want** to review physician prescriptions with automated drug interaction and allergy checks,
- **so that** I can safely dispense correct medications without risking adverse drug events.
- **Acceptance Criteria:**
  1. Given a signed prescription, when opened by an authorized Pharmacist, the system checks active patient allergies and current medications against an authoritative pharmacological database.
  2. Given a detected drug interaction or allergy conflict, the system displays a prominent warning card highlighting the conflicting drug pair and severity level.
  3. Given a verified prescription, when the Pharmacist clicks "Confirm Dispense", the system decrements inventory stock, updates prescription status to `DISPENSED`, and logs an audit event (`PRESCRIPTION_DISPENSED`).

### Story US-04: Emergency Break-Glass Access Activation
- **As an** ER Physician,
- **I want** to declare Emergency Break-Glass access for an unassigned trauma patient,
- **so that** I can immediately view critical medical history during a life-threatening emergency.
- **Acceptance Criteria:**
  1. Given an unassigned patient record, when a Doctor clicks "Activate Break-Glass", the system prompts for a mandatory emergency justification reason (minimum 15 characters).
  2. Given a valid justification submission, the system grants elevated view access for exactly 4 hours maximum.
  3. Given a break-glass activation, the system dispatches an instant security alert to the Security Admin console and logs an immutable audit event (`BREAK_GLASS_ACTIVATED`).

### Story US-05: AI Inpatient Discharge Summary Drafting
- **As an** Attending Physician,
- **I want** an AI-generated draft discharge summary consolidating multi-day inpatient vitals, lab trends, and treatments,
- **so that** discharge paperwork can be completed efficiently without missing critical clinical details.
- **Acceptance Criteria:**
  1. Given an inpatient encounter marked ready for discharge, when the Doctor clicks "Generate Discharge Summary", the system aggregates all encounter notes, verified lab results, and medications into a structured draft summary within 4,000 ms.
  2. Given the draft discharge summary, all factual clinical claims must include clickable citations linking to source lab results or progress notes.
  3. Given the Doctor's review and sign-off, the system locks the discharge summary, marks encounter status as `DISCHARGED`, and logs an audit event (`DISCHARGE_AUTHORIZED`).
