# ADR-004: JWT Authentication

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3

## Context

Hospital AI OS needs stateless API authentication with bounded token lifetimes, refresh capability, and immediate revocation support.

## Decision

**JWT (RS256) access tokens (15-minute lifetime) + opaque refresh tokens (httpOnly cookie, 7-day lifetime)** with server-side refresh token storage for revocation.

## Alternatives Considered

| Alternative | Pros | Cons | Reason Rejected |
|:---|:---|:---|:---|
| **Session-based (server-side sessions)** | Simple; immediate revocation | Requires session store (Redis); stateful; harder to scale | JWT preferred for stateless API authentication; refresh tokens provide revocation capability |
| **OAuth2/OIDC with external IdP** | Delegated identity; SSO support | Added infrastructure; external dependency; overkill for single-facility MVP | Deferred to Phase 2 when external IdP integration may be needed |

## Consequences

- Stateless API authentication (no session store lookup per request)
- Short access token lifetime limits exposure window
- Refresh token rotation detects theft (if both old and new tokens are used)
- RS256 asymmetric signing: private key stays on server, public key can be distributed
- Server-side refresh token hash enables immediate revocation
