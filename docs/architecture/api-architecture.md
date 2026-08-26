# Hospital AI OS — API Architecture

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** Engineering Rules, Security Rules  
> **Scope:** REST endpoint catalog, request/response contracts, authentication, authorization, validation, error handling

---

## 1. API Design Principles

| Principle | Application |
|:---|:---|
| **REST (JSON)** | All endpoints follow RESTful conventions. See ADR-003. |
| **Versioned** | All endpoints prefixed with `/api/v1/` |
| **Authenticated** | All endpoints require JWT unless explicitly public |
| **Authorized** | RBAC permission checked per endpoint |
| **Validated** | Request bodies validated with Zod schemas |
| **Audited** | State-changing operations emit audit events synchronously within a DB transaction boundary |
| **Consistent errors** | Standard error response format across all endpoints |
| **No PHI in URLs** | Patient IDs (UUIDs) are allowed; clinical data is never in query params |

### 1.1 Standard Response Envelope

**Success:**
```json
{
  "data": { ... },
  "meta": { "page": 1, "pageSize": 20, "total": 150 }
}
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [ ... ]
  }
}
```

### 1.2 Pagination

All list endpoints support cursor-based or offset pagination:
- `?page=1&pageSize=20` (offset-based, default)
- `?cursor=<id>&limit=20` (cursor-based, for real-time data)

### 1.3 Filtering & Sorting

- Filter: `?status=active&department_id=<uuid>`
- Sort: `?sortBy=created_at&sortOrder=desc`

---

## 2. Endpoint Catalog

### 2.1 Authentication (`/api/v1/auth`)

| Method | Path | Purpose | Auth | Role | Audit Event |
|:---|:---|:---|:---|:---|:---|
| POST | `/auth/login` | Authenticate with email + password | **Public** | — | `STAFF_LOGIN` / `STAFF_LOGIN_FAILED` |
| POST | `/auth/refresh` | Refresh access token | Cookie | — | — |
| POST | `/auth/logout` | Revoke refresh token | Required | Any | `STAFF_LOGOUT` |
| GET | `/auth/me` | Get current user profile | Required | Any | — |

**POST /auth/login**
```
Request:  { email: string, password: string }
Response: { data: { accessToken: string, user: { id, email, role, department } } }
Errors:   401 INVALID_CREDENTIALS, 429 RATE_LIMITED
```

---

### 2.2 Patients (`/api/v1/patients`)

| Method | Path | Purpose | Auth | Permission | Audit Event |
|:---|:---|:---|:---|:---|:---|
| POST | `/patients` | Register new patient | Required | `patient:create` | `PATIENT_REGISTERED` |
| GET | `/patients` | Search/list patients | Required | `patient:read` | — |
| GET | `/patients/:id` | Get patient details | Required | `patient:read` | `PATIENT_ACCESSED` |
| PATCH | `/patients/:id` | Update demographics | Required | `patient:update` | `PATIENT_UPDATED` |
| POST | `/patients/:id/identities` | Upload identity document | Required | `patient:create` | `IDENTITY_UPLOADED` |
| PATCH | `/patients/:id/identities/:identityId` | Verify identity | Required | `patient:verify_identity` | `IDENTITY_VERIFIED` |

**POST /patients**
```
Request: {
  firstName: string, lastName: string, dateOfBirth: string (ISO date),
  gender: "male"|"female"|"other"|"undisclosed",
  phonePrimary: string,
  phoneEmergency?: string, emergencyContactName?: string,
  addressLine1?: string, addressCity?: string, addressState?: string, addressPostalCode?: string
}
Response: { data: { id, mrn, firstName, lastName, ... } }
Validation: firstName required (max 100), dateOfBirth must be past date, phonePrimary validated format
Errors: 400 VALIDATION_ERROR, 409 DUPLICATE_PATIENT (potential match found)
```

**GET /patients**
```
Query: ?search=<name|mrn|phone>&page=1&pageSize=20
Response: { data: [ { id, mrn, firstName, lastName, dateOfBirth, gender, status } ], meta: { page, pageSize, total } }
Search: Trigram fuzzy match on name; exact match on MRN and phone
```

---

### 2.3 Appointments (`/api/v1/appointments`)

| Method | Path | Purpose | Auth | Permission | Audit Event |
|:---|:---|:---|:---|:---|:---|
| POST | `/appointments` | Book appointment | Required | `appointment:create` | `APPOINTMENT_BOOKED` |
| GET | `/appointments` | List appointments | Required | `appointment:read` | — |
| PATCH | `/appointments/:id/check-in` | Check in patient | Required | `appointment:update` | `APPOINTMENT_CHECKED_IN` |
| PATCH | `/appointments/:id/cancel` | Cancel appointment | Required | `appointment:cancel` | `APPOINTMENT_CANCELLED` |

