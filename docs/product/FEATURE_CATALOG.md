# Hospital AI OS — MVP Feature & Workflow Specifications Catalog

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Scope:** Detailed specifications for 5 Core Vertical-Slice MVP Workflows, Hospital Task Model, Notification Model, and AI Search Workspace.

---

## 1. 5 Core Vertical-Slice MVP Workflow Specifications

Every MVP workflow is specified using an 11-step execution schema:

```text
Trigger → Actor → Context → Inputs → Validation → Decision → AI Assistance → Human Approval → Action → Verification → Audit
```

### 1.1 Workflow WF-01: Patient Registration & EMPI Verification

- **Trigger:** Patient arrives at hospital registration desk.
- **Actor:** Receptionist / Registration Clerk.
- **Context:** Demographics registration interface, photo ID scanner.
- **Inputs:** First name, last name, DOB, gender, mobile phone, emergency contact, government ID number.
- **Validation:** Server-side validation on required contact fields and ID formats.
- **Decision:** System checks EMPI index to prevent duplicate patient identity records.
- **AI Assistance:** OCR document data extraction from uploaded ID card; duplicate identity detection matching.
- **Human Approval:** Receptionist verifies extracted details and confirms patient identity matching.
- **Action:** System creates new `Patient` domain record and issues unique MRN token.
- **Verification:** Verified MRN card displayed on screen.
- **Audit:** Immutable audit event recorded (`PATIENT_REGISTERED`).

### 1.2 Workflow WF-02: OPD Appointment & Encounter Check-In

- **Trigger:** Patient requests consultation or arrives for scheduled appointment.
- **Actor:** Receptionist / Front-Desk Staff.
- **Context:** Doctor OPD schedule interface, department check-in console.
- **Inputs:** Patient MRN, selected department, preferred doctor, time slot.
- **Validation:** Verify doctor schedule availability and active patient MRN status.
- **Decision:** Allocate next available token number or scheduled slot.
- **AI Assistance:** Schedule optimization (estimates clinic waiting times).
- **Human Approval:** Receptionist confirms check-in.
- **Action:** Encounter state set to `CHECKED_IN`; token added to doctor active queue.
- **Verification:** Queue console displays patient token in active waiting list.
- **Audit:** Immutable audit event recorded (`APPOINTMENT_CHECKED_IN`).

### 1.3 Workflow WF-03: OPD Consultation & Clinical Note Drafting

- **Trigger:** Doctor opens patient encounter from active queue console.
- **Actor:** OPD Physician / Doctor.
- **Context:** Clinical workspace EMR, patient chart panel.
- **Inputs:** Chief complaint, clinical examination findings, vitals, provisional diagnosis.
- **Validation:** Validate active encounter session and required clinical fields.
- **Decision:** Formulate treatment plan, write progress note, order lab tests.
- **AI Assistance:** Generates side-by-side SOAP note draft; extracts key historical clinical flags from chart.
- **Human Approval:** Mandatory clinician review, editing, and sign-off (zero auto-commit).
- **Action:** Clinical note saved; lab test orders dispatched.
- **Verification:** Clinical note locked with doctor cryptographic signature badge.
- **Audit:** Immutable audit event recorded (`CLINICAL_NOTE_SIGNED`).

### 1.4 Workflow WF-04: Diagnostic Lab Ordering & Verification

- **Trigger:** Doctor submits diagnostic test order during consultation.
- **Actor:** Lab Technician / Pathologist.
- **Context:** Laboratory workspace queue.
- **Inputs:** Specimen ID, test code, analyzer output values.
- **Validation:** Verify sample integrity and reference range boundaries.
- **Decision:** Verify whether lab result is normal, abnormal, or critical panic value.
- **AI Assistance:** Formats raw analyzer outputs into a structured result report for pathologist review.
- **Deterministic Rule (NOT AI):** Configured reference-range rules evaluate result values against defined critical thresholds and flag panic/critical values. An LLM or generative AI model is NOT the authoritative mechanism for critical value detection.
- **Human Approval:** Pathologist sign-off required for lab verification.
- **Action:** Lab result state transitions to `VERIFIED`; published to patient chart.
- **Verification:** Instant alert pushed to ordering doctor if panic value detected.
- **Audit:** Immutable audit event recorded (`LAB_RESULT_VERIFIED`).

### 1.5 Workflow WF-05: Discharge Summary Drafting & Authorization

- **Trigger:** Physician initiates discharge for an eligible encounter.
- **Actor:** Attending Physician / Doctor.
- **Context:** Encounter discharge workspace.
- **Inputs:** Final diagnosis, course summary, care instructions, follow-up date.
- **Validation:** Confirm all lab results verified for the encounter.
- **Decision:** Approve patient fitness for discharge.
- **AI Assistance:** Aggregates encounter notes, vitals, and lab results into structured draft discharge summary.
- **Human Approval:** Mandatory physician review, editing, and sign-off.
- **Action:** Discharge summary locked; care instructions printed; encounter status set to `DISCHARGED`.
- **Verification:** Discharge authorization badge displayed on encounter console.
- **Audit:** Immutable audit event recorded (`DISCHARGE_AUTHORIZED`).

---

## 2. Hospital Task Model & Notification Model

### 2.1 Task State Machine

```text
CREATED → ASSIGNED → IN_PROGRESS → AWAITING_APPROVAL → COMPLETED / CANCELLED
```

### 2.2 Urgent Notification Model

- **Critical Clinical Alerts:** Dispatched instantly (< 10s target) for panic lab values; requires explicit clinician acknowledgment.
- **Task Notifications:** Dispatched for pending reviews or shift handovers.
