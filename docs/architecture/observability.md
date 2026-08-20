# Hospital AI OS — Observability Architecture

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** Engineering Rules, Security Rules  
> **Scope:** Structured logging, metrics, audit logs, AI telemetry, PHI protection in logs

---

## 1. Fundamental Separation

> [!IMPORTANT]
> **Operational logs** and **healthcare audit records** are distinct systems with different requirements.

| Property | Operational Logs | Audit Records |
|:---|:---|:---|
| **Purpose** | Debugging, monitoring, alerting | Legal/regulatory accountability |
| **Mutability** | Rotatable, compactable | **Immutable, append-only** |
| **Retention** | 30-90 days (configurable) | Indefinite |
| **PHI** | **Never** | Access metadata only (who accessed what, not the data itself) |
| **Storage** | Standard log aggregation (stdout → file/service) | `audit_events` table (PostgreSQL, hash-chained) |
| **Tamper evidence** | Not required | SHA-256 hash chain |
| **Failure behavior** | Degraded (log loss tolerable) | **Critical — blocks originating operation** |

---

## 2. Structured Logging Standard

### 2.1 Log Format

All operational logs use structured JSON:

```json
{
  "timestamp": "2026-08-20T15:30:00.000Z",
  "level": "info",
  "service": "backend",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "staff-uuid",
  "userRole": "physician",
  "message": "Clinical record created",
  "module": "clinical",
  "action": "createRecord",
  "encounterId": "encounter-uuid",
  "durationMs": 45
}
```

### 2.2 Required Fields

| Field | Source | Description |
|:---|:---|:---|
| `timestamp` | Auto | ISO 8601 with milliseconds |
| `level` | Logger call | `error`, `warn`, `info`, `debug` |
| `service` | Config | `backend`, `frontend`, `worker` |
| `correlationId` | Middleware | Request-scoped UUID propagated across all operations |
| `message` | Developer | Human-readable description of the event |

### 2.3 Optional Context Fields

| Field | When |
|:---|:---|
| `userId` | Authenticated requests |
| `userRole` | Authenticated requests |
| `module` | Domain module name |
| `action` | Specific operation name |
| `durationMs` | Performance-sensitive operations |
| `errorCode` | Error responses |

### 2.4 Log Levels

| Level | Usage |
|:---|:---|
| `error` | Operation failures requiring attention (DB errors, unhandled exceptions, audit write failures) |
| `warn` | Degraded states (AI circuit breaker open, rate limit approaching, retry occurring) |
| `info` | Significant business events (user login, encounter created, discharge authorized) |
| `debug` | Development-only detail (query parameters, validation steps) — disabled in production |

---

## 3. PHI Exclusion Rules

| Rule | Implementation |
|:---|:---|
| Patient names never in logs | Request log middleware strips patient name fields |
| Clinical content never in logs | JSONB `content` fields never logged |
| Identity document numbers never in logs | PII fields excluded from log serialization |
| Lab result values never in operational logs | Result values excluded; only metadata (order ID, status, is_critical) logged |
| Error responses never contain PHI | Global error handler strips PHI from error payloads |
| AI prompts not in operational logs | Prompt content logged only to `ai_interactions` table (encrypted), not operational logs |

**What IS logged:**
- Resource IDs (UUIDs) — these are not PHI
- Event types and status transitions
- User actions (who did what, to which resource ID)
- Performance metrics
- Error codes and safe messages

---

## 4. Correlation ID Propagation

```text
Browser Request
    │
    ▼
Nginx (X-Request-ID header)
    │
    ▼
Backend Middleware (extract or generate correlationId)
    │
    ├── All log entries include correlationId
    ├── All audit events include correlationId
    ├── All background jobs carry correlationId
    └── All AI interactions log correlationId
```

A single user action can be traced across all log entries, audit events, and background jobs using the correlation ID.

---

## 5. AI Telemetry

### 5.1 Per-Request Metrics (from `ai_interactions` table)

| Metric | Source |
|:---|:---|
| Latency | `latency_ms` column |
| Input tokens | `input_tokens` column |
| Output tokens | `output_tokens` column |
| Model used | `model_name` column |
| Grounding status | `grounding_status` column |
| User action | `user_action` column (accepted/rejected/edited) |

### 5.2 Aggregate Metrics (computed from `ai_interactions`)

| Metric | Aggregation | Dashboard |
|:---|:---|:---|
| Daily AI request count | COUNT per day per capability | Admin |
| Daily token usage | SUM per day | Admin |
| p50/p95 latency | Percentile per capability | Admin |
| Acceptance rate | COUNT(accepted) / COUNT(total) per capability | Admin |
| Rejection rate + reasons | COUNT(rejected) with reason categories | Admin |
| Error rate | COUNT(grounding_status = 'validation_failed') / total | Admin |
| Cost estimate | (input_tokens × input_price + output_tokens × output_price) | Admin |

---

## 6. Health Checks

### 6.1 Health Check Endpoint

`GET /api/v1/health`

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "up", "latencyMs": 5 },
    "redis": { "status": "up", "latencyMs": 2 },
    "aiProvider": { "status": "up" }
  },
  "uptime": 86400
}
```

### 6.2 Degraded States

| Component Down | System Status | User Impact |
|:---|:---|:---|
| AI Provider | `degraded` | AI features unavailable; manual workflows continue |
| Redis | `degraded` | Notifications delayed; background jobs queued |
| PostgreSQL | `unhealthy` | **System unavailable** — all operations halted |

---

## 7. Error Tracking

- Unhandled exceptions logged at `error` level with full stack trace (server-side only)
- Error rate alerting threshold: >1% of requests returning 5xx in a 5-minute window
- AI error rate alerting: circuit breaker state changes logged at `warn` level
- Audit write failures logged at `error` level and trigger immediate alert

---

## 8. Performance Monitoring

| Metric | Measurement Point | Alerting Threshold |
|:---|:---|:---|
| API response time (p95) | Express middleware | Engineering target to be validated |
| Database query time (p95) | Repository layer | Slow query logging (>100ms) |
| AI request time (p95) | AI adapter | Tracked per capability |
| Background job processing time | BullMQ metrics | Per job type |
| Memory usage | Container metrics | >80% container memory |
