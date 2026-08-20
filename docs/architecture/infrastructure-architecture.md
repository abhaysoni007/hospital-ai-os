# Hospital AI OS — Infrastructure & Deployment Architecture

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** Engineering Rules  
> **Scope:** Local development, staging, production, Docker, CI/CD, backups

---

## 1. Deployment Model

**Docker Compose** for all environments (dev, staging, production). See **ADR-012** rationale — Kubernetes is not justified at MVP scale.

### 1.1 Container Topology

```text
┌────────────────────────────────────────────────────┐
│                 Docker Compose                      │
│                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐      │
│  │  frontend  │  │  backend   │  │  worker   │      │
│  │  (Next.js) │  │ (Express)  │  │ (BullMQ)  │      │
│  │  Port 3000 │  │ Port 3001  │  │           │      │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘      │
│        │               │              │             │
│        │          ┌─────▼─────┐  ┌────▼────┐        │
│        │          │ PostgreSQL│  │  Redis   │        │
│        │          │ Port 5432 │  │Port 6379 │        │
│        │          └───────────┘  └─────────┘        │
│        │                                            │
│  ┌─────▼──────────────────────────────────┐         │
│  │         Nginx Reverse Proxy             │         │
│  │         Port 80/443                     │         │
│  └─────────────────────────────────────────┘         │
└────────────────────────────────────────────────────┘
```

### 1.2 Service Definitions

| Service    | Image                      | Purpose                        | Persistence             |
| :--------- | :------------------------- | :----------------------------- | :---------------------- |
| `frontend` | Custom (Node.js + Next.js) | Web UI                         | None (stateless)        |
| `backend`  | Custom (Node.js + Express) | API server                     | None (stateless)        |
| `worker`   | Same as backend            | BullMQ job processor           | None (stateless)        |
| `postgres` | `postgres:16-alpine`       | Primary database               | Named volume            |
| `redis`    | `redis:7-alpine`           | Job queue, cache               | Named volume (optional) |
| `nginx`    | `nginx:alpine`             | Reverse proxy, TLS termination | Config mount            |

---

## 2. Environment Configuration

### 2.1 Environment Files

```text
.env.example          ← Template with all variables (committed)
.env.development      ← Local dev values (git-ignored)
.env.staging          ← Staging values (git-ignored)
.env.production       ← Production values (git-ignored, managed via secrets)
```

### 2.2 Required Environment Variables

| Variable               | Dev Default                                                    | Production      | Secret? |
| :--------------------- | :------------------------------------------------------------- | :-------------- | :-----: |
| `NODE_ENV`             | `development`                                                  | `production`    |   No    |
| `DATABASE_URL`         | `postgresql://postgres:postgres@localhost:5432/hospital_ai_os` | Managed         | **Yes** |
| `REDIS_URL`            | `redis://localhost:6379`                                       | Managed         |   No    |
| `JWT_PRIVATE_KEY_PATH` | `./keys/dev-private.pem`                                       | Managed         | **Yes** |
| `JWT_PUBLIC_KEY_PATH`  | `./keys/dev-public.pem`                                        | Managed         |   No    |
| `AI_API_KEY`           | Dev key                                                        | Production key  | **Yes** |
| `AI_PROVIDER`          | `google-gemini`                                                | `google-gemini` |   No    |
| `ENCRYPTION_KEY`       | Dev key                                                        | Managed         | **Yes** |

---

## 3. Local Development Setup

```bash
# Prerequisites: Node.js 20, Docker, pnpm

# 1. Clone and install
git clone <repo>
cd hospital-ai-os
pnpm install

# 2. Start infrastructure
docker compose -f docker-compose.dev.yml up -d postgres redis

# 3. Database setup
pnpm run db:migrate
pnpm run db:seed        # seed dev data (departments, admin user)

# 4. Generate dev JWT keys
pnpm run keys:generate

# 5. Start dev servers
pnpm run dev            # starts frontend (port 3000) + backend (port 3001) concurrently
```

---

## 4. CI/CD Pipeline

### 4.1 Pipeline Stages

```text
Push to branch
     │
     ▼
 ┌─────────────────┐
 │  Lint & Format   │  ESLint, Prettier, TypeScript type-check
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │  Unit Tests      │  Vitest (no external deps)
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │  Integration     │  API tests against test PostgreSQL
 │  Tests           │
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │  Security Scan   │  npm audit, dependency check
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │  Build           │  Frontend build + backend compile
 └────────┬────────┘
          ▼
 (merge to main)
          ▼
 ┌─────────────────┐
 │  Docker Build    │  Multi-stage build for each service
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │  Deploy Staging  │  Docker Compose on staging server
 └────────┬────────┘
          ▼
 (manual approval)
          ▼
 ┌─────────────────┐
 │  Deploy Prod     │  Docker Compose on production server
 └─────────────────┘
```

### 4.2 CI Tool

GitHub Actions (repository is on GitHub).

---

## 5. Database Operations

### 5.1 Migrations

- Managed by Drizzle Kit
- Forward-only migrations (no automatic rollback — rollback scripts written manually when needed)
- Migration files committed to version control
- Applied automatically on deployment

### 5.2 Backups

| Strategy                               | Frequency  | Retention |
| :------------------------------------- | :--------- | :-------- |
| Full database dump (`pg_dump`)         | Daily      | 30 days   |
| WAL archiving (point-in-time recovery) | Continuous | 7 days    |
| Off-site backup replication            | Daily      | 90 days   |

### 5.3 Disaster Recovery

- **RPO (Recovery Point Objective):** < 1 hour (WAL archiving)
- **RTO (Recovery Time Objective):** < 4 hours (restore from backup + redeploy)
- **Procedure:** Documented runbook for database restoration and service recovery

---

## 6. Monitoring

| Component          | Monitoring                                                    |
| :----------------- | :------------------------------------------------------------ |
| **Application**    | Structured JSON logs → log aggregation (stdout in containers) |
| **Database**       | Connection pool metrics, slow query logging                   |
| **Redis**          | Connection health, queue depth                                |
| **Infrastructure** | Container health checks, disk space, memory                   |
| **AI Provider**    | Latency, error rate, token usage (from ai_interactions table) |

Health check endpoint: `GET /api/v1/health` → returns service status, database connectivity, Redis connectivity, AI provider status.

---

## 7. Package Management

**pnpm workspaces** for the monorepo:

```text
hospital-ai-os/
├── package.json          ← Root workspace config
├── pnpm-workspace.yaml   ← Workspace definition
├── packages/
│   └── shared/           ← Shared types, schemas, utilities
│       └── package.json
├── apps/
│   ├── backend/          ← Express API server
│   │   └── package.json
│   ├── frontend/         ← Next.js application
│   │   └── package.json
│   └── worker/           ← BullMQ job processor
│       └── package.json
```

> [!NOTE]
> This replaces the existing `src/` directory structure. The `src/` directory with `.gitkeep` stubs was a Phase 1 placeholder. The pnpm workspace structure under `apps/` and `packages/` is the Phase 3 target.
