# ADR-002: PostgreSQL as Primary Database

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3

## Context

Hospital AI OS manages clinical records, patient identities, lab results, audit events, and AI interactions — all requiring strong data integrity, referential constraints, and ACID transactions. The audit system requires tamper evidence via hash chaining. AI chart search requires vector similarity queries.

## Decision

**PostgreSQL 16** as the single primary database, with `pgvector` for vector search, `pgcrypto` for field-level encryption, and `pg_trgm` for fuzzy text search.

## Alternatives Considered

| Alternative                                            | Pros                                  | Cons                                                                                                    | Reason Rejected                                 |
| :----------------------------------------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------ | :---------------------------------------------- |
| **MongoDB**                                            | Flexible schema; JSONB-like documents | Weaker ACID guarantees; no native referential integrity; vector search requires Atlas-specific features | Clinical data needs relational integrity        |
| **PostgreSQL + dedicated vector DB (Qdrant/Pinecone)** | Optimized vector search               | Additional infrastructure; operational complexity; unnecessary at MVP scale                             | Violates Ponytail (pgvector sufficient for MVP) |

## Consequences

- Single database for all data — simpler operations, backups, and disaster recovery
- pgvector provides vector search within PostgreSQL — no separate vector database needed
- JSONB columns provide document flexibility within a relational framework
- Strong referential integrity protects clinical data relationships
- Migration path: can extract to dedicated vector DB later if search scale demands
