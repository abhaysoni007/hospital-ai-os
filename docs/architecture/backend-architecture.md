# Hospital AI OS — Backend Architecture

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** Engineering Rules, System Architecture  
> **Scope:** Module structure, layering, middleware, services, repositories, error handling, background jobs

---

## 1. Technology Stack

| Component | Technology | Justification |
|:---|:---|:---|
| **Runtime** | Node.js 20 LTS | Stable, well-supported, TypeScript-native |
| **Framework** | Express 4.x | Minimal, well-understood, extensible middleware |
| **Language** | TypeScript 5.x (strict mode) | Type safety, developer experience, shared types with frontend |
| **Validation** | Zod | TypeScript-first schema validation, inference |
| **ORM / Query Builder** | Drizzle ORM | Type-safe, close to SQL, minimal abstraction overhead |
| **Background Jobs** | BullMQ + Redis | Reliable job processing, delayed jobs, retries |
| **Testing** | Vitest | Fast, TypeScript-native, compatible with Node.js |
| **Process Management** | tsx (dev) / Node.js (production) | Direct TS execution in dev |

---

## 2. Module Structure

Each domain module follows a consistent internal structure:

```text
src/backend/
├── modules/
│   ├── patient/
│   │   ├── patient.controller.ts    ← Route handlers (thin — delegates to service)
│   │   ├── patient.service.ts       ← Business logic
│   │   ├── patient.repository.ts    ← Database queries
│   │   ├── patient.schemas.ts       ← Zod validation schemas
│   │   ├── patient.types.ts         ← TypeScript types
│   │   ├── patient.routes.ts        ← Express route definitions
│   │   └── __tests__/
│   │       ├── patient.service.test.ts
│   │       └── patient.controller.test.ts
│   ├── encounter/
│   ├── clinical/
│   ├── lab/
│   ├── discharge/
│   ├── ai/
│   ├── auth/
│   ├── audit/
│   └── task/
├── middleware/
│   ├── auth.middleware.ts           ← JWT verification
│   ├── rbac.middleware.ts           ← Role-based permission check
│   ├── validation.middleware.ts     ← Zod schema validation
│   ├── error-handler.middleware.ts  ← Global error handler
│   ├── correlation-id.middleware.ts ← Request tracing
│   ├── rate-limit.middleware.ts     ← Rate limiting
│   └── request-log.middleware.ts    ← Request/response logging
├── shared/
│   ├── types/                       ← Shared TypeScript types
│   ├── errors/                      ← Typed error classes
│   ├── utils/                       ← Shared utilities
│   ├── config/                      ← Environment configuration
│   └── logger/                      ← Structured logger setup
├── jobs/
│   ├── job-processor.ts             ← BullMQ worker setup
│   ├── notification.job.ts          ← Notification dispatch job
│   ├── embedding.job.ts             ← Document embedding generation
│   └── audit-chain.job.ts           ← Hash chain computation
├── database/
│   ├── connection.ts                ← PostgreSQL connection pool
│   ├── schema/                      ← Drizzle schema definitions
│   └── migrations/                  ← Database migrations
├── app.ts                           ← Express app setup
└── server.ts                        ← Server entry point
```

---

## 3. Layering Architecture

```text
┌─────────────────────────────────────────────┐
│               Routes (Express)              │  ← HTTP routing only
├─────────────────────────────────────────────┤
│              Middleware Stack                │  ← Auth, RBAC, validation, logging
├─────────────────────────────────────────────┤
│             Controllers                     │  ← Request parsing, response formatting
├─────────────────────────────────────────────┤
│              Services                       │  ← Business logic, orchestration
├─────────────────────────────────────────────┤
│            Repositories                     │  ← Database queries (Drizzle)
├─────────────────────────────────────────────┤
│              Database                       │  ← PostgreSQL
└─────────────────────────────────────────────┘
```

### 3.1 Layer Responsibilities

| Layer | Responsibility | Must NOT Do |
|:---|:---|:---|
| **Routes** | Map HTTP methods/paths to controller functions; apply middleware | Contain logic |
| **Middleware** | Cross-cutting concerns (auth, validation, logging, error handling) | Business logic |
| **Controllers** | Parse request, call service, format response | Business logic, direct DB access |
| **Services** | Business rules, workflow orchestration, audit event emission | HTTP concerns, SQL queries |
| **Repositories** | Database queries, data mapping | Business logic, HTTP concerns |
| **Database** | Storage, constraints, indexes | Business logic (no stored procedures for business rules) |

### 3.2 Dependency Direction

Dependencies flow **downward only**:
- Controllers depend on Services
- Services depend on Repositories and other Services (same or lower module)
- Repositories depend on Database

**No upward dependencies. No circular dependencies.**

---

## 4. Middleware Stack

Request processing order (top to bottom):

