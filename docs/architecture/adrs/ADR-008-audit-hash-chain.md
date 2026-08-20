# ADR-008: Audit Hash Chain for Tamper Evidence

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3

## Context

Hospital AI OS requires tamper-evident audit logs per product requirements. Audit events must be immutable and any modification must be detectable.

## Decision

**Append-only audit table with SHA-256 hash chain** linking each record to its predecessor. Database-level REVOKE on UPDATE/DELETE.

## Alternatives Considered

| Alternative                             | Pros                      | Cons                                                                                 | Reason Rejected                                          |
| :-------------------------------------- | :------------------------ | :----------------------------------------------------------------------------------- | :------------------------------------------------------- |
| **Blockchain/distributed ledger**       | Strongest tamper evidence | Massive complexity; operational overhead; inappropriate for a single-facility system | Over-engineered; Ponytail violation                      |
| **Write-once storage (S3 Object Lock)** | Cloud-native immutability | External dependency; latency for audit writes; complicates local development         | Hash chain provides sufficient tamper evidence for MVP   |
| **Audit table without hash chain**      | Simplest                  | No tamper evidence — cannot detect if a record was modified at the database level    | Does not satisfy product requirement for tamper evidence |

## Consequences

- Each audit record contains `previous_hash` (hash of the preceding record) and `record_hash` (hash of its own content)
- Any modification to a past record breaks the chain — detectable by verification
- Append-only enforcement at database level (REVOKE UPDATE, DELETE) and application level
- Chain integrity can be verified periodically via background job
- Audit write failure is a CRITICAL system failure that blocks the originating operation
