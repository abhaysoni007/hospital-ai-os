# Hospital AI OS — Domain Model

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** Product Specification & Data Flow (Phase 2.1)  
> **Scope:** Entity specifications, relationships, lifecycle states, sensitivity classification, audit requirements

---

## 1. Domain Model Overview

The domain model maps directly to the 13 conceptual data domains defined in `docs/architecture/DATA_FLOW.md`. Each entity below specifies purpose, key fields, relationships, ownership (which module owns it), lifecycle, sensitivity, and audit requirements.

```text
Patient ◄──── Identity
  │
  ├── Appointment ──► Encounter
  │                      │
  │                 Clinical Record
  │                      │
  │              Diagnostic Order ──► Diagnostic Result
  │
  ├── (referenced by) Task
  ├── (referenced by) Notification
  └── (referenced by) AI Interaction

Staff ──► Department
  │
  └── (actor in) Audit Event
```

---

## 2. Entity Specifications

### 2.1 Patient

| Attribute | Detail |
|:---|:---|
| **Purpose** | Core demographic index and master patient identity (EMPI) |
| **Owner Module** | Patient |
| **Sensitivity** | **PHI / High** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK, generated | No |
| `mrn` | String | Unique, system-generated | No |
| `first_name` | String | Required, max 100 | **PII** |
| `last_name` | String | Required, max 100 | **PII** |
| `date_of_birth` | Date | Required | **PII** |
| `gender` | Enum (Male, Female, Other, Undisclosed) | Required | **PII** |
| `phone_primary` | String | Required, validated format | **PII** |
| `phone_emergency` | String | Optional | **PII** |
| `emergency_contact_name` | String | Optional | **PII** |
| `address_line_1` | String | Optional | **PII** |
| `address_city` | String | Optional | **PII** |
| `address_state` | String | Optional | **PII** |
| `address_postal_code` | String | Optional | **PII** |
| `status` | Enum (Active, Merged, Archived) | Default: Active | No |
| `created_at` | Timestamp | Auto | No |
| `updated_at` | Timestamp | Auto | No |
| `created_by` | FK → Staff | Required | No |

**Relationships:**
- Has many `Identity` records
- Has many `Appointment` records
- Has many `Encounter` records
- Referenced by `Diagnostic Order`, `Diagnostic Result`, `Clinical Record`, `Task`, `Notification`, `AI Interaction`

**Lifecycle:** `Active` → `Merged` (duplicate resolved) → `Archived` (data retention policy)

**Audit Requirements:** `PATIENT_REGISTERED`, `PATIENT_UPDATED`, `PATIENT_MERGED`, `PATIENT_ACCESSED` (read)

---

### 2.2 Identity

| Attribute | Detail |
|:---|:---|
| **Purpose** | Government ID documents and identity verification records |
| **Owner Module** | Patient |
| **Sensitivity** | **PII / High** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `patient_id` | FK → Patient | Required | No |
| `document_type` | Enum (Aadhaar, PAN, Passport, DrivingLicense, VoterID, Other) | Required | No |
| `document_number` | String (encrypted) | Required | **PII** |
| `document_image_path` | String | Optional, encrypted reference | **PII** |
| `ocr_extracted_data` | JSONB (encrypted) | AI-extracted fields | **PII** |
| `verification_status` | Enum (Pending, Verified, Rejected) | Default: Pending | No |
| `verified_by` | FK → Staff | Required on verification | No |
| `created_at` | Timestamp | Auto | No |

**Relationships:**
- Belongs to `Patient`

**Lifecycle:** `Pending` → `Verified` | `Rejected`

**Audit Requirements:** `IDENTITY_UPLOADED`, `IDENTITY_VERIFIED`, `IDENTITY_REJECTED`

---

### 2.3 Staff

