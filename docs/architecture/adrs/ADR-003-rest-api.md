# ADR-003: REST API with OpenAPI

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3

## Context

Hospital AI OS needs a client-server API contract for frontend-backend communication. The data access patterns are predominantly resource-oriented (CRUD on patients, encounters, records, results).

## Decision

**REST (JSON) with OpenAPI 3.1 specification** for all API contracts.

## Alternatives Considered

| Alternative | Pros                                    | Cons                                                                                                   | Reason Rejected                                                      |
| :---------- | :-------------------------------------- | :----------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------- |
| **GraphQL** | Flexible queries; reduced over-fetching | Added complexity; learning curve; authorization harder at field level; unnecessary for this data model | Data access patterns are resource-oriented; complexity not justified |
| **gRPC**    | High performance; strong typing         | Browser support requires gRPC-Web proxy; less tooling for API exploration                              | Not appropriate for browser-to-server communication                  |

## Consequences

- Simple, well-understood contract model
- Rich ecosystem of tooling (Swagger UI, code generation, testing tools)
- Easy to test with curl, Postman, automated test suites
- Consistent error response format across all endpoints
