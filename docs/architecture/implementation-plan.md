# Hospital AI OS — Implementation Plan

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** System Architecture, All Phase 2.1 Specifications  
> **Scope:** Dependency graph, milestones, acceptance criteria, implementation order

---

## 1. Implementation Dependency Graph

```text
Level 0 (Foundation):
  [M1] Project Setup → pnpm workspace, TypeScript, ESLint, Prettier, Docker Compose

Level 1 (Infrastructure):
  [M2] Database Schema → PostgreSQL, Drizzle ORM, migrations, seed data
  [M3] Shared Kernel → Types, errors, validation, config, logger

Level 2 (Auth):
  [M4] Authentication → JWT, login, refresh, logout, session management
  [M5] Authorization → RBAC middleware, permission definitions

Level 3 (Core Domain):
  [M6] Patient Module → Registration, search, identity upload
  [M7] Audit Module → Audit events, hash chain, tamper evidence

Level 4 (Workflow Domain):
  [M8] Encounter Module → Appointment, check-in, encounter lifecycle
  [M9] Clinical Module → Clinical records, vitals, note entry/signing
  [M10] Lab Module → Diagnostic orders, results, critical value rules

Level 5 (AI):
  [M11] AI Infrastructure → Provider abstraction, prompt templates, circuit breaker
  [M12] AI Features → Note draft, discharge draft, chart search, OCR

Level 6 (Advanced Workflows):
  [M13] Discharge Module → Discharge workflow with AI integration
  [M14] Task & Notification → Task assignment, notifications, critical alerts
  [M15] Break-Glass → Emergency access, audit, notification

Level 7 (Frontend):
  [M16] Frontend Shell → Auth flow, layout, routing, design system
  [M17] Patient & Appointment UI → Registration, search, appointment booking
  [M18] Clinical Workspace UI → Encounter workspace, note editor, lab views
  [M19] AI Draft UI → AI draft panel, chart search, side-by-side review
  [M20] Admin & Notification UI → Staff management, audit viewer, notifications

Level 8 (Integration & Polish):
  [M21] E2E Testing → Full workflow tests, safety tests, adversarial AI tests
  [M22] Observability → Structured logging, health checks, AI telemetry dashboard
  [M23] Documentation & Deployment → README, deployment guide, final consistency audit
```

---

## 2. Milestone Details

### M1: Project Setup