| Attribute | Detail |
|:---|:---|
| **Purpose** | Hospital employee profiles, authentication credentials, role assignments |
| **Owner Module** | Auth |
| **Sensitivity** | **Internal / Medium** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `employee_id` | String | Unique | No |
| `email` | String | Unique, validated | **PII** |
| `password_hash` | String | bcrypt, never exposed | **Secret** |
| `first_name` | String | Required | **PII** |
| `last_name` | String | Required | **PII** |
| `role` | Enum (Physician, Nurse, Pharmacist, LabTechnician, Receptionist, HospitalAdmin, SecurityAdmin) | Required | No |
| `department_id` | FK → Department | Required | No |
| `phone` | String | Optional | **PII** |
| `status` | Enum (Active, Suspended) | Default: Active | No |
| `mfa_enabled` | Boolean | Default: false | No |
| `last_login_at` | Timestamp | Nullable | No |
| `created_at` | Timestamp | Auto | No |
| `updated_at` | Timestamp | Auto | No |

**Relationships:**
- Belongs to `Department`
- Actor in `Audit Event`
- Assignee in `Task`

**Lifecycle:** `Active` → `Suspended` (revoked access, not deleted)

**Audit Requirements:** `STAFF_CREATED`, `STAFF_ROLE_CHANGED`, `STAFF_SUSPENDED`, `STAFF_LOGIN`, `STAFF_LOGIN_FAILED`

---

### 2.4 Department

| Attribute | Detail |
|:---|:---|
| **Purpose** | Organizational units within the hospital |
| **Owner Module** | Auth |
| **Sensitivity** | **Internal / Low** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `name` | String | Unique, required | No |
| `code` | String | Unique, required (e.g., OPD, LAB, ED) | No |
| `status` | Enum (Active, Inactive) | Default: Active | No |
| `created_at` | Timestamp | Auto | No |

**Relationships:**
- Has many `Staff`
- Referenced by `Appointment` (department scope)

**Lifecycle:** `Active` → `Inactive`

**Audit Requirements:** `DEPARTMENT_CREATED`, `DEPARTMENT_UPDATED`

---

### 2.5 Appointment

| Attribute | Detail |
|:---|:---|
| **Purpose** | Scheduled consultation slot |
| **Owner Module** | Encounter |
| **Sensitivity** | **PHI / Medium** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `patient_id` | FK → Patient | Required | No |
| `doctor_id` | FK → Staff | Required (role=Physician) | No |
| `department_id` | FK → Department | Required | No |
| `scheduled_date` | Date | Required | No |
| `scheduled_time` | Time | Required | No |
| `token_number` | Integer | Per-doctor per-day sequence | No |
| `status` | Enum (Booked, CheckedIn, InConsult, Completed, Cancelled) | Default: Booked | No |
| `encounter_id` | FK → Encounter | Set on check-in | No |
| `created_by` | FK → Staff | Required | No |
| `created_at` | Timestamp | Auto | No |
| `updated_at` | Timestamp | Auto | No |

**Relationships:**
- Belongs to `Patient`, `Staff` (doctor), `Department`
- Optionally linked to `Encounter`

**Lifecycle:** `Booked` → `CheckedIn` → `InConsult` → `Completed` | `Cancelled`

**Audit Requirements:** `APPOINTMENT_BOOKED`, `APPOINTMENT_CHECKED_IN`, `APPOINTMENT_CANCELLED`

---

### 2.6 Encounter

| Attribute | Detail |
|:---|:---|
| **Purpose** | Single episode of care (OPD visit, consultation session) |
| **Owner Module** | Encounter |
| **Sensitivity** | **PHI / High** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `patient_id` | FK → Patient | Required | No |
| `doctor_id` | FK → Staff | Required | No |
| `department_id` | FK → Department | Required | No |
| `encounter_type` | Enum (OPD, FollowUp) | Required | No |
| `chief_complaint` | Text | Nullable (set during consultation) | **PHI** |
| `status` | Enum (Registered, Active, DischargeInitiated, Discharged, Closed) | Default: Registered | No |
| `started_at` | Timestamp | Set when Active | No |
| `discharged_at` | Timestamp | Set when Discharged | No |
| `created_by` | FK → Staff | Required | No |
| `created_at` | Timestamp | Auto | No |
| `updated_at` | Timestamp | Auto | No |

**Relationships:**
- Belongs to `Patient`, `Staff` (doctor), `Department`
- Has many `Clinical Record`, `Diagnostic Order`
- Optionally linked from `Appointment`

**Lifecycle:** `Registered` → `Active` → `DischargeInitiated` → `Discharged` → `Closed`

