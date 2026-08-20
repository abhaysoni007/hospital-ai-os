# ADR-010: Deterministic Lab Rules Engine

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3, Product Safety (Phase 2.1 Lock)

## Context

Hospital AI OS must classify laboratory results as critical/panic values. Per `PRODUCT_SPEC.md §7` and `AI_SYSTEM.md §3`, this classification MUST be deterministic and policy-driven. AI is explicitly prohibited from serving as the classification mechanism.

## Problem

Choose how to implement the deterministic critical value classification.

## Decision

**Application-layer rule evaluator** with configurable reference ranges stored in the `critical_value_rules` database table. No external rules engine. Simple threshold comparisons executed in TypeScript.

## Alternatives Considered

| Alternative | Pros | Cons | Reason Rejected |
|:---|:---|:---|:---|
| **External rules engine (Drools, OpenRules)** | Sophisticated rule management; complex rule support | Heavy dependency; Java-based; operational overhead; unnecessary for threshold comparisons | Ponytail discipline — threshold comparison does not need a rules engine |
| **Database stored procedures** | Close to data; fast execution | Business logic in database violates engineering rules; harder to test; harder to version | Engineering rules prohibit business logic in stored procedures |
| **AI-assisted classification** | Flexible; handles novel patterns | **PROHIBITED by product specification** — AI is non-authoritative for critical value classification | Violates hard healthcare safety boundary |

## Consequences

- Simple, testable TypeScript function that evaluates result values against configured thresholds
- Thresholds are facility-configurable (stored in `critical_value_rules` table)
- Threshold changes are audited
- Rule evaluator is extensively unit-tested at boundary values
- No external rules engine dependency
- Clinical governance owns the threshold values; technology owns the evaluation logic

## Safety Requirements

- Rule evaluator MUST be tested at every threshold boundary (exactly at critical_low, exactly at critical_high, ±epsilon)
- New threshold configurations MUST be reviewed before activation
- Rule evaluator changes require healthcare safety test suite to pass