**POST /appointments**
```
Request: { patientId: UUID, doctorId: UUID, departmentId: UUID, scheduledDate: string (ISO date), scheduledTime: string (HH:mm) }
Response: { data: { id, patientId, doctorId, scheduledDate, scheduledTime, tokenNumber, status } }
Validation: scheduledDate must be today or future; doctor must be in specified department; no double-booking
Errors: 400 VALIDATION_ERROR, 409 SLOT_UNAVAILABLE
```

| Method | Path | Purpose | Auth | Permission | Audit Event |
|:---|:---|:---|:---|:---|:---|
| GET | `/appointments/booking-options` | Read-only department + physician directory for the booking form (ADR-014) | Required | `appointment:create` | — |

```
GET /appointments/booking-options  (ADR-014 — temporary M8 support read)
Response: { data: {
  departments: [ { id, name, code } ],
  physicians: [ { id, firstName, lastName, departmentId } ]
} }
Scope: non-admin callers receive only their own department and its physicians.
Fields are limited to booking needs; no emails, employee IDs, or account fields.
Superseded by §2.10 admin endpoints at M20.
```

---

### 2.4 Encounters (`/api/v1/encounters`)

| Method | Path | Purpose | Auth | Permission | Audit Event |
|:---|:---|:---|:---|:---|:---|
| POST | `/encounters` | Create encounter (from check-in) | Required | `encounter:create` | `ENCOUNTER_CREATED` |
| GET | `/encounters` | List encounters | Required | `encounter:read` | — |
| GET | `/encounters/:id` | Get encounter details | Required | `encounter:read` | — |
| PATCH | `/encounters/:id/activate` | Start consultation | Required | `encounter:update` | `ENCOUNTER_ACTIVATED` |
| PATCH | `/encounters/:id/initiate-discharge` | Begin discharge workflow (**PLANNED — M13, NOT IMPLEMENTED**) | Required | `encounter:discharge` | `ENCOUNTER_DISCHARGE_INITIATED` |
| PATCH | `/encounters/:id/authorize-discharge` | Approve discharge (**PLANNED — M13, NOT IMPLEMENTED**) | Required | `encounter:discharge` | `DISCHARGE_AUTHORIZED` |

**GET /encounters/:id**
```
Response (metadata-only — see ADR-013): { data: {
  id, patientId, doctorId, departmentId, encounterType, status,
  startedAt, dischargedAt, createdAt, version,
  chiefComplaint,   // ONLY present if caller also holds clinical_record:read; otherwise omitted
  patient: { id, mrn, firstName, lastName, dateOfBirth, gender }
} }
Clinical records and diagnostic orders are NEVER embedded.
They are served by their own permission-controlled endpoints (§2.5, §2.6, §2.7):
  GET /encounters/:encounterId/clinical-records   → clinical_record:read
  GET /encounters/:encounterId/diagnostic-orders   → diagnostic_order:read
  GET /diagnostic-orders/:orderId/result           → diagnostic_result:read
```

---

### 2.5 Clinical Records (`/api/v1/encounters/:encounterId/clinical-records`)

| Method | Path | Purpose | Auth | Permission | Audit Event |
|:---|:---|:---|:---|:---|:---|
| POST | `/encounters/:encounterId/clinical-records` | Create clinical record | Required | `clinical_record:write` | `CLINICAL_RECORD_CREATED` |
| GET | `/encounters/:encounterId/clinical-records` | List records for encounter | Required | `clinical_record:read` | `CLINICAL_RECORD_ACCESSED` |
| GET | `/encounters/:encounterId/clinical-records/:id` | Get single record | Required | `clinical_record:read` | `CLINICAL_RECORD_ACCESSED` |
| PATCH | `/encounters/:encounterId/clinical-records/:id` | Update draft record | Required | `clinical_record:write` | `CLINICAL_RECORD_DRAFT_UPDATED` |
| POST | `/encounters/:encounterId/clinical-records/:id/sign` | Sign a draft | Required | `clinical_record:sign` | `CLINICAL_NOTE_SIGNED` |

> [!NOTE]
> Content structure, draft-update auditing, sign-version semantics, amendment
> deferral, and scope refinements are governed by **ADR-015**.

