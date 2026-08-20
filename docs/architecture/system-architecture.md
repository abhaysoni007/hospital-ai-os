# Hospital AI OS — System Architecture

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** Engineering & Product Rules  
> **Scope:** System context, container topology, module boundaries, application boundaries, failure behavior

---

## 1. System Context

Hospital AI OS is a single-facility hospital operating platform. At the system boundary level, it interacts with the following external actors and systems:

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL ACTORS                              │
│                                                                     │
│  Clinicians  Nurses  Receptionists  Lab Staff  Admins  Auditors     │
│       │         │         │            │          │        │         │
│       └─────────┴─────────┴────────────┴──────────┴────────┘         │
│                            │                                        │
│                    ┌───────▼────────┐                                │
│                    │  Web Browser   │                                │
│                    │  (HTTPS)       │                                │
│                    └───────┬────────┘                                │
└────────────────────────────┼────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                     HOSPITAL AI OS                                  │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │   Frontend    │    │   Backend    │    │   Background Workers │   │
│  │  (Next.js)    │◄──►│  (Express)   │◄──►│   (BullMQ)          │   │
│  └──────────────┘    └──────┬───────┘    └──────────┬───────────┘   │
│                             │                       │               │
│                    ┌────────▼───────────────────────▼────────┐      │
│                    │          Data Layer                      │      │
│                    │  PostgreSQL  │  Redis  │  File Storage   │      │
│                    └─────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐                               │
│  │  AI Provider  │    │  Email/SMS   │                               │
│  │  (LLM API)    │    │  (Future)    │                               │
│  └──────────────┘    └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.1 External Actor Boundary

All human actors interact via a web browser over HTTPS. There is no native mobile app, no ambient hardware, and no direct database access for any human actor.

### 1.2 External Service Boundary

| External Service          | Purpose                                                          | MVP Status | Failure Behavior                                                       |
| :------------------------ | :--------------------------------------------------------------- | :--------- | :--------------------------------------------------------------------- |
| **AI Provider (LLM API)** | Clinical note drafting, chart search, discharge summary drafting | MVP CORE   | Graceful degradation — AI features disabled, manual workflows continue |
| **Email/SMS Gateway**     | Notification delivery                                            | DEFERRED   | Not required for MVP; in-app notifications only                        |
| **ABDM/FHIR**             | National health data exchange (India)                            | DEFERRED   | Not required for MVP                                                   |

---

## 2. Architecture Style — Modular Monolith

See **ADR-001** for full decision record.

Hospital AI OS is structured as a **modular monolith**: a single deployable application composed of domain modules with explicit, enforced boundaries.

