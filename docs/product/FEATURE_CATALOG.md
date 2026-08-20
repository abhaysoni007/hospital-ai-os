# Hospital AI OS — MVP Feature & Workflow Specifications Catalog

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Scope:** Detailed specifications for 8 MVP workflows, Hospital Task Model, Notification Model, and AI Search Workspace.

---

## 1. 8 Core MVP Workflow Specifications

Every MVP workflow is specified using this explicit 11-step execution schema:

```text
Trigger → Actor → Context → Inputs → Validation → Decision → AI Assistance → Human Approval → Action → Verification → Audit
```

### 1.1 Workflow WF-01: Patient Registration & EMPI Verification
- **Trigger:** Patient arrives at hospital reception or front desk.
- **Actor:** Receptionist / Registration Clerk.
- **Context:** Demographics input modal, photo ID scanner.
- **Inputs:** First name, last name, DOB, gender, mobile phone, emergency contact, government ID number.
- **Validation:** Server-side regex validation on phone number, mandatory field completeness, ID format check.
- **Decision:** Check if patient already exists in EMPI index to prevent duplicate records.
- **AI Assistance:** OCR document extraction from uploaded ID card; fuzzy matching duplicate identity detection score.
- **Human Approval:** Receptionist confirms identity match score and verifies extracted details.
- **Action:** System creates new `Patient` domain entity and issues master MRN (Medical Record Number).
- **Verification:** Verified MRN card displayed on screen with unique QR/barcode token.
- **Audit:** Immutable audit event recorded (`PATIENT_REGISTERED`, `actor_id`, `mrn`, `timestamp`).

### 1.2 Workflow WF-02: OPD Appointment Booking & Check-In
- **Trigger:** Patient requests consultation at desk or via phone booking.
- **Actor:** Receptionist / Front-Desk Supervisor.
- **Context:** Doctor OPD schedule master, department queue console.
- **Inputs:** Patient MRN, selected department, preferred doctor, time slot.
- **Validation:** Verify doctor schedule availability, check slot capacity limits, confirm active patient MRN status.
- **Decision:** Allocate next available token number or scheduled slot.
- **AI Assistance:** Schedule optimization (predicts clinic delay and estimates actual consultation start time).
- **Human Approval:** Receptionist approves booking and issues check-in token.
- **Action:** Appointment state transitions to `CHECKED_IN`; token added to active OPD doctor queue.
- **Verification:** Queue console displays patient token in active waiting list.
- **Audit:** Immutable audit event recorded (`APPOINTMENT_BOOKED`, `token_id`, `actor_id`, `timestamp`).

### 1.3 Workflow WF-03: OPD Consultation & Clinical Note Drafting
- **Trigger:** Doctor calls next patient token from OPD queue console.
- **Actor:** OPD Physician / Doctor.
- **Context:** Clinical workspace EMR, patient chart history panel.
- **Inputs:** Chief complaint, clinical examination findings, vitals, provisional diagnosis (ICD-10).
- **Validation:** Check active doctor-patient encounter session, validate ICD code presence.
- **Decision:** Formulate treatment plan, write notes, order lab tests, prescribe medications.
- **AI Assistance:** Generates side-by-side SOAP note draft; extracts key historical clinical flags from chart.
- **Human Approval:** Mandatory clinician review, editing, and sign-off. (Zero auto-commit).
- **Action:** Clinical progress note saved; diagnostic/drug orders dispatched to respective departments.
- **Verification:** Clinical note locked with doctor cryptographic signature badge.
- **Audit:** Immutable audit event recorded (`CLINICAL_NOTE_SIGNED`, `encounter_id`, `actor_id`, `timestamp`).

### 1.4 Workflow WF-04: Diagnostic Lab Ordering & Verification
- **Trigger:** Doctor submits diagnostic test order during consultation.
- **Actor:** Lab Technician / Pathologist.
- **Context:** Laboratory Information System (LIS) workspace queue.
- **Inputs:** Barcoded specimen ID, test code, analyzer raw output values.
- **Validation:** Verify sample integrity, check reference range limits, validate ordering doctor ID.
- **Decision:** Verify whether lab result is normal, abnormal, or critical panic value.
- **AI Assistance:** Formats raw analyzer outputs into structured report; detects panic value anomalies.
- **Human Approval:** Pathologist sign-off required for verification.
- **Action:** Lab result state transitions to `VERIFIED`; result published to patient clinical chart.
- **Verification:** Instant alert pushed to ordering doctor's workspace if panic value detected.
- **Audit:** Immutable audit event recorded (`LAB_RESULT_VERIFIED`, `lab_id`, `pathologist_id`, `timestamp`).

### 1.5 Workflow WF-05: Pharmacy Prescription Review & Dispensing
- **Trigger:** Doctor signs prescription in clinical workspace.
- **Actor:** Pharmacist / Pharmacy Assistant.
- **Context:** Pharmacy dispensing queue console.
- **Inputs:** Active prescription ID, drug batch number, quantity dispensed.
- **Validation:** Check drug stock availability, verify dose range, validate drug expiry dates.
- **Decision:** Approve dispensing or flag prescribing doctor regarding allergy/interaction risks.
- **AI Assistance:** Runs real-time allergy & drug-drug interaction check against pharmacological database.
- **Human Approval:** Pharmacist explicit sign-off on allergy/interaction check.
- **Action:** Drug inventory reserved/decremented; active MAR schedule generated for inpatient or drug dispensed for OPD.
- **Verification:** Dispensing slip printed with batch number and dosage instructions.
- **Audit:** Immutable audit event recorded (`PRESCRIPTION_DISPENSED`, `rx_id`, `pharmacist_id`, `timestamp`).

