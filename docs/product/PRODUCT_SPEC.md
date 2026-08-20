# Hospital AI OS — Master Product Specification

> **Status:** NORMALIZED & LOCKED — Phase 2.1 Specification  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Scope:** Product Vision, North Star, Vertical-Slice MVP Scope, Department Models, Module Scope Matrix, and Acceptance Framework

---

## 1. Product Vision & North Star

### 1.1 What is Hospital AI OS?

Hospital AI OS is an AI-native hospital operating platform designed to coordinate clinical, administrative, operational, staff, patient, and intelligence workflows across healthcare facilities. It operates as an interconnected orchestration layer above healthcare data repositories, transforming isolated patient data into actionable, safe, human-guided clinical and administrative workflows.

```text
People (Clinicians, Nurses, Admins, Patients)
+
Hospital Workflows (Registration, Consultation, Diagnostics, Discharge)
+
Healthcare Data (EHR, PACS, LIS, Identity)
+
AI Assistance (Search, Summarization, Drafting, Recommendation, Detection)
+
Automation (Task routing, Notification dispatch, Validation)
+
Human Approval (Mandatory clinician/admin oversight for state changes)
+
Auditability (Immutable, tamper-evident action logs)
========================================================================
HOSPITAL AI OS — SAFE, HIGH-THROUGHPUT HEALTHCARE OPERATIONS
```

### 1.2 MVP Thesis

> **The smallest Hospital AI OS experience that proves the product deserves to exist is a single coherent vertical slice demonstrating grounded AI assistance, human review, safe action, and auditability across an end-to-end patient encounter:**  
> `Patient Registration → Appointment / Encounter → Doctor Clinical Workspace → AI Chart Search → AI Clinical Note Draft → Diagnostics / Lab → Discharge Summary`

### 1.3 Staff Experience & AI Operational Boundaries

- **Product Experience:** Hospital staff experience a clean, role-tailored workspace with unified search, priority task lists, context-rich approval cards, and automated handovers.
- **AI Responsibilities:** Context retrieval, narrative summarization, note drafting, clinical trend extraction, task priority calculation, bottleneck detection, and administrative form preparation.
- **Human Mandatory Control:** All clinical diagnoses, medication prescriptions, treatment modifications, patient discharge approvals, diagnostic order submissions, and break-glass overrides remain strictly under explicit human authority.

---

## 2. Scope Matrix & Capability Classification

Applying **Ponytail Scope Discipline** (_build the smallest product that proves core value while preserving safety, security, and auditability_):

