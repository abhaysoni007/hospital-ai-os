# MEDORA

> **The intelligent operating system for modern healthcare.**

**MEDORA (Hospital AI OS)** is a full-stack, AI-native hospital operating platform designed to connect clinical workflows, diagnostics, operations, and patient care through governed intelligence, strong authorization boundaries, auditability, and human oversight.

[![CI](https://github.com/abhaysoni007/hospital-ai-os/actions/workflows/ci.yml/badge.svg)](https://github.com/abhaysoni007/hospital-ai-os/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-not%20yet%20specified-lightgrey)

> **Buildathon note:** This repository is intentionally documentation-first and verification-driven. The architecture, security model, AI safety model, implementation milestones, and verification evidence are maintained alongside the product code.

---

## Why MEDORA

Hospitals are not a single workflow. They are a network of people, decisions, records, diagnostics, operational events, and safety constraints.

MEDORA treats the hospital as an **operating system** rather than a collection of disconnected screens.

The platform is designed around four principles:

- **One connected system** — clinical, diagnostic, operational, and patient workflows share a coherent platform.
- **Governed intelligence** — AI is bounded by authorization, grounding, provenance, verification, and human review.
- **Security by architecture** — least privilege, PHI boundaries, encrypted sensitive data, and tamper-evident auditability are first-class concerns.
- **Evidence over claims** — behavior is validated with deterministic tests and explicit verification gates rather than marketing metrics.

---

## Current Status

### Phase 6 — M13 UI/UX Product Transformation: **COMPLETE**

The repository currently represents a verified vertical-slice hospital platform with the major implemented workflow layers through M13.

| Area | Status |
| --- | --- |
| Engineering foundation | ✅ Complete |
| PostgreSQL + Drizzle data layer | ✅ Complete |
| Shared backend kernel | ✅ Complete |
| JWT authentication | ✅ Complete |
| RBAC / permission enforcement | ✅ Complete |
| Tamper-evident audit module | ✅ Complete |
| Patient workflows | ✅ Complete |
| Appointment / encounter workflows | ✅ Complete |
| Clinical records + signing lifecycle | ✅ Complete |
| Diagnostics + critical-result workflow | ✅ Complete |
| Governed AI infrastructure | ✅ Verified |
| Clinical AI drafting workflow | ✅ Verified |
| Product integrity / live data loop | ✅ Complete |
| UI/UX product transformation | ✅ Complete |
| CI / build / lint / typecheck / test gates | ✅ Active |

The detailed milestone evidence is maintained in `docs/implementation/` and the project status ledger in `PROJECT_STATUS.md`.

---

## Product Surface

MEDORA currently focuses on a tightly governed hospital vertical slice rather than attempting to simulate every hospital subsystem.

### Core workflows

- Authentication and session lifecycle
- Role- and permission-aware navigation
- Patient registration, search, and profile workflows
- Appointment booking, token allocation, cancellation, and check-in
- Encounter lifecycle and department-scoped access
- Clinical notes, vitals, signing, and signed immutability
- Diagnostic ordering, collection provenance, result entry, review, and critical-value handling
- Notification and critical-result acknowledgement workflow
- Live dashboard operational signals
- Governed AI-assisted SOAP / progress-note drafting
- AI citation and "not documented" gap presentation
- AI provenance and audit lifecycle

### Explicitly governed AI behavior

MEDORA does **not** treat an LLM response as an autonomous clinical decision.

The implemented AI layer includes architectural controls around:

- provider abstraction
- deterministic fake-provider testing
- versioned prompts and canonicalization
- authorized context projections
- PHI minimization
- structured parsing and schema validation
- citation-manifest validation
- deterministic gap detection
- rate limiting and token budgets
- circuit breaking / concurrency controls
- encrypted raw AI response storage
- provenance binding
- audit events
- fail-safe behavior during AI outages

See `docs/ai/` and the AI architecture/ADR set for the authoritative design.

---

## Architecture at a Glance

```text
                         ┌───────────────────────┐
                         │       MEDORA UI       │
                         │       Next.js         │
                         └───────────┬───────────┘
                                     │ HTTPS
                                     ▼
                         ┌───────────────────────┐
                         │     Express API       │
                         │ Auth • RBAC • Audit   │
                         │ Validation • Errors   │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌───────────┐    ┌────────────┐
              │ Clinical │    │Diagnostics│    │  Patient   │
              │  Module  │    │  Module   │    │  Module    │
              └────┬─────┘    └─────┬─────┘    └─────┬──────┘
                   │                │                 │
                   └────────────────┼─────────────────┘
                                    ▼
                         ┌───────────────────────┐
                         │ Shared Kernel + DB    │
                         │ PostgreSQL / Drizzle  │
                         └───────────┬───────────┘
                                     │
                     ┌───────────────┴──────────────┐
                     ▼                              ▼
              ┌─────────────┐               ┌──────────────┐
              │ Audit /     │               │ AI Runtime   │
              │ Provenance  │               │ + Safety     │
              └─────────────┘               └──────────────┘
```

The architecture is a **modular monolith** with explicit module boundaries and a dependency direction in which business modules consume shared infrastructure rather than the reverse.

The original architecture blueprint documents the system context, module boundaries, failure behavior, and infrastructure topology in detail.

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14, React 18, TypeScript |
| Backend | Node.js 20+, Express, TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| Validation | Zod |
| Authentication | JWT + refresh-token lifecycle |
| Authorization | RBAC / permission model |
| Caching / limits | Redis / ioredis |
| AI | Provider abstraction with Gemini adapter |
| Logging | Pino / structured logging |
| Testing | Vitest, Supertest, Playwright |
| CI | GitHub Actions |
| Package management | pnpm workspaces |
| Infrastructure | Docker / Docker Compose |

The workspace is organized around `apps/*` and `packages/*`, keeping application boundaries explicit.

---

## Repository Structure

```text
.
├── apps/
│   ├── frontend/          # Next.js application
│   └── backend/           # Express API + domain modules
├── packages/              # Shared workspace packages
├── docs/
│   ├── architecture/     # Architecture, ADRs, implementation plan
│   ├── ai/                # AI architecture, safety, evaluation
│   ├── design/            # Design system + UX architecture
│   ├── implementation/   # Milestone reports and verification evidence
│   ├── product/           # Product requirements and decisions
│   └── security/          # Security and authorization documentation
├── project-management/    # Roadmap, milestones, backlog, risk register
├── .claude/               # Engineering / healthcare / security / AI rules
├── .github/               # CI and repository contribution configuration
├── PROJECT_STATUS.md      # Current implementation ledger
└── package.json           # Workspace scripts
```

---

## Architecture & Engineering Documentation

Start here if you want to understand how the system was designed before reading implementation code.

### Architecture

- [`system-architecture.md`](docs/architecture/system-architecture.md) — system context, modular-monolith topology, boundaries, failure behavior
- [`domain-model.md`](docs/architecture/domain-model.md) — domain entities, relationships, lifecycle, sensitivity
- [`database-design.md`](docs/architecture/database-design.md) — PostgreSQL schema, indexes, constraints, encryption, retention
- [`api-architecture.md`](docs/architecture/api-architecture.md) — API contracts, authorization, validation, endpoint catalog
- [`backend-architecture.md`](docs/architecture/backend-architecture.md) — backend layers, modules, middleware, jobs
- [`frontend-architecture.md`](docs/architecture/frontend-architecture.md) — frontend routing, state, and design system
- [`security-architecture.md`](docs/architecture/security-architecture.md) — authentication, authorization, encryption, secrets, threat model
- [`ai-architecture.md`](docs/architecture/ai-architecture.md) — provider abstraction, context boundaries, AI safety
- [`observability.md`](docs/architecture/observability.md) — structured logging and AI telemetry
- [`implementation-plan.md`](docs/architecture/implementation-plan.md) — milestone dependency graph and acceptance criteria
- [`adrs/`](docs/architecture/adrs/) — architecture decision records

### Product & safety

- [`PRODUCT_SPEC.md`](docs/product/PRODUCT_SPEC.md) — product vision and vertical-slice scope
- [`PERSONAS.md`](docs/product/PERSONAS.md) — roles and data-access model
- [`FEATURE_CATALOG.md`](docs/product/FEATURE_CATALOG.md) — workflow specifications
- [`AI_SYSTEM.md`](docs/ai/AI_SYSTEM.md) — AI capability model
- [`AI_SAFETY.md`](docs/ai/AI_SAFETY.md) — safety boundaries and fail-safe principles
- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — implementation status and verification history

---

## Verification Philosophy

MEDORA uses a verification-driven development approach.

A feature is not considered complete because its files exist. Completion is tied to executable checks, targeted regression coverage, and milestone evidence.

The CI pipeline currently verifies the monorepo with:

```bash
pnpm install --frozen-lockfile
pnpm --filter shared run build
pnpm run lint
pnpm -r exec tsc --noEmit
pnpm -r run test
pnpm run build
```

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for the canonical CI workflow.

Milestone reports under `docs/implementation/` record the relevant test counts, live API gates, architectural decisions, and known issues for completed milestones.

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL
- Redis where required by the configured services

### Install

```bash
pnpm install --frozen-lockfile
```

### Start development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Quality checks

```bash
pnpm lint
pnpm -r exec tsc --noEmit
pnpm -r run test
```

### Demo data

```bash
pnpm seed:demo
```

Reset demo data when required:

```bash
pnpm seed:demo:reset
```

Use environment files only for local configuration. Never commit secrets or real patient data.

---

## Security & Healthcare Data

This is healthcare software. The repository treats sensitive data handling as a product and architecture concern.

Development and test data must be synthetic.

Never commit:

- patient / PHI data
- passwords
- API keys
- access or refresh tokens
- production database dumps
- private certificates or signing keys

Security architecture, authorization rules, audit requirements, and AI safety constraints are documented separately so that implementation decisions remain traceable.

See [`SECURITY.md`](SECURITY.md) and [`docs/security/`](docs/security/).

---

## Repository Governance

The repository includes lightweight engineering governance suitable for collaborative development:

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development and PR expectations
- [`SECURITY.md`](SECURITY.md) — responsible security reporting and sensitive-data rules
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — collaboration standards
- [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) — PR quality checklist
- [`.github/CODEOWNERS`](.github/CODEOWNERS) — default ownership
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — automated verification

---

## Project Governance

MEDORA follows a layered specification and implementation model:

```text
Product requirements
        ↓
Architecture + ADRs
        ↓
Implementation milestones
        ↓
Automated verification
        ↓
Milestone evidence
        ↓
Product iteration
```

The `.claude/` directory contains the project's engineering, healthcare, security, AI, and product rules. These are part of the repository's development governance and should be read before making architectural changes.

---

## Roadmap

The implementation plan is organized as dependency-aware milestones rather than a feature checklist. Completed work is frozen only after its verification gate passes.

The current product status and next milestone are maintained in [`PROJECT_STATUS.md`](PROJECT_STATUS.md) and [`docs/architecture/implementation-plan.md`](docs/architecture/implementation-plan.md).

Future work should preserve the existing security, audit, PHI-boundary, AI-governance, and module-boundary contracts.

---

## Project Status vs. Brand

**MEDORA** is the product-facing name.

**Hospital AI OS** remains the repository / technical project identity and architectural name where applicable.

This distinction keeps the product experience brandable without obscuring the engineering scope of the project.

---

## Disclaimer

MEDORA is a software engineering project and buildathon prototype. It is not presented as a substitute for professional medical judgment, clinical governance, or regulatory review. Any clinical use requires appropriate validation, governance, security review, and regulatory assessment.

---

## License

No open-source license has been declared yet. Until a license is added to this repository, default copyright restrictions apply and reuse should not be assumed.
