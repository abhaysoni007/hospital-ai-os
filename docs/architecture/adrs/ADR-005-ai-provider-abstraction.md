# ADR-005: AI Provider Abstraction Layer

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3

## Context

Hospital AI OS uses LLM capabilities for clinical note drafting, chart search, discharge summaries, and OCR. Per `.claude/rules/ai.md`, the system must not be locked to a single AI provider.

## Decision

**Provider-agnostic abstraction layer** with an adapter interface. Google Gemini as the initial default provider, switchable via configuration.

## Alternatives Considered

| Alternative | Pros | Cons | Reason Rejected |
|:---|:---|:---|:---|
| **Direct Gemini SDK integration** | Simpler initial implementation | Vendor lock-in; provider switch requires code changes | Violates AI rules (provider independence requirement) |
| **LangChain/LlamaIndex framework** | Rich ecosystem; many integrations | Large dependency; significant abstraction overhead; Ponytail discipline violation | Too much abstraction for 4 AI capabilities |

## Consequences

- Simple adapter interface (`AIProviderAdapter`) with two methods: `generateStructuredOutput` and `generateEmbedding`
- Provider switching requires only implementing a new adapter and changing configuration
- No dependency on heavy orchestration frameworks
- Each adapter is independently testable with recorded API fixtures
- Token tracking and cost controls are provider-agnostic (part of the interface contract)
