# ADR-001: Modular Monolith Architecture

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3

## Context

Hospital AI OS needs an application topology that supports 9 domain modules with complex cross-domain workflows (registration → encounter → clinical records → lab → discharge). The system handles healthcare data requiring ACID transactional guarantees and is being built by a small team at MVP stage.

## Problem

Choose between monolith, modular monolith, and microservices.

## Decision

**Modular monolith** — a single deployable application composed of domain modules with explicit, enforced boundaries.

## Alternatives Considered

| Alternative                 | Pros                            | Cons                                                                              | Reason Rejected                                 |
| :-------------------------- | :------------------------------ | :-------------------------------------------------------------------------------- | :---------------------------------------------- |
| **Monolith (unstructured)** | Simplest                        | Module boundaries not enforced; tangled dependencies; hard to decompose later     | Insufficient for 9+ domain modules              |
| **Microservices**           | Independent deployment; scaling | Distributed transactions; network latency; operational complexity; team too small | Over-engineered for MVP; ACID guarantees harder |

## Consequences

- Single database, single deployment artifact, single process
- Cross-module transactions are simple (single database transaction)
- Module boundaries enforced by code organization and dependency rules (not network)
- Can be decomposed into services later if team/scale demands it
- Debugging is simpler (single process, full stack traces)

## Risks

- Module boundary discipline must be maintained through code review and CI checks
- If team grows significantly, may need extraction of high-traffic modules
