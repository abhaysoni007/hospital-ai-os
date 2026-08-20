# Phase 3 Architecture Inputs Register

> **Status:** LOCKED — Phase 2.1 Specification  
> **Purpose:** Document technical questions, implementation choices, and architectural constraints deferred to Phase 3 System Architecture.

---

## Technical Architecture Decision Register

The following decisions were intentionally deferred from Phase 2 Product Specification to Phase 3 Technical Architecture:

### 1. Application & Container Topology
- Service decomposition model (Monolith vs Modular Monolith vs Microservices).
- Container orchestration & deployment topology.
- Frontend application shell & workspace state management pattern.

### 2. API Design & Data Persistence Strategy
- API paradigm selection (REST vs GraphQL vs gRPC) and status code conventions.
- Database engine selection (Relational vs Document vs Hybrid) and schema definitions for the 13 conceptual data domains defined in `docs/architecture/DATA_FLOW.md`.
- Data migration, indexing, and transactional isolation strategies.

### 3. Encryption & Cryptographic Implementation
- Specific cryptographic algorithms for PHI data encryption at rest (e.g. AES-256 vs alternatives).
- Specific TLS protocol versions and cipher suites for data in transit.
- Encryption key management, rotation, and secret vault service selection.

### 4. Identity, Authentication & Authorization Architecture
- Authentication protocol implementation (OAuth2 / OIDC / JWT vs Session Token).
- Authorization middleware architecture and API-layer permission enforcement engine.
- Break-glass technical execution model and automated timer revocation service.

### 5. AI Orchestration & Provenance Architecture
- AI provider abstraction layer interfaces and model switching adapter design.
- Retrieval-Augmented Generation (RAG) vector database selection and context assembly pipeline.
- Provenance tracking architecture (claim-level vs evidence-group metadata binding).
- Model fallback, circuit breaker, and timeout mechanics (specific retry counts & backoff intervals).

### 6. Audit & Observability Infrastructure
- Immutability implementation pattern (Write-Once storage, tamper-evident hash chaining).
- Structured log aggregation, correlation ID propagation, and telemetry pipelines.
- AI request logging, token usage tracking, and latency monitoring infrastructure.

### 7. Performance & Degradation Strategy
- Caching architecture, invalidation strategies, and target latency validation (< 300ms UI, < 1500ms Search).
- Degraded mode circuit breaker configuration, health-check polling frequency, and offline queue synchronization mechanics.