```text
+---------------------------------------------------------------------------------------------------+
|                                   PHASE 2.1 SCOPE CLASSIFICATION                                  |
+--------------------------+--------------------------+-----------------------+---------------------+
| MVP CORE                 | MVP SUPPORTING           | PHASE 2               | FUTURE              |
| (Vertical Slice)         | (Platform Enablers)      | (Deferred Scope)      | (Long-Term Scope)   |
+--------------------------+--------------------------+-----------------------+---------------------+
| • Patient Registration   | • RBAC Access Control    | • OPD Queue Token Opt | • Multi-Facility    |
| • Appointment/Encounter  | • Break-Glass Policy     | • Pharmacy Dispensing |   Patient Transfer  |
| • Doctor Clinical EMR    | • Immutable Audit Engine | • MAR Administration  | • Bed Capacity      |
| • Grounded AI Search     | • AI Action Boundaries   | • Itemized Billing    |   Prediction        |
| • AI Note Drafting       | • Task State Management  | • Insurance Pre-Auth  | • Patient Self-     |
| • Lab Order & Verify     | • Urgent Notifications   | • PACS Image Viewer   |   Scheduling App    |
| • Discharge Summary      | • Fail-Safe Degraded Mode| • ICU Telemetry       |                     |
+--------------------------+--------------------------+-----------------------+---------------------+
| NOT PLANNED (Explicit Exclusions):                                                                |
| • Direct Patient AI Diagnostic Chatbot                                                            |
| • Autonomous Clinical Order Execution without Clinician Sign-off                                  |
| • Ambient Voice Hardware Room Scribing                                                            |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Hospital Department Models

| Department            | Major Workflows                                               | Primary Users                | Key Data                                            | AI Opportunities                                  | Safety Considerations                                               |
| :-------------------- | :------------------------------------------------------------ | :--------------------------- | :-------------------------------------------------- | :------------------------------------------------ | :------------------------------------------------------------------ |
| **Emergency (ED)**    | Rapid triage, acuity scoring, emergency ordering              | ER Doctor, Triage Nurse      | Vitals, chief complaints, allergy history           | Acuity assistance, handover drafting              | High risk; zero auto-order execution; fast-path human overrides     |
| **Outpatient (OPD)**  | Appointment scheduling, check-in, consultation, note drafting | OPD Doctor, Receptionist     | Appointment slots, consultation notes               | Note drafting, history summaries                  | AI notes side-by-side only; mandatory doctor review before saving   |
| **Inpatient (IPD)**   | Ward rounds, progress notes, discharge planning               | IPD Doctor, Ward Nurse       | Daily vitals, progress notes, care plans            | Daily round summary, handover drafting            | Real-time freshness checks; prompt notification of abnormal vitals  |
| **Pharmacy**          | Prescription review, interaction check, dispensing            | Pharmacist, Pharmacy Tech    | Active prescriptions, drug inventory, allergy lists | Drug interaction warnings, allergy checking       | Pharmacological DB primary truth; AI does not infer drug rules      |
| **Laboratory**        | Specimen logging, analyzer integration, result verification   | Lab Tech, Pathologist        | Test requests, lab results, reference ranges        | Abnormal trend detection, result summary drafting | Pathologist approval required for verification; panic flags instant |
| **Billing & Finance** | Charge capture, itemized billing, payment settlement          | Billing Clerk, Finance Admin | Tariff master, service logs, invoice status         | Unbilled item detection                           | Financial lock immutable without supervisor approval                |
| **Reception / Reg**   | Patient registration, identity verification, check-in         | Receptionist, Front Desk     | Demographics, government IDs                        | ID document OCR extraction, duplicate detection   | Identity verification required before chart creation                |
| **Administration**    | Staff rostering, department metrics, audit review             | Hospital Admin, Sys Admin    | Access logs, audit events, throughput metrics       | Operational bottleneck reporting                  | System config changes audited; no clinical record access            |

---

## 4. Core Product Modules Catalog

### 4.1 Module Specifications & Scope Classification

1. **Patient Management Module**
   - **Purpose:** Centralized demographic, identity, contact, and medical record index (EMPI).
   - **Target Users:** Receptionist, Registration Clerk, Nurse, Doctor, Admin.
   - **Scope Status:** **MVP CORE**

2. **Appointment & Encounter Management Module**
   - **Purpose:** Scheduling doctor consultations, encounter check-in, and encounter status tracking.
   - **Target Users:** Receptionist, OPD Doctor, Clinic Coordinator.
   - **Scope Status:** **MVP CORE**

3. **Clinical Workspace (Doctor EMR)**
   - **Purpose:** Primary interface for physicians to view history, document visits, order lab tests, and review results.
   - **Target Users:** OPD Doctor, IPD Physician, ER Doctor.
   - **Scope Status:** **MVP CORE**

4. **AI Search & Workspace Module**
   - **Purpose:** Cross-system natural language query interface for grounded patient chart search and clinical drafting.
   - **Target Users:** Doctor, Nurse, Department Head.
   - **Scope Status:** **MVP CORE**

5. **Diagnostics & Laboratory Module**
   - **Purpose:** Managing lab test orders, specimen logging, result entry, verification, and critical value alerting.
   - **Target Users:** Lab Technician, Pathologist, Ordering Physician.
   - **Scope Status:** **MVP CORE**

6. **Discharge Workflow Module**
   - **Purpose:** Discharge summary drafting and authorization for an eligible encounter.
   - **Target Users:** Doctor, Nurse.
   - **Scope Status:** **MVP CORE** (Focused on eligible encounter summary drafting & authorization; no dedicated inpatient ward subsystem required).

7. **Audit & Compliance Module**
   - **Purpose:** Immutable audit logging, access tracing, break-glass review, and security reporting.
   - **Target Users:** Security Administrator, Systems Auditor.
   - **Scope Status:** **MVP SUPPORTING**

8. **Pharmacy & Medication Dispensing Module**
   - **Purpose:** Prescription receipt, drug interaction validation, and dispensing.
   - **Scope Status:** **PHASE 2 (Deferred Scope)**

9. **Billing & Service Charge Module**
   - **Purpose:** Aggregating consultation, lab, and service charges into itemized invoices.
   - **Scope Status:** **PHASE 2 (Deferred Scope)**

10. **Insurance & Pre-Auth Module**
    - **Purpose:** Pre-authorization request submission, insurance claim generation.
    - **Scope Status:** **PHASE 2 (Deferred Scope)**

---

## 5. Requirements Conflict Priority Hierarchy

When requirements conflict, the following non-negotiable hierarchy applies:

1. **Patient Safety** (Zero clinical compromise, human approval for all clinical state changes).
2. **Security & PHI Protection** (Strict authorization, least privilege, encryption in transit and at rest).
3. **Auditability & Integrity** (Immutable audit logs, authoritative state persistence).
4. **Workflow Correctness** (Accurate state transitions across departments).
5. **Product Value & Throughput** (Clinician time saved, documentation efficiency).
6. **User Convenience** (Visual shortcuts, automated defaults).

---

## 6. Product Jurisdiction Strategy

**Architecture Strategy:** Global-first.

The core product architecture must not be unnecessarily hardcoded to any single country's healthcare regulations or workflows. The conceptual architecture must remain capable of supporting jurisdiction-specific policies, consent requirements, data handling and retention rules, audit requirements, access policies, interoperability requirements, and compliance controls — without requiring core architectural redesign per deployment.

**Initial Validation Context:** India.

The first product validation and clinical workflow assumptions will be tested against Indian hospital environments. This is a product-validation choice, not an architectural constraint.

**Regulatory Position:** Jurisdiction-specific regulatory and compliance requirements remain deployment-dependent. Applicable regulations must be explicitly identified and mapped before production deployment in any given jurisdiction. No regulatory compliance certification is claimed in this specification.

_(Note: Specific jurisdiction regulatory mapping and compliance verification programs are DEFERRED to deployment planning and legal review.)_

---

## 7. Critical Lab Value Safety Boundary

> [!IMPORTANT]
> **Hard Healthcare Safety Boundary:** Configured deterministic clinical policy rules are the sole authoritative mechanism for critical/panic laboratory-value classification. AI is explicitly non-authoritative for this classification.

Critical/panic value thresholds are policy-owned, facility-configurable, and governed by clinical governance — not inferred by a model. AI may assist with contextual summarization, trend presentation, prioritization support, and workflow communication around laboratory results, but AI does not decide whether a result is a critical/panic value.

### 7.1 Conceptual Critical Lab Value Workflow

```text
Lab Result
    ↓
Configured Deterministic Clinical Rule Evaluation
    ↓
Critical / Panic Classification (Policy-Driven)
    ↓
Urgent Notification Dispatched
    ↓
Human Clinical Review (Mandatory)
    ↓
Clinical Action if Appropriate (Human Decision)
    ↓
Audit Event Recorded
```

AI may participate in contextual assistance around this workflow (e.g. surfacing trend history, summarizing result context for the reviewing clinician) but must not replace the authoritative deterministic clinical rule at the classification step.

_(Note: Specific threshold values, reference range databases, and rule engine technology selection are DEFERRED to clinical governance and Phase 3 Architecture.)_
