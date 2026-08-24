# Phase 4 — Final Security Closure and Freeze Report

## Phase 4 Status: **COMPLETE**

All milestones verified and frozen:

| Milestone | Scope | Status |
|:---|:---|:---:|
| M1–M3 | Platform, specification, architecture, DB schema | VERIFIED |
| M4 | Authentication (RS256 JWT, HTTP-only refresh cookies) | VERIFIED |
| M5 | Authorization (static RBAC policy engine) | VERIFIED |
| M7 | Audit (hash chain + append-only trigger) | VERIFIED |
| M6 | Patient module (ADR-011 MRN, registration, search, identity) | VERIFIED |
| M17 | Patient UI (directory, registration form, profile) | VERIFIED |

---

## Security

### Secret scan

- Full tracked-tree scan for `figd_`, AWS keys (`AKIA…`), OpenAI-style (`sk-…`),
  GitHub (`ghp_…`), Slack (`xox…`), Google (`AIza…`), PEM private key blocks, and
  compact JWTs: **no live credentials found**.
- Only matches are (a) test assertions asserting keys are never leaked
  (`auth.test.ts`) and (b) documentation of the historically compromised Figma token
  in `PHASE_4_SECURITY_REMEDIATION_REPORT.md`.
- `.env` is gitignored; only `.env.example` placeholders are tracked.
- Dev-only defaults (`postgres/postgres` in `docker-compose.dev.yml`, fallback local
  connection URLs for the Docker dev database) are documented development conveniences,
  not production credentials.

### CORS

- `credentials: true` is **required** by the M4 architecture: refresh tokens are
  delivered as HTTP-only cookies and the frontend client sends
  `credentials: 'include'` on every request.
- Hardened during this gate:
  - Origin check is now a **function** — `Access-Control-Allow-Origin` is emitted
    **only** for explicitly configured trusted origins (`CORS_ORIGIN`,
    comma-separated list supported). Unknown origins receive no CORS headers at all.
    (Previously a static string origin was echoed unconditionally.)
  - Wildcard origins are rejected at startup by the config schema — it is impossible
    to combine `*` with credentials.
  - Production origin is fully environment-driven via `CORS_ORIGIN`.
- Regression tests added (`src/middleware/__tests__/cors.test.ts`, 4 tests):
  trusted origin → ACAO echoed + `allow-credentials: true`; unknown origin → no ACAO;
  wildcard is never reflected; preflight works with credential headers.

### Encryption key (identity document numbers)

- Mechanism: AES-256-GCM (architecture-approved), random 96-bit IV per record,
  authentication tag verified on decrypt.
- Key management:
  - **Production fails closed**: missing or short (<32 char) `ENCRYPTION_KEY` throws —
    encryption never silently degrades.
  - Local dev/test may use an explicitly documented insecure fallback so the stack
    runs locally; unsuitable for real data and unreachable in production.
  - No hardcoded production keys anywhere in source; no key material is ever logged.

### Authentication

- RS256 asymmetric JWT access tokens from file-based keys; refresh tokens are
  SHA-256-hashed at rest, delivered as `httpOnly; sameSite=strict` cookies,
  revocable server-side. Verified in M4 and unchanged.

### Authorization

- Static RBAC matrix enforced server-side per route (`requirePermission`);
  frontend visibility is UX-only. Live RBAC matrix re-verified in the API gate
  (receptionist allowed; physician/security_admin denied with 403).

### Audit integrity

- `audit_events` is append-only via DB trigger (UPDATE/DELETE raise exceptions);
  SHA-256 hash chain with previous-hash continuity verified live under concurrent
  appends. Unchanged by this gate.

### Patient data protection

- Identity document numbers encrypted at rest (AES-256-GCM) and never returned by
  any API response. MRN remains a non-secret display identifier; UUIDs remain the
  database/API identifiers. Verified live (gate §D/G).

---

## Verification (all actually executed)

| Check | Result |
|:---|:---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm run build` | PASS |
| `pnpm run lint` | PASS |
| `pnpm run format` | PASS |
| `pnpm -r run test` | PASS — shared 6/6, backend **154/154** (incl. 4 new CORS regression tests) |
| `pnpm --filter frontend exec tsc --noEmit` | PASS |
| `pnpm --filter frontend build` | PASS |
| Live DB verification script (`phase4_verification.ts`) | ALL PASSED |
| Live API acceptance gate (`gate_api_verify.ts`) | **27/27 PASSED** (re-run after security changes — no M6/M17 regression) |
| Clean-database migration (sequences, constraints, pg_trgm, trigger) | PASS |
| Frontend flow against running dev server | PASS |

## Known operational notes

- Docker PostgreSQL is exposed on host port **55432** because a local Postgres occupies
  5432 on the development machine; all configs point to 55432.
- The Figma token exposed in historical Git commits **must remain revoked** externally;
  history was intentionally not rewritten.
- `ENCRYPTION_KEY` must be supplied securely (>=32 chars) outside local development;
  production startup fails closed without it.
- Set `CORS_ORIGIN` to the explicit production frontend origin(s) when deploying.

---

**Phase 4 closed.** Phase 5 (Appointments, Encounters, Clinical, Lab, Tasks, AI) has
NOT been started, per freeze instruction.