### 1.6 Workflow WF-06: Billing Charge Capture & Payment Settlement
- **Trigger:** Patient completes consultation, lab test, or pharmacy dispensing.
- **Actor:** Billing Clerk.
- **Context:** Billing service aggregator console.
- **Inputs:** Rendered service items, tariff codes, payment mode (Cash, Card, Digital, Insurance).
- **Validation:** Verify tariff rate completeness, ensure zero unbilled executed orders exist.
- **Decision:** Issue final itemized invoice and process payment.
- **AI Assistance:** Scans patient encounter log to detect unbilled executed lab/drug orders.
- **Human Approval:** Billing clerk reviews detected unbilled items and authorizes invoice lock.
- **Action:** Invoice status transitions to `PAID`; financial discharge clearance token issued.
- **Verification:** Itemized tax receipt generated with unique financial invoice ID.
- **Audit:** Immutable audit event recorded (`INVOICE_SETTLED`, `invoice_id`, `clerk_id`, `timestamp`).

### 1.7 Workflow WF-07: Inpatient Discharge Summary Drafting & Sign-off
- **Trigger:** Physician initiates discharge for inpatient encounter.
- **Actor:** Attending Physician / Ward Nurse.
- **Context:** Inpatient discharge management module.
- **Inputs:** Final diagnosis, hospital course summary, discharge medications, follow-up date.
- **Validation:** Confirm all lab results verified, confirm pharmacy reconcilement complete.
- **Decision:** Approve patient medical fitness for discharge.
- **AI Assistance:** Aggregates multi-day inpatient notes, lab trends, and medications into structured draft discharge summary.
- **Human Approval:** Attending physician mandatory review, editing, and sign-off.
- **Action:** Discharge summary locked; care instructions printed; encounter status set to `DISCHARGED`.
- **Verification:** Discharge clearance badge displayed on ward bed management board.
- **Audit:** Immutable audit event recorded (`DISCHARGE_AUTHORIZED`, `encounter_id`, `doctor_id`, `timestamp`).

### 1.8 Workflow WF-08: Cross-System AI Search & Assistant Workspace
- **Trigger:** Authorized user enters natural language query in AI search bar.
- **Actor:** Doctor, Nurse, Department Head, Operations Manager.
- **Context:** Global AI Workspace search bar.
- **Inputs:** Natural language text prompt (e.g., "Summarize recent admissions for Patient X").
- **Validation:** Enforce RBAC data scope filters before context assembly.
- **Decision:** Retrieve grounded records and format response.
- **AI Assistance:** Semantic vector search + grounded LLM context synthesis + citation formatting.
- **Human Approval:** User reviews generated summary citations.
- **Action:** Displays response card with inline document links.
- **Verification:** Response card explicitly marked "AI Generated Summary — Grounded in Patient Records".
- **Audit:** Immutable audit event recorded (`AI_SEARCH_EXECUTED`, `user_id`, `query_type`, `timestamp`).

---

## 2. Hospital Task Model Specification

Tasks coordinate work across hospital staff and departments.

### 2.1 Conceptual Task Schema
```json
{
  "task_id": "tsk_123456789",
  "creator_id": "usr_doc_101",
  "assignee_id": "usr_nurse_202",
  "department_id": "DEPT_WARD_3B",
  "patient_context_id": "pat_998877",
  "priority": "HIGH",
  "status": "AWAITING_APPROVAL",
  "deadline": "2026-08-20T12:00:00.000Z",
  "source": "CLINICAL_ORDER",
  "ai_involvement": "TASK_PRIORITY_SUGGESTED",
  "approval_requirement": "MANDATORY_NURSE_SIGN_OFF",
  "audit_history_ref": "aud_776655"
}
```

### 2.2 Task State Machine
```text
CREATED → ASSIGNED → IN_PROGRESS → AWAITING_APPROVAL → COMPLETED
  │          │             │
  └──────────┴─────────────┴─────→ CANCELLED / ESCALATED / BLOCKED
```

---

## 3. Notification Model Specification

| Notification Category | Urgency Level | Target Recipient | Delivery Expectation | Escalation Path |
| :--- | :--- | :--- | :--- | :--- |
| **Critical Clinical Panic Value**| `CRITICAL` | Ordering Doctor & Charge Nurse | Instant UI Modal + Sound Alert (< 10s) | Escalate to Dept Head if unacknowledged in 5 mins |
| **Pending Medication MAR Dose** | `HIGH` | Assigned Ward Nurse | Active Task List Badge (< 1 min) | Alert Charge Nurse at 15 mins past due |
| **Unreviewed Lab Result** | `MEDIUM` | Ordering Doctor | Notification Center Item | Remind doctor at shift end |
| **OPD Queue Delay Alert** | `MEDIUM` | Receptionist & Ops Manager | Dashboard Banner | Suggest queue re-balancing |
| **Break-Glass Security Alert** | `CRITICAL` | Security Administrator | Instant Security Console Alert | Dispatch SMS/Email to CISO instantly |