**POST /encounters/:encounterId/clinical-records**
```
Request: {
  recordType: "soap"|"progress_note"|"vital_signs"|"discharge_summary",
  content: { ... },        // JSONB — structure depends on recordType
  vitals?: { ... },        // for vital_signs type
  aiDraftId?: UUID         // if accepting an AI draft
}
Response: { data: { id, encounterId, recordType, content, status: "draft", ... } }
Validation: encounterId must exist and be Active; recordType-specific content validation
```

---

### 2.6 Diagnostic Orders (`/api/v1/encounters/:encounterId/diagnostic-orders`)

| Method | Path | Purpose | Auth | Permission | Audit Event |
|:---|:---|:---|:---|:---|:---|
| POST | `/encounters/:encounterId/diagnostic-orders` | Place lab order | Required | `diagnostic_order:create` | `DIAGNOSTIC_ORDER_CREATED` |
| GET | `/encounters/:encounterId/diagnostic-orders` | List orders for encounter | Required | `diagnostic_order:read` | — |
| GET | `/diagnostic-orders` | Lab queue (dept-scoped; ADR-016) | Required | `diagnostic_order:read` | — |
| PATCH | `/diagnostic-orders/:id/collect-sample` | Mark sample collected | Required | `diagnostic_order:update` | `SAMPLE_COLLECTED` |
| PATCH | `/diagnostic-orders/:id/cancel` | Cancel order | Required | `diagnostic_order:cancel` | `DIAGNOSTIC_ORDER_CANCELLED` |

> [!NOTE]
> Order lifecycle, cancellation scope, collection provenance, lab queue, and
> critical-alert persistence are governed by **ADR-016**. Derived transitions:
> result entry is permitted from `sample_collected`; successful verification
> atomically completes the order. Cancellation = ordering physician, own order,
> pre-collection only.

---

### 2.7 Diagnostic Results (`/api/v1/diagnostic-orders/:orderId/result`)

| Method | Path | Purpose | Auth | Permission | Audit Event |
|:---|:---|:---|:---|:---|:---|
| POST | `/diagnostic-orders/:orderId/result` | Enter lab result | Required | `diagnostic_result:enter` | `LAB_RESULT_ENTERED` |
| GET | `/diagnostic-orders/:orderId/result` | Get result | Required | `diagnostic_result:read` | — |
| POST | `/diagnostic-orders/:orderId/result/verify` | Verify result | Required | `diagnostic_result:verify` | `LAB_RESULT_VERIFIED` |

**POST /diagnostic-orders/:orderId/result**
```
Request: {
  resultValues: { parameterName: string, value: number, unit: string }[],
  notes?: string
}
Response: { data: { id, orderId, resultValues, referenceRange, isAbnormal, isCritical, status } }
Side effects:
  - Deterministic critical value rule evaluation runs automatically
  - If isCritical=true: CRITICAL_VALUE_DETECTED audit event + critical notification dispatched
```

> [!IMPORTANT]
> The `isCritical` flag is computed server-side by the deterministic rule evaluator. It is NOT settable by the API caller.

---

### 2.8 AI Features (`/api/v1/ai`)

> **Ratified by ADR-017/018/019/020 (Phase 5).** Binding refinements: (1) draft **accept is the atomic bind-at-clinical-record-creation act carrying optional `aiDraftId`** — the PATCH endpoint below handles reject/edit-flag lifecycle operations only (ADR-019 supersedes the earlier accept-via-PATCH implication); (2) `/ai/discharge-draft` is DEFERRED to M13; (3) OCR is REJECTED for v1; (4) runtime, authorization and audit rules per ADR-017/018/020.
>
> **IMPLEMENTATION STATUS (M12.1):** only `/ai/note-draft` and `/ai/interactions/:id/action` are mounted. `/ai/chart-search` is a ratified capability whose prompt template and shared contracts ship, but the route/service is NOT implemented yet. The PATCH action emits `AI_DRAFT_REJECTED` or `AI_DRAFT_EDITED` (both transitions are audited atomically — M12.1 P0-4 / ADR-020 §1).