**Audit Requirements:** `ENCOUNTER_CREATED`, `ENCOUNTER_ACTIVATED`, `ENCOUNTER_DISCHARGE_INITIATED`, `DISCHARGE_AUTHORIZED`, `ENCOUNTER_CLOSED`

---

### 2.7 Clinical Record

| Attribute | Detail |
|:---|:---|
| **Purpose** | Clinical notes, vitals, SOAP entries, progress notes |
| **Owner Module** | Clinical |
| **Sensitivity** | **PHI / Critical** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `encounter_id` | FK → Encounter | Required | No |
| `patient_id` | FK → Patient | Required (denormalized for query) | No |
| `record_type` | Enum (SOAP, ProgressNote, VitalSigns, DischargeSummary) | Required | No |
| `content` | JSONB | Structured clinical content | **PHI** |
| `vitals` | JSONB | Nullable (for VitalSigns type) | **PHI** |
| `ai_draft_id` | FK → AI Interaction | Nullable (if AI-assisted) | No |
| `status` | Enum (Draft, Signed, Amended) | Default: Draft | No |
| `signed_by` | FK → Staff | Required on signing | No |
| `signed_at` | Timestamp | Set on signing | No |
| `version` | Integer | Optimistic concurrency | No |
| `created_by` | FK → Staff | Required | No |
| `created_at` | Timestamp | Auto | No |
| `updated_at` | Timestamp | Auto | No |

**Relationships:**
- Belongs to `Encounter`, `Patient`
- Optionally references `AI Interaction` (for AI-drafted records)

**Lifecycle:** `Draft` → `Signed` → `Amended` (creates new version; previous version immutable)

**Audit Requirements:** `CLINICAL_RECORD_CREATED`, `CLINICAL_NOTE_SIGNED`, `CLINICAL_RECORD_AMENDED` (reserved — amendment deferred per ADR-015), `CLINICAL_RECORD_ACCESSED`, `CLINICAL_RECORD_DRAFT_UPDATED` (added per ADR-015)

---

### 2.8 Diagnostic Order

| Attribute | Detail |
|:---|:---|
| **Purpose** | Lab test requisition placed by a physician |
| **Owner Module** | Lab |
| **Sensitivity** | **PHI / High** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `encounter_id` | FK → Encounter | Required | No |
| `patient_id` | FK → Patient | Required | No |
| `ordering_doctor_id` | FK → Staff | Required | No |
| `test_code` | String | Required (from test catalog) | No |
| `test_name` | String | Required | No |
| `clinical_indication` | Text | Optional | **PHI** |
| `priority` | Enum (Routine, Urgent, STAT) | Default: Routine | No |
| `status` | Enum (Ordered, SampleCollected, InProgress, Completed, Cancelled) | Default: Ordered | No |
| `created_at` | Timestamp | Auto | No |
| `updated_at` | Timestamp | Auto | No |

**Relationships:**
- Belongs to `Encounter`, `Patient`, `Staff` (ordering doctor)
- Has one `Diagnostic Result`

**Lifecycle:** `Ordered` → `SampleCollected` → `InProgress` → `Completed` | `Cancelled`

**Audit Requirements:** `DIAGNOSTIC_ORDER_CREATED`, `SAMPLE_COLLECTED`, `DIAGNOSTIC_ORDER_CANCELLED`

---

### 2.9 Diagnostic Result

| Attribute | Detail |
|:---|:---|
| **Purpose** | Lab test result values, verification status, critical value flags |
| **Owner Module** | Lab |
| **Sensitivity** | **PHI / Critical** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `order_id` | FK → Diagnostic Order | Required, unique | No |
| `patient_id` | FK → Patient | Required | No |
| `test_code` | String | Required | No |
| `result_values` | JSONB | Structured test results | **PHI** |
| `reference_range` | JSONB | Normal range data | No |
| `is_abnormal` | Boolean | Computed by deterministic rules | No |
| `is_critical` | Boolean | Computed by deterministic clinical rules (NOT AI) | No |
| `critical_rule_id` | FK → CriticalValueRule | Nullable (set if critical) | No |
| `status` | Enum (Preliminary, Verified, CriticalFlagged) | Default: Preliminary | No |
| `entered_by` | FK → Staff | Required (Lab Tech) | No |
| `verified_by` | FK → Staff | Nullable (Pathologist) | No |
| `verified_at` | Timestamp | Nullable | No |
| `ai_summary` | Text | Optional AI-formatted summary | No |
| `created_at` | Timestamp | Auto | No |
| `updated_at` | Timestamp | Auto | No |

