# Pagination and Performance Engineering Standards

## 1. Pagination Policy

All list endpoints MUST enforce pagination to prevent unbounded dataset requests.

### Offset Pagination (Standard Lists)
For endpoints like Patient Search, Appointment Schedules, and general lists, use offset pagination with a strict ceiling.
- Default limit: 20
- Max limit: 100
- Request schemas MUST use `offsetPaginationSchema` from `packages/shared`.
- Stability: Queries MUST be ordered deterministically to prevent "bouncing" (items jumping between pages as records are inserted/updated). Use `ORDER BY created_at DESC, id DESC`.

### Cursor Pagination (High-Volume Logs)
For unbounded streams (e.g., Audit Logs, large continuous Notification feeds), cursor pagination is preferred if the existing API contract supports it.
- Request schemas use `cursorPaginationSchema`.
- Responses return `nextCursor`.

### Rule
**No list endpoints may return all records.** Unpaginated `.findMany()` queries are forbidden.

## 2. Redis and Caching Policy

The system uses centralized Redis (`RedisService`) to offload heavy computations, rate-limit, and cache immutable or slow-changing data.

- **Fail-Open Semantics**: Redis failures MUST NOT crash the application for non-critical paths. If Redis is down, cache reads fall back to DB, and cache writes are ignored.
- **Connection Pooling**: Use connection pools for DB and Redis to avoid port exhaustion during spikes.
- **Rate Limiting**: Enforced via `rate-limit-redis`, falling back to in-memory maps if Redis is unavailable.

## 3. Database Indexing

- Filter clauses (`WHERE`) and Sort clauses (`ORDER BY`) MUST be supported by composite indexes.
- Pagination requires indexes covering `(created_at, id)`.
- Use partial/unique indexes sparingly but purposefully (e.g., idempotency keys).

## 4. Query Efficiency (N+1 Prevention)

- Handlers MUST NOT perform queries inside `.map` or `.forEach` loops.
- Use `IN (...)` queries (batching) or Drizzle `.innerJoin()`/`.leftJoin()` to fetch related entities in a single round-trip.
