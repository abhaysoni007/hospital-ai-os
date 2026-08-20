# ADR-007: BullMQ for Background Jobs

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3

## Context

Hospital AI OS needs background job processing for notification dispatch, embedding generation, and audit hash chain computation. Jobs need reliability, retry logic, and prioritization.

## Decision

**BullMQ with Redis** for background job processing.

## Alternatives Considered

| Alternative | Pros | Cons | Reason Rejected |
|:---|:---|:---|:---|
| **Database-polled jobs** | No Redis dependency | Less reliable; polling overhead; no built-in retry/backoff | Insufficient reliability for critical notifications |
| **pg-boss** | PostgreSQL-native | Single-threaded; less mature; fewer features | BullMQ has better TypeScript support and larger community |
| **RabbitMQ** | Enterprise-grade messaging | Additional infrastructure; operational complexity | Over-engineered for MVP job processing needs |

## Consequences

- Redis required as additional infrastructure (also usable for caching later)
- Reliable retry with exponential backoff for failed jobs
- Dead letter queue for jobs that exhaust retries
- Priority queues for critical notifications vs background embedding generation
- Workers run in the same process (modular monolith) — no separate deployment for MVP