```text
┌────────────────────────────────────────────────────────────────────┐
│                     APPLICATION PROCESS                            │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Patient   │ │Encounter │ │ Clinical │ │   Lab    │ │Discharge│ │
│  │ Module    │ │ Module   │ │ Module   │ │ Module   │ │ Module  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │             │            │             │            │      │
│  ┌────┴─────┐ ┌─────┴────┐ ┌────┴─────┐ ┌────┴─────┐            │
│  │   AI     │ │  Auth    │ │  Audit   │ │  Task &  │            │
│  │ Module   │ │ Module   │ │ Module   │ │  Notify  │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Shared Kernel                             │  │
│  │  Types │ Validation │ Error Handling │ Logging │ Config      │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 2.1 Why Modular Monolith

| Criterion             | Modular Monolith                        | Microservices                                  |
| :-------------------- | :-------------------------------------- | :--------------------------------------------- |
| Deployment complexity | Single artifact                         | Multiple services, networking, orchestration   |
| Data consistency      | Single database, ACID transactions      | Distributed transactions, eventual consistency |
| Team size fit         | Small team / single agent               | Multiple independent teams                     |
| Debugging             | Single process, stack traces            | Distributed tracing required                   |
| Decomposition path    | Can extract modules into services later | Already decomposed                             |
| **Verdict for MVP**   | **Appropriate**                         | Over-engineered                                |

### 2.2 Module Boundary Rules

1. Modules communicate through **explicit public interfaces** (exported service classes), never by direct database table access across module boundaries.
2. Each module owns its database tables. No module may read or write another module's tables directly.
3. Cross-module data access goes through the owning module's service interface.
4. Circular dependencies between modules are prohibited.
5. The **Shared Kernel** contains only types, utilities, and infrastructure code that is genuinely shared. It must not contain business logic.

---

## 3. Domain Module Catalog & Data Ownership

| Module        | Responsibility                                     | Owns Database Tables                                              | Dependencies                                    |
| :------------ | :------------------------------------------------- | :---------------------------------------------------------------- | :---------------------------------------------- |
| **Patient**   | Registration, identity verification, EMPI          | `patients`, `identities`                                          | Auth, Audit                                     |
| **Encounter** | Scheduling, check-in, encounter lifecycle          | `appointments`, `encounters`                                      | Patient, Auth, Audit                            |
| **Clinical**  | Progress notes, vitals, record management          | `clinical_records`                                                | Patient, Encounter, Auth, Audit, AI             |
| **Lab**       | Lab orders, specimen tracking, result verification | `diagnostic_orders`, `diagnostic_results`, `critical_value_rules` | Patient, Encounter, Clinical, Auth, Audit, Task |
| **Discharge** | Discharge summary drafting, workflow               | (None — aggregates data)                                          | Encounter, Clinical, Lab, Auth, Audit, AI       |
| **AI**        | Provider abstraction, RAG pipeline, grounding      | `ai_interactions`, `embeddings`                                   | Patient, Encounter, Auth, Audit                 |
| **Auth**      | Authentication, RBAC, session management           | `staff`, `departments`, `refresh_tokens`, `break_glass_sessions`  | Audit                                           |
| **Audit**     | Immutable event recording, hash chain              | `audit_events`                                                    | (none — leaf dependency)                        |
| **Task**      | Task assignment, urgent notifications              | `tasks`, `notifications`                                          | Auth, Audit                                     |

### 3.1 Module Dependency Graph

```text
                    ┌───────┐
                    │ Audit │  ← Leaf module (no dependencies)
                    └───┬───┘
                        │
                    ┌───▼───┐
                    │ Auth  │
                    └───┬───┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
     ┌────▼───┐   ┌────▼───┐   ┌─────▼────┐
     │Patient │   │  Task  │   │    AI    │
     └────┬───┘   └────────┘   └─────┬────┘
          │                          │
          │                          │
     ┌────▼─────┐                    │
     │Encounter │◄───────────────────┘
     └────┬─────┘
          │
     ┌────▼─────┐
     │Clinical  │◄───────────────────┐
     └────┬─────┘                    │
          │                          │
     ┌────▼───┐                      │
     │  Lab   │                      │
     └────┬───┘                      │
          │                          │
     ┌────▼──────┐                   │
     │ Discharge │───────────────────┘
     └───────────┘
```

---

## 4. Application Boundaries

### 4.1 Frontend Boundary

- **Responsibility:** Rendering UI, form handling, client-side validation, state management, routing, accessibility.
- **Must NOT contain:** Business logic, authorization enforcement, data transformation rules, direct database access, AI prompt construction.
- **Security boundary:** The frontend is an untrusted client. All data it sends must be re-validated by the backend. UI element visibility is a UX convenience, not a security control.

### 4.2 Backend Boundary

- **Responsibility:** Business logic, authorization enforcement, data validation, database operations, AI orchestration, audit event emission, background job dispatch.
- **Must NOT contain:** UI rendering, CSS, client-side state, browser APIs.
- **Security boundary:** The backend is the trust boundary. All authorization is enforced here. All data is validated here. All audit events originate here.

### 4.3 AI Boundary

- **Responsibility:** LLM API communication, prompt construction, context assembly, structured output parsing, evidence grounding validation.
- **Must NOT contain:** Clinical decision-making, autonomous state changes, authorization logic, direct database writes.
- **Security boundary:** AI is a tool, not an actor. It cannot authenticate, authorize, or commit state changes. All AI outputs are treated as UNVERIFIED until processed through the evidence verification lifecycle.

### 4.4 Data Boundary

- **Responsibility:** Persistent storage of all domain data, transactional integrity, referential integrity, encryption at rest.
- **Must NOT contain:** Business logic (stored procedures for business rules are prohibited; database constraints for data integrity are required).
- **Security boundary:** Database credentials are service-level secrets. No human actor has direct database access. All data access goes through the backend API with authorization checks.

### 4.5 Integration Boundary

- **Responsibility:** Communication with external services (AI providers, future email/SMS, future ABDM/FHIR).
- **Must NOT contain:** Business logic. Integrations are adapters — they translate between external protocols and internal domain interfaces.
- **Security boundary:** All external calls use TLS. API keys are managed via secrets. External data is validated at the integration boundary before entering the domain.

---

## 5. Request Flow Architecture

### 5.1 Standard Request Flow

```text
Browser → Next.js (SSR/CSR) → Express API → Auth Middleware → RBAC Middleware
  → Domain Service → Repository → PostgreSQL
  → Audit Service → Audit Table
  → Response → Browser