| Method | Path | Purpose | Auth | Permission | Audit Event |
|:---|:---|:---|:---|:---|:---|
| POST | `/ai/note-draft` | Generate clinical note draft | Required | `ai_interaction:invoke` + ADR-018 capability gate | `AI_DRAFT_GENERATED` |
| POST | `/ai/discharge-draft` | Generate discharge summary draft (**DEFERRED — M13**) | Required | `ai_interaction:invoke` | `AI_DRAFT_GENERATED` |
| POST | `/ai/chart-search` | Search patient chart via AI (grounded chart brief; read-only) | Required | `ai_interaction:invoke` + ADR-018 capability gate | `AI_SEARCH_EXECUTED` |
| POST | `/ai/ocr` | Extract text from document image (**REJECTED for v1 — ADR-017**) | Required | `ai_interaction:invoke` | `AI_DRAFT_GENERATED` |
| PATCH | `/ai/interactions/:id/action` | Reject / edit-flag an AI interaction (**never "accept"** — accept is atomic binding per ADR-019) | Required | `ai_interaction:invoke` (initiator only) | `AI_DRAFT_REJECTED` / `AI_DRAFT_EDITED` |

**POST /ai/note-draft**
```
Request: { encounterId: UUID, recordType: "soap"|"progress_note", instructions?: string }
Response: { data: { interactionId: UUID, draft: { content: {...} }, groundingStatus, model, latencyMs } }
The response is always an UNVERIFIED draft. The user must review, optionally edit, and explicitly save/sign.
Errors: 503 AI_SERVICE_UNAVAILABLE (circuit breaker open)
```

---

### 2.9 Tasks & Notifications (`/api/v1/tasks`, `/api/v1/notifications`)

> **IMPLEMENTATION STATUS (M12.1): PLANNED — NOT IMPLEMENTED.** No backend module is mounted; the `tasks` and `notifications` tables exist and `notifications` rows are written by the M10 critical-value outbox, but no read/acknowledge API exists yet.

| Method | Path | Purpose | Auth | Permission |
|:---|:---|:---|:---|:---|
| GET | `/tasks` | List my assigned tasks | Required | `task:read` |
| PATCH | `/tasks/:id/status` | Update task status | Required | `task:update` |
| GET | `/notifications` | List my notifications | Required | Any |
| PATCH | `/notifications/:id/acknowledge` | Acknowledge notification | Required | Any |

---

### 2.10 Administration (`/api/v1/admin`)

> **IMPLEMENTATION STATUS (M12.1):** the staff/department management rows are **PLANNED (M20) — NOT IMPLEMENTED**. The audit query endpoint IS implemented but mounted at **`GET /api/v1/audit`** (not `/admin/audit-events`); permission `audit_event:read` as documented.

| Method | Path | Purpose | Auth | Permission |
|:---|:---|:---|:---|:---|
| GET | `/admin/staff` | List all staff (**PLANNED — NOT IMPLEMENTED**) | Required | `staff:manage` |
| POST | `/admin/staff` | Create staff member (**PLANNED — NOT IMPLEMENTED**) | Required | `staff:manage` |
| PATCH | `/admin/staff/:id` | Update staff (role, dept, status) (**PLANNED — NOT IMPLEMENTED**) | Required | `staff:manage` |
| GET | `/admin/departments` | List departments | Required | `staff:manage` |
| POST | `/admin/departments` | Create department | Required | `staff:manage` |
| GET | `/admin/audit-events` | Query audit log — **IMPLEMENTED AT `GET /api/v1/audit`** (path differs from this catalog; M12.1 correction) | Required | `audit_event:read` |

---

### 2.11 Break-Glass (`/api/v1/break-glass`)

> **IMPLEMENTATION STATUS (M12.1): PLANNED (M15) — NOT IMPLEMENTED.** Permissions `break_glass:activate`/`break_glass:review` exist in the M5 matrix and the probe route only.

| Method | Path | Purpose | Auth | Permission | Audit Event |
|:---|:---|:---|:---|:---|:---|
| POST | `/break-glass` | Activate emergency access (**PLANNED — NOT IMPLEMENTED**) | Required | `break_glass:activate` | `BREAK_GLASS_ACTIVATED` |
| DELETE | `/break-glass/:id` | Deactivate session (**PLANNED — NOT IMPLEMENTED**) | Required | `break_glass:activate` | `BREAK_GLASS_DEACTIVATED` |
| GET | `/break-glass` | List active sessions (admin) (**PLANNED — NOT IMPLEMENTED**) | Required | `break_glass:review` | — |
| PATCH | `/break-glass/:id/review` | Review a session (**PLANNED — NOT IMPLEMENTED**) | Required | `break_glass:review` | `BREAK_GLASS_REVIEWED` |

**POST /break-glass**
```
Request: { patientId: UUID, justification: string (min 10 chars) }
Response: { data: { sessionId: UUID, patientId, grantedScope, activatedAt } }
Side effects: BreakGlassAlert notification sent to all Security Admins
```