| Property | Detail |
|:---|:---|
| **Objective** | Initialize monorepo with all tooling |
| **Scope** | pnpm workspace config, TypeScript config, ESLint, Prettier, `docker-compose.dev.yml`, `.env.example` |
| **Files** | `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `apps/backend/`, `apps/frontend/`, `packages/shared/`, `docker-compose.dev.yml` |
| **Dependencies** | None |
| **Acceptance** | `pnpm install` succeeds; `pnpm run build` succeeds (empty apps); Docker Compose starts postgres + redis |
| **Tests** | Build verification only |
| **Risks** | Low |

---

### M2: Database Schema

| Property | Detail |
|:---|:---|
| **Objective** | Create all database tables, enums, indexes |
| **Scope** | Drizzle schema definitions for all 17 tables; migration files; seed script (admin user, departments) |
| **Dependencies** | M1 |
| **Acceptance** | `pnpm run db:migrate` creates all tables; seed script creates admin user + sample departments |
| **Tests** | Migration idempotency test; schema snapshot test |
| **Risks** | Medium — schema errors may cascade |

---

### M3: Shared Kernel

| Property | Detail |
|:---|:---|
| **Objective** | Build reusable types, errors, validation, config, logger |
| **Scope** | `packages/shared/`: TypeScript types for all domain entities, shared Zod schemas, typed error classes, structured logger, env config validator |
| **Dependencies** | M1 |
| **Acceptance** | All types compile; logger outputs structured JSON; config validator rejects invalid env |
| **Tests** | Unit tests for error classes, logger, config validator |
| **Risks** | Low |

---

### M4: Authentication

| Property | Detail |
|:---|:---|
| **Objective** | JWT authentication with login, refresh, logout |
| **Scope** | Auth module: `auth.controller`, `auth.service`, `auth.routes`; JWT signing/verification; refresh token rotation; bcrypt password verification; rate limiting on login |
| **Dependencies** | M2, M3 |
| **Acceptance** | Login returns JWT; refresh rotates token; logout revokes refresh; expired token returns 401 |
| **Tests** | API tests: valid login, invalid credentials, expired token, refresh flow, logout, rate limiting |
| **Risks** | Medium — security-critical |

---

### M5: Authorization (RBAC)

| Property | Detail |
|:---|:---|
| **Objective** | Role-based permission enforcement middleware |
| **Scope** | RBAC middleware; permission definitions; role-permission mapping; resource scope checks |
| **Dependencies** | M4 |
| **Acceptance** | Each role can only access permitted endpoints; unpermitted access returns 403; break-glass TBD (M15) |
| **Tests** | API tests: every role tested against every protected endpoint |
| **Risks** | Medium — authorization errors are security vulnerabilities |

---

### M6: Patient Module

| Property | Detail |
|:---|:---|
| **Objective** | Patient registration, search, identity management |
| **Scope** | Patient CRUD; MRN generation; duplicate detection (trigram search); identity document upload + verification |
| **Dependencies** | M4, M5, M7 |
| **Acceptance** | Register patient → assigned MRN; search by name/MRN/phone; upload + verify identity; duplicate warning |
| **Tests** | API tests + unit tests for MRN generation, search, duplicate detection |
| **Risks** | Medium — patient identity is foundational |

---

### M7: Audit Module

| Property | Detail |
|:---|:---|
| **Objective** | Immutable audit event recording with hash chain |
| **Scope** | Audit service; hash chain computation; append-only enforcement; audit query API |
| **Dependencies** | M2, M3 |
| **Acceptance** | Audit events created with correct hash chain; UPDATE/DELETE on audit table fails; query with filtering works |
| **Tests** | Unit test: hash chain integrity; integration test: tamper detection; API test: unauthorized access denied |
| **Risks** | High — audit failure blocks operations (fail-safe) |

---

### M8: Encounter Module

| Property | Detail |
|:---|:---|
| **Objective** | Appointment booking, check-in, encounter lifecycle |
| **Scope** | Appointment CRUD; token number generation; check-in (creates encounter); encounter state machine |
| **Dependencies** | M6 |
| **Acceptance** | Book appointment → check in → encounter created; state transitions enforced; invalid transitions rejected |
| **Tests** | State machine unit tests; API tests for all transitions |
| **Risks** | Medium |

---

### M9: Clinical Module

| Property | Detail |
|:---|:---|
| **Objective** | Clinical record creation, vitals, note signing |
| **Scope** | SOAP notes, progress notes, vitals entry; draft → sign lifecycle; optimistic concurrency; version history |
| **Dependencies** | M8 |
| **Acceptance** | Create draft → edit → sign; signed records immutable; concurrent edits detected; audit events emitted |
| **Tests** | API tests; concurrency tests; immutability tests |
| **Risks** | High — clinical data integrity |

---

### M10: Lab Module

| Property | Detail |
|:---|:---|
| **Objective** | Diagnostic orders, results, critical value detection |
| **Scope** | Order creation; sample collection; result entry; **deterministic critical value rule evaluator**; reference range display; result verification |
| **Dependencies** | M8, M14 (partial — notification dispatch) |
| **Acceptance** | Order → collect → enter result → is_critical computed by rule evaluator (NOT AI); critical → notification dispatched; verified by pathologist |
| **Tests** | **Critical**: boundary value tests for rule evaluator (exactly at threshold, above, below, edge cases); integration test confirming AI not invoked for classification |
| **Risks** | **High** — patient safety; rule evaluator is safety-critical |

---

### M11: AI Infrastructure

> **Ratified by ADR-017/018/020 (Phase 5).** Scope refinements: synchronous-only execution (no BullMQ/Redis consumers — ADR-017 deferral ledger); embedding-generation job deferred with the RAG pipeline; pre-flight encryption-readiness gate; global DB-backed daily token budget.

| Property | Detail |
|:---|:---|
| **Objective** | Provider abstraction, prompt templates, circuit breaker, resilience envelope, AI contracts & audit wiring |
| **Scope** | AI adapter interface + Gemini adapter (exact-pinned SDK, import-bounded) + FakeProvider fixtures; prompt builder per PROMPT_ARCHITECTURE.md; context assembler (authorized readers + allowlist projections); structured output validation incl. grounding/gap fidelity; circuit breaker, semaphore, rate limit, token budget; shared Zod AI schemas; AI routes + RBAC matrix extension; AI audit events |
| **Dependencies** | M3, M7 |
| **Acceptance** | Adapter generates validated structured output from fixtures; malformed responses rejected by Zod + grounding checks; breaker opens after threshold and recovers via half-open probe; no DB transaction spans provider latency; app boots with AI disabled when unconfigured; zero migrations |
| **Tests** | FakeProvider fixture suites; breaker tests; output validation tests; context authorization fixtures incl. mixed-department; PHI identifier battery |
| **Risks** | High — AI reliability |

---

### M12: AI Features

> **Ratified by ADR-018/019 (Phase 5).** Scope refinements: hero = encounter note draft with atomic `aiDraftId` binding into the frozen M9 lifecycle; supporting = grounded chart brief; OCR rejected; discharge draft belongs to M13.

| Property | Detail |
|:---|:---|
| **Objective** | Clinical note draft (hero), grounded chart brief, accept/reject lifecycle |
| **Scope** | Capability services atop M11 (capability gates per ADR-018 §3); deterministic information-gap detection; citation manifest validation; atomic draft binding under ADR-019 invariants B1–B10; PATCH reject/edit actions; frontend editor-integrated drafting panel + encounter chart-brief panel |
| **Dependencies** | M11, M9, M6, M8 |
| **Acceptance** | Each capability produces source-grounded drafts with manifest-valid citations and gap fidelity; binding satisfies B1–B10 (race-proof); AI interaction logged with full provenance; user accepts = atomic bind, or rejects with reason; M9 suite byte-green unchanged |
| **Tests** | Adversarial prompt-injection battery; lifecycle rejection matrix; concurrency double-bind tests; grounding/gap-fidelity tests; mixed-dept authorization fixtures |
| **Risks** | High — AI quality and safety |

---

### M13: Discharge Module

| Property | Detail |
|:---|:---|
| **Objective** | Discharge workflow with optional AI draft |
| **Scope** | Discharge initiation; AI summary draft (optional); physician review + sign; encounter status transition |
| **Dependencies** | M9, M10, M12 |
| **Acceptance** | Initiate discharge → (optionally generate AI draft) → physician signs → encounter discharged → audit event |
| **Tests** | E2E workflow test; test with and without AI draft |
| **Risks** | Medium |

---

### M14: Task & Notification Module

| Property | Detail |
|:---|:---|
| **Objective** | Task assignment, notification dispatch, critical alerts |
| **Scope** | Task CRUD; notification creation + dispatch; in-app notification delivery; critical alert for lab values |
| **Dependencies** | M3, M4 |
| **Acceptance** | Tasks assigned and tracked; notifications delivered; critical alerts dispatched immediately |
| **Tests** | API tests; notification delivery tests |
| **Risks** | Medium — critical alerts are safety-relevant |

---

### M15: Break-Glass

| Property | Detail |
|:---|:---|
| **Objective** | Emergency access with justification and audit |
| **Scope** | Break-glass activation; scope grants; Security Admin notification; review workflow; deactivation |
| **Dependencies** | M5, M7, M14 |
| **Acceptance** | Activate → justification stored → access granted → audit events → Security Admin notified → review |
| **Tests** | API tests; authorization tests (verify scope expansion works); audit verification |
| **Risks** | High — security critical |

---

### M16–M20: Frontend Milestones

| Milestone | Scope | Dependencies |
|:---|:---|:---|
| **M16: Frontend Shell** | Auth flow, layout, sidebar, routing, design system components | M4, M5 |
| **M17: Patient & Appointment UI** | Registration form, search, appointment booking, check-in | M6, M8 |
| **M18: Clinical Workspace UI** | Encounter workspace, note editor, vitals entry, lab views | M9, M10 |
| **M19: AI Draft UI** | AI draft panel, chart search, side-by-side review, accept/reject | M12 |
| **M20: Admin & Notification UI** | Staff management, department config, audit log viewer, notifications | M14, M15 |

---

### M21–M23: Integration & Polish

| Milestone | Scope | Dependencies |
|:---|:---|:---|
| **M21: E2E Testing** | Playwright tests for all 5 critical workflows + safety tests + adversarial AI tests | M16–M20 |
| **M22: Observability** | Structured log setup, health check endpoint, AI telemetry queries, alerts | M11, M14 |
| **M23: Documentation & Deployment** | README update, deployment guide, consistency audit, production Docker Compose | All |

---

## 3. Parallelizable Work

| Parallel Track A | Parallel Track B |
|:---|:---|
| M2 (Database) | M3 (Shared Kernel) |
| M4 + M5 (Auth) | M7 (Audit) |
| M6 (Patient) | M14 (Task & Notification) |
| M8, M9, M10 (Encounter/Clinical/Lab) | M11 (AI Infrastructure) |
| M16 (Frontend Shell) | M12 (AI Features) |

---

## 4. High-Risk Components

| Component | Risk | Mitigation |
|:---|:---|:---|
| **Critical value rule evaluator** | Patient safety — incorrect thresholds or evaluation logic | Extensive boundary testing; clinical review of test cases |
| **Audit hash chain** | Tamper evidence — broken chain invalidates audit integrity | Integration tests verify chain integrity; chain repair procedure documented |
| **AI structured output parsing** | AI may return unexpected formats | Strict Zod validation; fallback to raw text on parse failure |
| **RBAC enforcement** | Authorization errors = security vulnerabilities | Matrix tests for every role × endpoint combination |
| **JWT token handling** | Token theft, replay, forgery | RS256 asymmetric signing; short expiry; refresh rotation |
