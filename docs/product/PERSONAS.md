# Hospital AI OS — Persona & User Model Specification

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Product Management & Security Rules  
> **Scope:** Comprehensive definition of hospital user roles, responsibilities, data access limits, and AI boundaries.

---

## 1. Persona Classification Matrix

| Cluster | Role Name | MVP Classification | Primary Focus |
| :--- | :--- | :--- | :--- |
| **Clinical** | Physician / Doctor | **MVP** | Clinical diagnosis, treatment plans, order signing, discharge approval |
| **Clinical** | Staff Nurse / Ward Nurse | **MVP** | Patient care execution, MAR administration, vital logging, shift handover |
| **Clinical** | Pharmacist | **MVP** | Prescription review, drug allergy/interaction check, dispensing |
| **Clinical** | Laboratory Technician | **MVP** | Specimen processing, test result entry, critical value alerts |
| **Clinical** | Radiologist | Phase 2 | DICOM study interpretation, radiology report authorization |
| **Operations** | Receptionist / Registration | **MVP** | Patient registration, identity verification, check-in, queueing |
| **Operations** | Front-Desk Supervisor | **MVP** | OPD queue balancing, appointment overrides, patient flow |
| **Operations** | Hospital Ops Manager | Phase 2 | Operational bottleneck monitoring, department throughput |
| **Operations** | Department Coordinator | Phase 2 | Resource allocation, clinic room assignments |
| **Operations** | Hospital Administrator | **MVP** | System-wide operational settings, staff role management |
| **Financial** | Billing Clerk | **MVP** | Service charge verification, invoice drafting, payment receipt |
| **Financial** | Insurance Specialist | Phase 2 | Pre-authorization submission, claim adjudication tracking |
| **Financial** | Finance Administrator | Phase 2 | Tariff master management, audit reporting, financial locks |
| **Technical** | System Administrator | **MVP** | User provisioning, environment configuration, system status monitoring |
| **Technical** | Security Administrator | **MVP** | Access rule management, break-glass audit review, security alerts |
| **Patient** | Patient | Phase 2 | Appointment requests, viewing verified summary, payment |
| **Patient** | Authorized Caregiver | Phase 2 | Viewing patient logistics, verified updates, payment |

---

## 2. Clinical Roles Specification

### 2.1 Physician / Doctor
- **MVP Status:** **MVP**
- **Goals:** Deliver high-quality clinical care, minimize administrative documentation burden, avoid diagnostic delays.
- **Responsibilities:** History taking, clinical examination, ordering lab/diagnostic tests, prescribing medications, drafting progress notes, approving discharge summaries.
- **Typical Workflows:** OPD Consultation, Ward Round Note Entry, Order Entry, Lab Result Review, Discharge Authorization.
- **Information Needed:** Complete patient clinical history, active/past medications, allergy list, vitals history, lab/imaging results, consultation notes.
- **Information Must NOT See:** Unredacted financial tariff margins, system security audit logs, raw billing clerk notes, unassigned patient data outside assigned department (unless emergency break-glass activated).
- **Actions Allowed:** Place diagnostic/drug orders, write clinical notes, request consults, approve discharge summaries.
- **Actions Requiring Approval:** High-risk non-formulary drug orders (requires Pharmacy Chair approval), emergency break-glass access outside assigned patients.
- **AI Assistance Allowed:** Retrieval search of patient chart, AI note drafting (side-by-side), discharge summary drafting, differential support recommendations.

### 2.2 Staff Nurse / Ward Nurse
- **MVP Status:** **MVP**
- **Goals:** Ensure timely medication administration, maintain accurate vitals records, execute physician orders safely.
- **Responsibilities:** Administering prescribed medications (MAR), logging vitals, completing care tasks, conducting shift handovers.
- **Typical Workflows:** Morning Vitals Entry, MAR Dose Administration, Shift Handover Summary Generation, Doctor Order Execution.
- **Information Needed:** Assigned patient vitals, active medication orders, allergy alerts, care plan tasks, doctor instructions.
- **Information Must NOT See:** Patient financial billing details, administrative staff salary data, system access logs.
- **Actions Allowed:** Record vitals, mark MAR doses executed/skipped, document nursing notes, generate shift handover draft.
- **Actions Requiring Approval:** Administering controlled substances (requires second nurse co-signature), modifying active doctor orders (prohibited).
- **AI Assistance Allowed:** Shift handover draft generation, missed task reminders, abnormal vital trend flagging.

### 2.3 Pharmacist
- **MVP Status:** **MVP**
- **Goals:** Prevent adverse drug events, verify prescription accuracy, dispense correct medications promptly.
- **Responsibilities:** Validating physician prescriptions against patient allergies/drug interactions, reservation of inventory, medication dispensing.
- **Typical Workflows:** Prescription Verification Queue, Allergy/Interaction Alert Resolution, Dispensing Confirmation.
- **Information Needed:** Patient active prescriptions, document allergy history, kidney/liver function lab markers, drug inventory levels.
- **Information Must NOT See:** Detailed physician progress narrative notes unrelated to drug therapy, patient billing payment history.
- **Actions Allowed:** Verify prescriptions, flag interaction alerts, dispense medications, substitute generic bio-equivalents.
- **Actions Requiring Approval:** Cancelling doctor medication orders (requires doctor confirmation), dispensing off-label restricted drugs.
- **AI Assistance Allowed:** Automated interaction/allergy checking against pharmacological database, dispensing queue prioritization.