**Relationships:**
- Belongs to `Diagnostic Order`, `Patient`
- References `CriticalValueRule` (if critical)

**Lifecycle:** `Preliminary` → `Verified` | `CriticalFlagged` (→ notification dispatched → `Verified`)

**Audit Requirements:** `LAB_RESULT_ENTERED`, `LAB_RESULT_VERIFIED`, `CRITICAL_VALUE_DETECTED`, `CRITICAL_VALUE_NOTIFIED`

> [!IMPORTANT]
> The `is_critical` field is set exclusively by **deterministic configured clinical rules**, never by AI. See `PRODUCT_SPEC.md §7` and `AI_SYSTEM.md §3`.

---

### 2.10 Critical Value Rule (Supporting Entity)

| Attribute | Detail |
|:---|:---|
| **Purpose** | Facility-configurable reference ranges and critical/panic thresholds |
| **Owner Module** | Lab |
| **Sensitivity** | **Internal / Medium** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `test_code` | String | Required | No |
| `parameter_name` | String | Required (e.g., "Hemoglobin") | No |
| `unit` | String | Required (e.g., "g/dL") | No |
| `normal_low` | Decimal | Required | No |
| `normal_high` | Decimal | Required | No |
| `critical_low` | Decimal | Nullable | No |
| `critical_high` | Decimal | Nullable | No |
| `is_active` | Boolean | Default: true | No |
| `updated_by` | FK → Staff | Required | No |
| `updated_at` | Timestamp | Auto | No |

**Relationships:**
- Referenced by `Diagnostic Result`

**Lifecycle:** Active configuration; changes audited.

**Audit Requirements:** `CRITICAL_RULE_UPDATED`

---

### 2.11 Task

| Attribute | Detail |
|:---|:---|
| **Purpose** | Operational or clinical task assignment and tracking |
| **Owner Module** | Task |
| **Sensitivity** | **Internal / Medium** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `task_type` | Enum (LabReview, DischargeDraft, CriticalAlert, General) | Required | No |
| `title` | String | Required | No |
| `description` | Text | Optional | No |
| `patient_id` | FK → Patient | Nullable | No |
| `encounter_id` | FK → Encounter | Nullable | No |
| `assigned_to` | FK → Staff | Nullable | No |
| `assigned_by` | FK → Staff | Nullable | No |
| `priority` | Enum (Low, Medium, High, Critical) | Default: Medium | No |
| `status` | Enum (Created, Assigned, InProgress, AwaitingApproval, Completed, Cancelled) | Default: Created | No |
| `due_at` | Timestamp | Nullable | No |
| `completed_at` | Timestamp | Nullable | No |
| `created_at` | Timestamp | Auto | No |
| `updated_at` | Timestamp | Auto | No |

**Relationships:**
- Optionally references `Patient`, `Encounter`, `Staff`

**Lifecycle:** `Created` → `Assigned` → `InProgress` → `AwaitingApproval` → `Completed` | `Cancelled`

**Audit Requirements:** `TASK_CREATED`, `TASK_ASSIGNED`, `TASK_COMPLETED`

---

### 2.12 Notification

| Attribute | Detail |
|:---|:---|
| **Purpose** | Real-time clinical and operational alerts |
| **Owner Module** | Task |
| **Sensitivity** | **Internal / Medium** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `recipient_id` | FK → Staff | Required | No |
| `notification_type` | Enum (CriticalLabAlert, TaskAssignment, BreakGlassAlert, SystemAlert) | Required | No |
| `title` | String | Required | No |
| `body` | Text | Required (no raw PHI) | No |
| `reference_type` | String | Nullable (e.g., "DiagnosticResult") | No |
| `reference_id` | UUID | Nullable | No |
| `priority` | Enum (Normal, Urgent, Critical) | Required | No |
| `status` | Enum (Dispatched, Delivered, Acknowledged) | Default: Dispatched | No |
| `acknowledged_at` | Timestamp | Nullable | No |
| `created_at` | Timestamp | Auto | No |