```

### 5.2 AI-Assisted Request Flow

```text
Browser → Express API → Auth + RBAC → Clinical Service
  → AI Orchestration Service
    → Context Assembly (Patient data, encounter data, clinical records)
    → Prompt Construction (system + context + user instruction)
    → LLM Provider Adapter → External AI API
    → Structured Output Parser
    → Evidence Grounding Validator
  → UNVERIFIED AI Draft returned to Clinical Service
  → Response (draft presented for human review) → Browser
  → [Human reviews, edits, signs] → Express API → Clinical Service
    → Commit signed record → PostgreSQL
    → Audit Event → Audit Table
```

### 5.3 Critical Lab Value Flow

```text
Lab Tech enters result → Express API → Lab Service
  → Deterministic Rule Evaluator (configured thresholds from DB)
  → If CRITICAL: Flag result + Dispatch urgent notification via Task Module
  → Result saved → PostgreSQL
  → Pathologist review queue updated
  → Audit Event recorded
```

---

## 6. Failure Behavior by Component

| Component              | Common Failure                  | System Behavior                                                                                                                                         | User-Visible Effect                                                            |
| :--------------------- | :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------- |
| **AI Provider**        | API timeout, rate limit, outage | Circuit breaker opens; AI features disabled                                                                                                             | "AI assistance temporarily unavailable" banner; manual workflows remain active |
| **PostgreSQL**         | Connection failure              | Application enters safe shutdown; no data written                                                                                                       | "System maintenance" page; all operations halted                               |
| **Redis**              | Connection failure              | Critical jobs (e.g., notifications) are saved synchronously via Transactional Outbox in PostgreSQL; Redis failure only delays dispatch. Zero data loss. | Notification delivery delayed; slight latency increase                         |
| **Frontend (Next.js)** | Build error, JS crash           | Error boundary catches; fallback UI rendered                                                                                                            | Error message with retry option; no data loss                                  |
| **Background Worker**  | Job failure                     | Dead-letter queue; automatic retry with backoff                                                                                                         | Notification delayed; audit record marks retry                                 |
| **Audit Service**      | Write failure                   | **CRITICAL** — application blocks the originating request (fail-safe)                                                                                   | User sees error; operation is not committed without audit                      |

---

## 7. Cross-Cutting Concerns

| Concern                | Implementation Strategy                                                                                        |
| :--------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Authentication**     | JWT access tokens (short-lived) + refresh tokens (httpOnly cookie). Verified by middleware on every request.   |
| **Authorization**      | RBAC middleware checks role + scope + permission before handler executes. Enforced at API layer.               |
| **Audit Logging**      | Dedicated Audit module. Every state-changing operation emits an audit event. Hash-chained for tamper evidence. |
| **Structured Logging** | JSON logs with correlation ID, timestamp, service, level, user context (no PHI).                               |
| **Error Handling**     | Typed error classes. Global error handler in Express. Safe error responses to client (no stack traces).        |
| **Validation**         | Zod schemas at API boundary. Database constraints as safety net.                                               |
| **Correlation ID**     | Generated at API gateway, propagated through all service calls and log entries.                                |
| **PHI Protection**     | PHI never in logs, error messages, URLs, or client-side unencrypted storage.                                   |
