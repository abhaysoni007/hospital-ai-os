# Hospital AI OS

> **A Serious, AI-Native Hospital Operating Platform**

Hospital AI OS is an interconnected hospital operating platform designed to coordinate clinical workflows, administrative operations, diagnostics, and patient care with grounded AI assistance and strict human oversight.

---

## Operating System & Governance

Hospital AI OS is governed by a strict, authoritative `.claude` system:

- **Core Rules:** `.claude/rules/core.md` (Highest authority, deterministic logic, maintainability).
- **Healthcare Rules:** `.claude/rules/healthcare.md` (Patient safety, human-in-the-loop, clinical uncertainty handling).
- **Security Rules:** `.claude/rules/security.md` (Least privilege, RBAC, PHI protection, break-glass policy).
- **AI Rules:** `.claude/rules/ai.md` (Grounding, evidence verification lifecycle, hallucination prevention, fail-safe fallbacks).
- **Product Rules:** `.claude/rules/product.md` (User problems, acceptance criteria, Ponytail scope discipline).

---

## Current Status: Phase 3 Complete (Architecture & Implementation Blueprint)

Phase 3 architecture and implementation blueprint has been completed. The system is ready for Phase 4 implementation.

### Architecture Blueprint

- **System Architecture:** [system-architecture.md](docs/architecture/system-architecture.md) — Modular monolith, module boundaries, failure behavior
- **Domain Model:** [domain-model.md](docs/architecture/domain-model.md) — 14 entities, relationships, lifecycle, sensitivity
- **Database Design:** [database-design.md](docs/architecture/database-design.md) — PostgreSQL, 17 tables, indexes, constraints
- **API Architecture:** [api-architecture.md](docs/architecture/api-architecture.md) — 40+ REST endpoints with contracts
- **AI Architecture:** [ai-architecture.md](docs/architecture/ai-architecture.md) — Provider abstraction, RAG, safety boundaries
- **Security Architecture:** [security-architecture.md](docs/architecture/security-architecture.md) — JWT, RBAC, encryption
- **Frontend Architecture:** [frontend-architecture.md](docs/architecture/frontend-architecture.md) — Next.js, 19 routes, design system
- **Backend Architecture:** [backend-architecture.md](docs/architecture/backend-architecture.md) — Module structure, middleware, jobs
- **Implementation Plan:** [implementation-plan.md](docs/architecture/implementation-plan.md) — 23 milestones with dependency graph
- **Architecture Decision Records:** [adrs/](docs/architecture/adrs/) — 10 ADRs

### Product Specification (Phase 2.1)

- **Product Vision & Specification:** [PRODUCT_SPEC.md](docs/product/PRODUCT_SPEC.md)
- **Phase 2.1 Decision Log:** [PHASE_2_1_DECISIONS.md](docs/product/PHASE_2_1_DECISIONS.md)
- **User Personas & Data Access Matrix:** [PERSONAS.md](docs/product/PERSONAS.md)
- **MVP Workflow Catalog:** [FEATURE_CATALOG.md](docs/product/FEATURE_CATALOG.md)
- **AI Capabilities & Safety Model:** [AI_SYSTEM.md](docs/ai/AI_SYSTEM.md) & [AI_SAFETY.md](docs/ai/AI_SAFETY.md)
- **Data Domain Model:** [DATA_FLOW.md](docs/architecture/DATA_FLOW.md)
- **Project Status & Roadmap:** [PROJECT_STATUS.md](PROJECT_STATUS.md)
