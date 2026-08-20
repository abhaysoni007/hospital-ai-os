# ADR-006: pgvector for RAG Embeddings

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3

## Context

AI chart search requires vector similarity search over patient clinical records. The system already uses PostgreSQL as its primary database.

## Decision

**PostgreSQL pgvector extension** for storing and querying vector embeddings. No separate vector database.

## Alternatives Considered

| Alternative                             | Pros                                 | Cons                                                                  | Reason Rejected                               |
| :-------------------------------------- | :----------------------------------- | :-------------------------------------------------------------------- | :-------------------------------------------- |
| **Pinecone**                            | Managed; optimized for vector search | External dependency; additional cost; data residency concerns for PHI | Unnecessary complexity for MVP scale          |
| **Qdrant**                              | Self-hosted; strong performance      | Additional infrastructure; operational overhead                       | Single-database simplicity preferred          |
| **No embeddings (keyword search only)** | Simplest                             | Poor semantic search quality for clinical text                        | Chart search quality is a product requirement |

## Consequences

- Single database for all data including embeddings — simpler operations
- pgvector supports HNSW and IVFFlat indexes for approximate nearest neighbor search
- Embeddings are always scoped to a single patient (no cross-patient search)
- Migration path: embedding service interface is abstracted; can switch to dedicated vector DB if scale demands
- Embedding dimension tied to chosen embedding model (configurable)