```text
1. correlation-id.middleware     ← Generate/extract correlation ID
2. request-log.middleware        ← Log incoming request (sanitized)
3. rate-limit.middleware         ← Rate limiting (IP + user-based)
4. auth.middleware               ← JWT verification (skip for public routes)
5. rbac.middleware               ← Permission check (per-route configuration)
6. validation.middleware         ← Zod schema validation (per-route)
7. [Controller Handler]         ← Business logic execution
8. error-handler.middleware      ← Global error catch, safe response formatting
```

---

## 5. Error Handling Strategy

### 5.1 Typed Error Classes

```typescript
// Base application error
abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  abstract readonly isOperational: boolean;
}

// Specific error types
class ValidationError extends AppError { statusCode = 400; }
class AuthenticationError extends AppError { statusCode = 401; }
class AuthorizationError extends AppError { statusCode = 403; }
class NotFoundError extends AppError { statusCode = 404; }
class ConflictError extends AppError { statusCode = 409; }  // optimistic concurrency
class InternalError extends AppError { statusCode = 500; }
class AIServiceError extends AppError { statusCode = 503; }
class AuditWriteError extends AppError { statusCode = 500; } // CRITICAL
```

### 5.2 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "date_of_birth", "message": "Must be a valid date in the past" }
    ]
  }
}
```

No stack traces, internal paths, or database details in client responses.

### 5.3 Audit Transaction Boundary & Failure

If the Audit module fails to write an audit event, the originating operation **must be rolled back**. An unaudited clinical or security action is unacceptable.

**Implementation Contract:**
All state-changing service methods must accept an optional transaction object (`tx`) and wrap operations accordingly:

```typescript
// Example Implementation Contract
await db.transaction(async (tx) => {
  // 1. Perform business logic
  const record = await clinicalRepository.create(tx, data);
  
  // 2. Emit audit event synchronously within the same transaction
  await auditService.logEvent(tx, {
    eventType: 'CLINICAL_RECORD_CREATED',
    targetId: record.id,
    ...
  });
  
  return record;
}); // COMMIT occurs here
```
If `auditService.logEvent` throws an `AuditWriteError`, the transaction automatically rolls back. Un-audited state cannot exist.

---

## 6. AI Orchestration Service

The AI module exposes a service interface to other modules:

```typescript
interface AIOrchestrationService {
  generateNoteDraft(context: NoteContext): Promise<AIDraftResult>;
  generateDischargeSummary(context: DischargeContext): Promise<AIDraftResult>;
  searchPatientChart(query: string, patientId: string): Promise<ChartSearchResult>;
  extractDocumentOCR(documentPath: string): Promise<OCRResult>;
}
```

The AI module internally handles:
1. Context assembly (gathering patient data from other modules via their service interfaces)
2. Prompt construction (system instructions + context + user query)
3. Provider adapter selection (Google Gemini, or configured alternative)
4. Structured output parsing and validation
5. Evidence grounding checks
6. AI interaction logging
7. Circuit breaker / fallback behavior

Other modules call the AI service interface. They do not construct prompts, call LLM APIs, or parse AI responses directly.

---

## 7. Background Job Architecture

### 7.1 Job Types

| Job | Queue | Priority | Retry | Description |
|:---|:---|:---|:---|:---|
| `notification.dispatch` | notifications | High | 3 retries, exponential backoff | Send in-app notifications |
| `embedding.generate` | embeddings | Low | 2 retries | Generate vector embeddings for new clinical records |
| `critical-alert.dispatch` | notifications | **Critical** | 5 retries, immediate | Dispatch critical lab value notifications |

### 7.2 Job Processing & Transactional Outbox

To guarantee no loss of critical jobs (e.g., critical lab notifications) in the event of a Redis failure, the system uses the **Transactional Outbox Pattern**:

1. Business operation and job creation are committed in the same PostgreSQL transaction (e.g., written to a `jobs_outbox` or directly to `notifications` with a 'pending' status).
2. A background process (or change data capture) polls the table and pushes the job to BullMQ (Redis).
3. If Redis goes down, jobs remain safely stored in PostgreSQL. Once Redis recovers, the outbox processor resumes pushing jobs to the queue.

Other job details:
- Workers run in the same application process (modular monolith)
- Dead letter queue for failed jobs after retry exhaustion
- Job status visible in admin dashboard (future)
- All job executions logged with correlation ID

---

## 8. Configuration Management

### 8.1 Environment Variables

```text
# Server
NODE_ENV=development|staging|production
PORT=3001
API_BASE_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://user:pass@host:5432/hospital_ai_os

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# AI Provider
AI_PROVIDER=google-gemini
AI_API_KEY=<secret>
AI_MODEL_NAME=gemini-2.0-flash
AI_MAX_TOKENS=4096
AI_TIMEOUT_MS=30000

# Encryption
ENCRYPTION_KEY=<secret>

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 8.2 Configuration Validation

All environment variables validated at application startup using Zod. Missing or invalid configuration prevents the application from starting with a clear error message.
