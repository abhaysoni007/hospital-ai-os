# Hospital AI OS — Database Design

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** Domain Model, Security Rules  
> **Scope:** PostgreSQL schema design, tables, indexes, constraints, audit strategy, encryption, soft deletion

---

## 1. Database Technology

**PostgreSQL 16** with the following extensions:

| Extension  | Purpose                                                       |
| :--------- | :------------------------------------------------------------ |
| `pgvector` | Vector similarity search for AI chart search (RAG embeddings) |
| `pgcrypto` | Cryptographic functions for field-level encryption            |
| `pg_trgm`  | Trigram indexes for fuzzy patient name search                 |

See **ADR-002** for the full decision record.

---

## 2. Schema Conventions

| Convention                 | Rule                                                                                                                                     |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Naming**                 | `snake_case` for tables, columns, indexes, constraints                                                                                   |
| **Primary keys**           | `id UUID DEFAULT gen_random_uuid()` on every table                                                                                       |
| **Timestamps**             | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`                                         |
| **Soft deletion**          | `deleted_at TIMESTAMPTZ NULL` — soft-deleted rows excluded by application-layer default queries; hard deletion prohibited for PHI tables |
| **Enums**                  | PostgreSQL native ENUM types (e.g., `CREATE TYPE encounter_status AS ENUM (...)`)                                                        |
| **Foreign keys**           | Enforced with `ON DELETE RESTRICT` (never CASCADE for clinical data)                                                                     |
| **Optimistic concurrency** | `version INTEGER NOT NULL DEFAULT 1` on mutable clinical tables                                                                          |
| **Audit**                  | Audit table is append-only; no UPDATE or DELETE permitted                                                                                |

---

## 3. Table Definitions

### 3.1 patients

```sql
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn             VARCHAR(20) NOT NULL UNIQUE,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  date_of_birth   DATE NOT NULL,
  gender          gender_type NOT NULL,
  phone_primary   VARCHAR(20) NOT NULL,
  phone_emergency VARCHAR(20),
  emergency_contact_name VARCHAR(100),
  address_line_1  VARCHAR(200),
  address_city    VARCHAR(100),
  address_state   VARCHAR(100),
  address_postal_code VARCHAR(20),
  status          patient_status NOT NULL DEFAULT 'active',
  created_by      UUID NOT NULL REFERENCES staff(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
```

**Indexes:**

- `idx_patients_mrn` — UNIQUE on `mrn`
- `idx_patients_name_trgm` — GIN trigram on `(first_name, last_name)` for fuzzy search
- `idx_patients_dob` — B-tree on `date_of_birth`
- `idx_patients_phone` — B-tree on `phone_primary`
- `idx_patients_status` — B-tree on `status` WHERE `deleted_at IS NULL`

---

### 3.2 identities

```sql
CREATE TABLE identities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  document_type       document_type NOT NULL,
  document_number_enc VARCHAR(500) NOT NULL,  -- encrypted with pgcrypto
  document_image_path VARCHAR(500),
  ocr_extracted_data  JSONB,                  -- encrypted at application layer
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verified_by         UUID REFERENCES staff(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_identities_patient` — B-tree on `patient_id`
- `idx_identities_status` — B-tree on `verification_status`

---

### 3.3 staff

```sql
CREATE TABLE staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   VARCHAR(50) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  role          staff_role NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  phone         VARCHAR(20),
  status        staff_status NOT NULL DEFAULT 'active',
  mfa_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_staff_email` — UNIQUE on `email`
- `idx_staff_employee_id` — UNIQUE on `employee_id`
- `idx_staff_role` — B-tree on `role`
- `idx_staff_department` — B-tree on `department_id`

---

### 3.4 departments

```sql
CREATE TABLE departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  code       VARCHAR(20) NOT NULL UNIQUE,
  status     department_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.5 appointments

```sql
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id       UUID NOT NULL REFERENCES staff(id),
  department_id   UUID NOT NULL REFERENCES departments(id),
  scheduled_date  DATE NOT NULL,
  scheduled_time  TIME NOT NULL,
  token_number    INTEGER,
  status          appointment_status NOT NULL DEFAULT 'booked',
  encounter_id    UUID REFERENCES encounters(id),
  created_by      UUID NOT NULL REFERENCES staff(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_appointments_patient` — B-tree on `patient_id`
- `idx_appointments_doctor_date` — B-tree on `(doctor_id, scheduled_date)`
- `idx_appointments_status` — B-tree on `status`
- `idx_appointments_token` — UNIQUE on `(doctor_id, scheduled_date, token_number)` WHERE `token_number IS NOT NULL`

---

### 3.6 encounters

```sql
CREATE TABLE encounters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id       UUID NOT NULL REFERENCES staff(id),
  department_id   UUID NOT NULL REFERENCES departments(id),
  encounter_type  encounter_type NOT NULL,
  chief_complaint TEXT,
  status          encounter_status NOT NULL DEFAULT 'registered',
  started_at      TIMESTAMPTZ,
  discharged_at   TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES staff(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version         INTEGER NOT NULL DEFAULT 1
);
```

**Indexes:**

- `idx_encounters_patient` — B-tree on `patient_id`
- `idx_encounters_doctor` — B-tree on `doctor_id`
- `idx_encounters_status` — B-tree on `status`
- `idx_encounters_created` — B-tree on `created_at DESC`

---

### 3.7 clinical_records

```sql
CREATE TABLE clinical_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id  UUID NOT NULL REFERENCES encounters(id) ON DELETE RESTRICT,
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  record_type   clinical_record_type NOT NULL,
  content       JSONB NOT NULL,
  vitals        JSONB,
  ai_draft_id   UUID REFERENCES ai_interactions(id),
  status        clinical_record_status NOT NULL DEFAULT 'draft',
  signed_by     UUID REFERENCES staff(id),
  signed_at     TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    UUID NOT NULL REFERENCES staff(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_clinical_records_encounter` — B-tree on `encounter_id`
- `idx_clinical_records_patient` — B-tree on `patient_id`
- `idx_clinical_records_type` — B-tree on `record_type`
- `idx_clinical_records_status` — B-tree on `status`

---

### 3.8 diagnostic_orders

```sql
CREATE TABLE diagnostic_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id        UUID NOT NULL REFERENCES encounters(id) ON DELETE RESTRICT,
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  ordering_doctor_id  UUID NOT NULL REFERENCES staff(id),
  test_code           VARCHAR(50) NOT NULL,
  test_name           VARCHAR(200) NOT NULL,
  clinical_indication TEXT,
  priority            order_priority NOT NULL DEFAULT 'routine',
  status              diagnostic_order_status NOT NULL DEFAULT 'ordered',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_diagnostic_orders_encounter` — B-tree on `encounter_id`
- `idx_diagnostic_orders_patient` — B-tree on `patient_id`
- `idx_diagnostic_orders_status` — B-tree on `status`

---

### 3.9 diagnostic_results

```sql
CREATE TABLE diagnostic_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL UNIQUE REFERENCES diagnostic_orders(id) ON DELETE RESTRICT,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  test_code       VARCHAR(50) NOT NULL,
  result_values   JSONB NOT NULL,
  reference_range JSONB,
  is_abnormal     BOOLEAN NOT NULL DEFAULT FALSE,
  is_critical     BOOLEAN NOT NULL DEFAULT FALSE,
  critical_rule_id UUID REFERENCES critical_value_rules(id),
  status          diagnostic_result_status NOT NULL DEFAULT 'preliminary',
  entered_by      UUID NOT NULL REFERENCES staff(id),
  verified_by     UUID REFERENCES staff(id),
  verified_at     TIMESTAMPTZ,
  ai_summary      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_diagnostic_results_order` — UNIQUE on `order_id`
- `idx_diagnostic_results_patient` — B-tree on `patient_id`
- `idx_diagnostic_results_critical` — B-tree on `is_critical` WHERE `is_critical = TRUE`
- `idx_diagnostic_results_status` — B-tree on `status`

---

### 3.10 critical_value_rules

```sql
CREATE TABLE critical_value_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_code       VARCHAR(50) NOT NULL,
  parameter_name  VARCHAR(100) NOT NULL,
  unit            VARCHAR(20) NOT NULL,
  normal_low      DECIMAL(10,4),
  normal_high     DECIMAL(10,4),
  critical_low    DECIMAL(10,4),
  critical_high   DECIMAL(10,4),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by      UUID NOT NULL REFERENCES staff(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(test_code, parameter_name) WHERE (is_active = TRUE)
);
```

**Indexes:**

- `idx_critical_rules_test_code` — B-tree on `test_code` WHERE `is_active = TRUE`

---

### 3.11 tasks

```sql
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type     task_type NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  patient_id    UUID REFERENCES patients(id),
  encounter_id  UUID REFERENCES encounters(id),
  assigned_to   UUID REFERENCES staff(id),
  assigned_by   UUID REFERENCES staff(id),
  priority      task_priority NOT NULL DEFAULT 'medium',
  status        task_status NOT NULL DEFAULT 'created',
  due_at        TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_tasks_assigned_to` — B-tree on `assigned_to`
- `idx_tasks_status` — B-tree on `status`
- `idx_tasks_priority` — B-tree on `priority` WHERE `status NOT IN ('completed', 'cancelled')`

---

### 3.12 notifications

```sql
CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id      UUID NOT NULL REFERENCES staff(id),
  notification_type notification_type NOT NULL,
  title             VARCHAR(200) NOT NULL,
  body              TEXT NOT NULL,
  reference_type    VARCHAR(50),
  reference_id      UUID,
  priority          notification_priority NOT NULL,
  status            notification_status NOT NULL DEFAULT 'dispatched',
  acknowledged_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_notifications_recipient` — B-tree on `recipient_id`
- `idx_notifications_status` — B-tree on `status` WHERE `status != 'acknowledged'`
- `idx_notifications_priority` — B-tree on `priority` WHERE `priority = 'critical'`

---

### 3.13 ai_interactions

```sql
CREATE TABLE ai_interactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_type    ai_interaction_type NOT NULL,
  initiated_by        UUID NOT NULL REFERENCES staff(id),
  patient_id          UUID REFERENCES patients(id),
  encounter_id        UUID REFERENCES encounters(id),
  prompt_template_id  VARCHAR(100),
  context_summary     JSONB,
  model_provider      VARCHAR(50) NOT NULL,
  model_name          VARCHAR(100) NOT NULL,
  input_tokens        INTEGER NOT NULL DEFAULT 0,
  output_tokens       INTEGER NOT NULL DEFAULT 0,
  latency_ms          INTEGER NOT NULL DEFAULT 0,
  raw_response        JSONB,
  parsed_output       JSONB,
  grounding_status    grounding_status NOT NULL DEFAULT 'unverified',
  user_action         ai_user_action NOT NULL DEFAULT 'pending',
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_ai_interactions_initiated_by` — B-tree on `initiated_by`
- `idx_ai_interactions_patient` — B-tree on `patient_id`
- `idx_ai_interactions_type` — B-tree on `interaction_type`
- `idx_ai_interactions_created` — B-tree on `created_at DESC`

---

### 3.14 audit_events

```sql
CREATE TABLE audit_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_number  BIGSERIAL NOT NULL UNIQUE,
  event_type       VARCHAR(100) NOT NULL,
  actor_id         UUID NOT NULL REFERENCES staff(id),
  actor_role       VARCHAR(50) NOT NULL,
  actor_department VARCHAR(100) NOT NULL,
  target_type      VARCHAR(50),
  target_id        UUID,
  patient_id       UUID,
  action_detail    JSONB,
  justification    TEXT,
  ip_address       INET,
  correlation_id   UUID NOT NULL,
  previous_hash    VARCHAR(64) NOT NULL,
  record_hash      VARCHAR(64) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent any modification after insert
REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;
```

**Indexes:**

- `idx_audit_events_actor` — B-tree on `actor_id`
- `idx_audit_events_event_type` — B-tree on `event_type`
- `idx_audit_events_target` — B-tree on `(target_type, target_id)`
- `idx_audit_events_patient` — B-tree on `patient_id`
- `idx_audit_events_created` — B-tree on `created_at DESC`
- `idx_audit_events_sequence` — UNIQUE on `sequence_number`
- `idx_audit_events_correlation` — B-tree on `correlation_id`

---

### 3.15 embeddings (pgvector — for AI chart search)

```sql
CREATE TABLE embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type   VARCHAR(50) NOT NULL,  -- 'clinical_record', 'diagnostic_result'
  source_id     UUID NOT NULL,
  patient_id    UUID NOT NULL REFERENCES patients(id),
  content_hash  VARCHAR(64) NOT NULL,  -- detect content changes
  embedding     vector(1536) NOT NULL, -- dimension depends on model
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_embeddings_patient` — B-tree on `patient_id`
- `idx_embeddings_source` — B-tree on `(source_type, source_id)`
- `idx_embeddings_vector` — IVFFlat or HNSW on `embedding` for similarity search

---

### 3.16 refresh_tokens

```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**

- `idx_refresh_tokens_staff` — B-tree on `staff_id`
- `idx_refresh_tokens_hash` — UNIQUE on `token_hash`
- `idx_refresh_tokens_expires` — B-tree on `expires_at`

---

### 3.17 break_glass_sessions

```sql
CREATE TABLE break_glass_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES staff(id),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  justification   TEXT NOT NULL,
  granted_scope   JSONB NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at  TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES staff(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT
);
```

**Indexes:**

- `idx_break_glass_staff` — B-tree on `staff_id`
- `idx_break_glass_active` — B-tree on `is_active` WHERE `is_active = TRUE`

---

## 4. Enum Type Definitions

```sql
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'undisclosed');
CREATE TYPE patient_status AS ENUM ('active', 'merged', 'archived');
CREATE TYPE document_type AS ENUM ('aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'other');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE staff_role AS ENUM ('physician', 'nurse', 'pharmacist', 'lab_technician', 'receptionist', 'hospital_admin', 'security_admin');
CREATE TYPE staff_status AS ENUM ('active', 'suspended');
CREATE TYPE department_status AS ENUM ('active', 'inactive');
CREATE TYPE appointment_status AS ENUM ('booked', 'checked_in', 'in_consult', 'completed', 'cancelled');
CREATE TYPE encounter_type AS ENUM ('opd', 'follow_up');
CREATE TYPE encounter_status AS ENUM ('registered', 'active', 'discharge_initiated', 'discharged', 'closed');
CREATE TYPE clinical_record_type AS ENUM ('soap', 'progress_note', 'vital_signs', 'discharge_summary');
CREATE TYPE clinical_record_status AS ENUM ('draft', 'signed', 'amended');
CREATE TYPE order_priority AS ENUM ('routine', 'urgent', 'stat');
CREATE TYPE diagnostic_order_status AS ENUM ('ordered', 'sample_collected', 'in_progress', 'completed', 'cancelled');
CREATE TYPE diagnostic_result_status AS ENUM ('preliminary', 'verified', 'critical_flagged');
CREATE TYPE task_type AS ENUM ('lab_review', 'discharge_draft', 'critical_alert', 'general');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE task_status AS ENUM ('created', 'assigned', 'in_progress', 'awaiting_approval', 'completed', 'cancelled');
CREATE TYPE notification_type AS ENUM ('critical_lab_alert', 'task_assignment', 'break_glass_alert', 'system_alert');
CREATE TYPE notification_priority AS ENUM ('normal', 'urgent', 'critical');
CREATE TYPE notification_status AS ENUM ('dispatched', 'delivered', 'acknowledged');
CREATE TYPE ai_interaction_type AS ENUM ('note_draft', 'chart_search', 'discharge_draft', 'ocr');
CREATE TYPE grounding_status AS ENUM ('unverified', 'grounded', 'validation_failed');
CREATE TYPE ai_user_action AS ENUM ('pending', 'accepted', 'rejected', 'edited');
```

---

## 5. Data Integrity Rules

| Rule                                                                      | Enforcement                                                             |
| :------------------------------------------------------------------------ | :---------------------------------------------------------------------- |
| Patient cannot be hard-deleted                                            | Application layer + no CASCADE deletes                                  |
| Clinical records cannot be deleted after signing                          | Application layer constraint; `status = 'signed'` records are immutable |
| Audit events cannot be updated or deleted                                 | `REVOKE UPDATE, DELETE` on table; application layer enforcement         |
| Encounter cannot be discharged without all lab results verified           | Application layer pre-condition check                                   |
| Diagnostic result `is_critical` set only by deterministic rule evaluation | Application layer; field is not directly writable via API               |
| Optimistic concurrency on encounters and clinical records                 | `version` column checked on UPDATE                                      |

---

## 6. Encryption Strategy

| Data Category             | At Rest                                                                   | In Transit |
| :------------------------ | :------------------------------------------------------------------------ | :--------- |
| Identity document numbers | Field-level encryption via pgcrypto                                       | TLS        |
| OCR extracted data        | Application-layer AES encryption before storage                           | TLS        |
| Password hashes           | bcrypt (not reversible encryption)                                        | TLS        |
| Clinical record content   | Database-level transparent encryption (PostgreSQL TDE or disk encryption) | TLS        |
| AI raw responses          | Application-layer encryption                                              | TLS        |
| All other data            | Disk-level encryption                                                     | TLS        |

---

## 7. Retention & Soft Deletion

| Table                | Retention Policy                      | Hard Delete Allowed          |
| :------------------- | :------------------------------------ | :--------------------------- |
| `patients`           | Retain indefinitely (medical records) | **NO** — soft delete only    |
| `clinical_records`   | Retain indefinitely                   | **NO**                       |
| `diagnostic_results` | Retain indefinitely                   | **NO**                       |
| `audit_events`       | Retain indefinitely                   | **NO**                       |
| `ai_interactions`    | Configurable (default: 2 years)       | YES (after retention period) |
| `refresh_tokens`     | Auto-purge expired tokens             | YES                          |
| `notifications`      | Configurable (default: 90 days)       | YES (after retention period) |