### 2.4 Laboratory Technician
- **MVP Status:** **MVP**
- **Goals:** Process diagnostic specimens accurately, deliver fast lab test turnaround times.
- **Responsibilities:** Logging incoming specimens, entering raw test results, flagging panic values.
- **Typical Workflows:** Specimen Intake, Result Entry, Critical Value Alert Escalation.
- **Information Needed:** Diagnostic orders, test specifications, patient demographic ID, sample bar code.
- **Information Must NOT See:** Complete clinical psychiatric notes, patient billing records, unrelated pharmacy orders.
- **Actions Allowed:** Log specimen intake, enter lab result values, trigger panic value alerts.
- **Actions Requiring Approval:** Final lab report sign-off (requires Pathologist approval for complex panels).
- **AI Assistance Allowed:** Abnormal result trend detection, preliminary lab summary formatting.

---

## 3. Operations Roles Specification

### 3.1 Receptionist / Registration Clerk
- **MVP Status:** **MVP**
- **Goals:** Register incoming patients accurately, verify demographic identity, minimize check-in queues.
- **Responsibilities:** Collecting patient registration details, verifying ID, booking OPD appointments, issuing queue numbers.
- **Typical Workflows:** New Patient Registration, OPD Appointment Check-In, Queue Token Issuance.
- **Information Needed:** Patient demographics (Name, DOB, Gender, Address, Phone, Emergency Contact, Government ID), Doctor OPD schedule availability.
- **Information Must NOT See:** Detailed clinical notes, medical diagnoses, lab result details, sensitive psychiatric history.
- **Actions Allowed:** Create patient profile, update demographic contact info, book/reschedule OPD appointments, check-in patients.
- **Actions Requiring Approval:** Merging duplicate patient records (requires System Admin approval), overriding locked doctor appointment caps.
- **AI Assistance Allowed:** Document OCR extraction from government ID cards, duplicate patient identity detection.

### 3.2 Hospital Administrator
- **MVP Status:** **MVP**
- **Goals:** Maintain operational continuity, manage staff privileges, ensure compliance.
- **Responsibilities:** User role assignments, system-wide department configuration, monitoring throughput.
- **Information Needed:** User roster, department operational statistics, system audit summaries.
- **Information Must NOT See:** Patient clinical progress notes, confidential physician-patient therapy discussions (unless under explicit legal audit authorization).
- **Actions Allowed:** Manage user role assignments, configure clinic schedules, view aggregated operational reports.
- **Actions Requiring Approval:** System-wide data purging (prohibited), granting root security access (requires Security Admin co-signature).
- **AI Assistance Allowed:** Department operational bottleneck detection, workload summary generation.

---

## 4. Financial & Technical Roles Specification

### 4.1 Billing Clerk
- **MVP Status:** **MVP**
- **Goals:** Ensure complete charge capture, issue accurate invoices, receive payments promptly.
- **Responsibilities:** Reviewing unbilled clinical services, compiling itemized statements, accepting payments.
- **Typical Workflows:** Charge Audit, Invoice Draft Generation, Payment Receipt Posting, Discharge Clearance.
- **Information Needed:** Service tariff master, list of rendered procedures/orders, bed stay duration, payment methods.
- **Information Must NOT See:** Detailed clinical history, physician diagnostic reasoning, sensitive progress notes.
- **Actions Allowed:** Compile invoices, apply approved discounts, post payment receipts, issue discharge financial clearance.
- **Actions Requiring Approval:** Writing off outstanding patient balances above $100 (requires Finance Admin approval).
- **AI Assistance Allowed:** Unbilled service detection (cross-referencing executed doctor orders against bill items).

### 4.2 Security Administrator
- **MVP Status:** **MVP**
- **Goals:** Enforce data security, maintain HIPAA/DISHA compliance, monitor unauthorized access.
- **Responsibilities:** Monitoring access logs, auditing break-glass activations, managing security alerts.
- **Information Needed:** Complete system audit logs, user login records, permission change events, break-glass logs.
- **Information Must NOT See:** Unjustified browsing of individual patient clinical notes (auditors view metadata/access logs, not PHI content, unless conducting explicit breach investigation).
- **Actions Allowed:** Lock compromised user accounts, review break-glass events, configure IP security boundaries.
- **Actions Requiring Approval:** Permanent user deletion (requires Hospital Admin confirmation).
- **AI Assistance Allowed:** Anomaly detection in access logs (e.g., unusual bulk record access).

---

## 5. Data Visibility & Access Boundary Matrix

```text
+---------------------------------------------------------------------------------------------------+
|                                   DATA VISIBILITY BOUNDARY MATRIX                                 |
+----------------------+--------------------+--------------------+--------------------+-------------+
| Role                 | Demographics / ID  | Clinical Notes     | Financial / Bills  | Audit Logs  |
+----------------------+--------------------+--------------------+--------------------+-------------+
| Doctor               | Full Access        | Full Access        | Restricted         | None        |
| Nurse                | Full Access        | Assigned Patients  | Restricted         | None        |
| Pharmacist           | Basic Info         | Meds/Labs Only     | Drug Billing Only  | None        |
| Lab Tech             | Basic Info         | Diagnostic Orders  | None               | None        |
| Receptionist         | Full Access        | NONE               | Basic Payment      | None        |
| Billing Clerk        | Full Access        | Services Rendered  | Full Access        | None        |
| Hospital Admin       | Basic Info         | NONE               | Summary Reports    | Summaries   |
| Security Admin       | Basic Info         | NONE (Logs Only)   | None               | FULL ACCESS |
| Patient (Phase 2)    | Own Record         | Verified Summary   | Own Bills          | None        |
+----------------------+--------------------+--------------------+--------------------+-------------+
```