**Relationships:**
- Belongs to `Staff` (recipient)
- Polymorphic reference to originating entity

**Lifecycle:** `Dispatched` → `Delivered` → `Acknowledged`

**Audit Requirements:** `NOTIFICATION_DISPATCHED`, `CRITICAL_ALERT_ACKNOWLEDGED`

---

### 2.13 AI Interaction

| Attribute | Detail |
|:---|:---|
| **Purpose** | Record of every AI invocation: prompt, response, grounding, evaluation |
| **Owner Module** | AI |
| **Sensitivity** | **Internal / High** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `interaction_type` | Enum (NoteDraft, ChartSearch, DischargeDraft, OCR) | Required | No |
| `initiated_by` | FK → Staff | Required | No |
| `patient_id` | FK → Patient | Nullable | No |
| `encounter_id` | FK → Encounter | Nullable | No |
| `prompt_template_id` | String | Version identifier | No |
| `context_summary` | JSONB | Summary of context provided (no raw PHI) | No |
| `model_provider` | String | e.g., "google-gemini" | No |
| `model_name` | String | e.g., "gemini-2.0-flash" | No |
| `input_tokens` | Integer | Token count | No |
| `output_tokens` | Integer | Token count | No |
| `latency_ms` | Integer | Request duration | No |
| `raw_response` | JSONB | Encrypted structured output | **Internal** |
| `parsed_output` | JSONB | Validated structured output | No |
| `grounding_status` | Enum (Unverified, Grounded, ValidationFailed) | Required | No |
| `user_action` | Enum (Pending, Accepted, Rejected, Edited) | Default: Pending | No |
| `rejection_reason` | Text | Nullable | No |
| `created_at` | Timestamp | Auto | No |

**Relationships:**
- Belongs to `Staff` (initiator)
- Optionally references `Patient`, `Encounter`
- Referenced by `Clinical Record` (if draft was accepted)

**Lifecycle:** `Pending` → `Accepted` | `Rejected` | `Edited`

**Audit Requirements:** `AI_DRAFT_GENERATED`, `AI_DRAFT_ACCEPTED`, `AI_DRAFT_REJECTED`, `AI_SEARCH_EXECUTED`

---

### 2.14 Audit Event

| Attribute | Detail |
|:---|:---|
| **Purpose** | Immutable, tamper-evident record of every significant system action |
| **Owner Module** | Audit |
| **Sensitivity** | **Critical / High** |

**Key Fields:**

| Field | Type | Constraints | Sensitive |
|:---|:---|:---|:---:|
| `id` | UUID | PK | No |
| `sequence_number` | BigInt | Auto-increment, unique | No |
| `event_type` | String | Required (e.g., `CLINICAL_NOTE_SIGNED`) | No |
| `actor_id` | FK → Staff | Required | No |
| `actor_role` | String | Snapshot of role at event time | No |
| `actor_department` | String | Snapshot of department at event time | No |
| `target_type` | String | Resource type (e.g., "Patient", "ClinicalRecord") | No |
| `target_id` | UUID | Resource identifier | No |
| `patient_id` | UUID | Nullable (for patient-related events) | No |
| `action_detail` | JSONB | Action metadata (no raw PHI) | No |
| `justification` | Text | Nullable (for break-glass, overrides) | No |
| `ip_address` | String | Client IP | No |
| `correlation_id` | UUID | Request trace ID | No |
| `previous_hash` | String (SHA-256) | Hash of preceding audit record | No |
| `record_hash` | String (SHA-256) | Hash of this record's content | No |
| `created_at` | Timestamp | Auto, immutable | No |

**Relationships:**
- References `Staff` (actor)
- Polymorphic reference to target entity

**Lifecycle:** **Write-once. No updates. No deletes. Immutable.**

**Audit Requirements:** This IS the audit infrastructure. Audit write failure is a **critical system failure** that blocks the originating operation.

> [!IMPORTANT]
> Audit records use hash chaining (`previous_hash` links each record to its predecessor) for tamper evidence. See `ADR-008`.
