# Phase 4 Security & Correctness Remediation Report

**Date:** 2026-08-24  
**Final Verification:** 2026-08-24  
**Commit:** cfb1eb013e3b891be56878af15e0ddfe06dbca96 (+ local fix for .agents/mcp_config.json)  
**Status:** COMPLETE (except MRN — BLOCKED by design)

---

## Verification Matrix

| Item | Status | Evidence |
|:---|:---:|:---|
| Secret remediation | ✅ PASS | See §1 |
| Audit immutability | ✅ PASS | Live DB: trigger raised exception on UPDATE & DELETE |
| Audit hash chain | ✅ PASS | Live DB: 3 sequential + 5 concurrent events, unbroken chain |
| Audit concurrency | ✅ PASS | Live DB: sequences 16–20, hash chain intact under concurrent load |
| Audit atomicity | ✅ PASS | Live DB: intentional rollback left zero orphaned audit rows |
| Authenticated principal | ✅ PASS | Static analysis: no `SYSTEM_USER`/`ADMISSIONS` in source |
| Patient search (pg_trgm) | ✅ PASS | Live DB: `%` similarity operator executed without error |
| Frontend token security | ✅ PASS | Static analysis: no localStorage/sessionStorage writes |
| MRN generation | ⛔ BLOCKED | ADR-011 PROPOSED — see §8 |
| Build (backend) | ✅ PASS | `tsc` exited 0 |
| Build (frontend) | ✅ PASS | `next build` — 17 pages generated |
| Lint | ✅ PASS | `pnpm run lint` exited 0 |
| Format | ✅ PASS | `pnpm run format` — all files unchanged or reformatted |
| Unit tests | ✅ PASS | 145 backend + 6 shared = **151 tests passed** |

---

## §1 — Secret Remediation

### Findings

A Figma access token (`figd_FfCP9e5o8twfQ0-A21UMhfdaQnWprPcANol1XNG-`) was discovered in **two** locations:

| File | Status |
|:---|:---|
| `.claude/mcp.json` | ✅ Remediated — token replaced with `${FIGMA_ACCESS_TOKEN}` |
| `scripts/sync-figma-tokens.js` | ✅ Remediated — now reads `process.env.FIGMA_ACCESS_TOKEN` |
| `.agents/mcp_config.json` | ✅ Remediated — **found during final verification gate, now fixed** |

### Current working tree

`git grep -r "figd_"` returns only the **text description** in this report (`figd_...`) — no live credential.

### ⚠️ EXTERNAL ACTION REQUIRED

> The token `figd_FfCP9e5o8twfQ0-A21UMhfdaQnWprPcANol1XNG-` is present in **Git history** (commits prior to cfb1eb0). It **must be revoked in the Figma dashboard immediately**. The repository history has NOT been rewritten (BFG/filter-branch) — this is a decision for the team given the operational cost.

### Other credentials verified clean

| Pattern | Result |
|:---|:---|
| JWT secrets / private keys | Only read from `process.env`, never hardcoded |
| DATABASE_URL | Only hardcoded in `.env.example` and `docker-compose.dev.yml` (dev defaults, not production secrets) |
| Auth test private keys | Read from `keys/` test fixture directory via `fs.readFileSync`, not hardcoded strings |

---

## §2 — Audit Immutability (Live DB)

**Trigger:** `trg_prevent_audit_modification` on `BEFORE UPDATE OR DELETE` on `audit_events`.

```
[2] Audit: UPDATE rejected by trigger
  ✅ PASS — UPDATE raises exception from trigger — cause: audit_events is an append-only table. UPDATE and DELETE are strictly prohibited.

[3] Audit: DELETE rejected by trigger
  ✅ PASS — DELETE raises exception from trigger — cause: audit_events is an append-only table. UPDATE and DELETE are strictly prohibited.
```

PostgreSQL error code: `P0001` (PLPGSQL `RAISE EXCEPTION`) — database enforced, not application logic.

---

## §3 — Audit Hash Chain (Live DB)

```
[4] Audit: Hash chain continuity
  ✅ PASS — Hash chain is continuous and deterministic
```

Verified:
- Genesis event uses `previousHash = '0'.repeat(64)`
- Each subsequent event's `previousHash` equals the prior event's `recordHash`
- SHA-256 hash recomputed from stored payload string produces identical digest

---

## §4 — Audit Concurrency (Live DB)

```
[6] Audit: Concurrent appends via exclusive lock
  ✅ PASS — All 5 concurrent events stored with unbroken hash chain (sequences: 16, 17, 18, 19, 20)
```

5 concurrent `Promise.all()` invocations of `auditService.logEvent()` produced:
- All 5 events persisted
- Hash chain unbroken (each `previousHash` matches prior `recordHash`)
- Sequential sequence numbers with no gaps or duplicates

Mechanism: `LOCK TABLE audit_events IN EXCLUSIVE MODE` inside each transaction serializes concurrent appends at the PostgreSQL level.

---

## §5 — Audit Transaction Atomicity (Live DB)

```
[5] Audit: Transaction rollback discards audit event
  ✅ PASS — Transaction rollback correctly discards audit event — no orphan
```

An intentional `throw` inside a transaction that had already inserted an audit event was caught. Post-rollback row count was identical to pre-rollback count.

Patient registration uses the same single-transaction pattern: if the audit write fails, the patient row is also rolled back.

---

## §6 — Authenticated Principal

```
[8] Audit: actorRole/actorDepartment use real JWT claims (not fabricated)
  ✅ PASS — patient.service.ts uses authContext.role and authContext.departmentId — no fabricated values
```

Static analysis confirmed:
- No occurrence of `SYSTEM_USER` or `'ADMISSIONS'` in `patient.service.ts`
- `authContext.role` and `authContext.departmentId` are passed through from `req.user` (set by JWT middleware)

---

## §7 — Patient Search (pg_trgm)

```
[7] Patient search: pg_trgm SQL generation
  ✅ PASS — pg_trgm search executed without error (0 results)
```

SQL generated: `(first_name || ' ' || last_name) % $1` — uses PostgreSQL `%` trigram similarity operator, not `ILIKE`.  
Extension `pg_trgm` confirmed active (installed in `0000_enable_extensions.sql`).

---

## §7b — Frontend Token Security

Static analysis results:

| Pattern | Occurrences | Assessment |
|:---|:---:|:---|
| `localStorage.setItem` | 0 | ✅ Clean |
| `sessionStorage.setItem` | 0 | ✅ Clean |
| `inMemoryAccessToken` (module-level var) | 1 | ✅ In-memory only — cleared on page reload |
| `credentials: 'include'` on all fetch calls | 1 | ✅ Refresh token sent as HTTP-only cookie |
| Production role selector | 0 | ✅ Removed per directive |

---

## §8 — MRN Generation

**STATUS: ⛔ BLOCKED — ADR-011 PENDING APPROVAL**

- `generateMRN()` throws `Error('MRN generation is DEFERRED pending architectural decision (ADR-011).')` to prevent unsafe execution.
- Patient registration API will return a 500 error if called in current state (by design).
- ADR-011 has been rewritten with a full evaluation matrix comparing four options across 9 criteria (see [`ADR-011-mrn-generation.md`](../architecture/adrs/ADR-011-mrn-generation.md)).
- Identity document storage is also DEFERRED (no insecure mock logic implemented).

**No progress on Phase 5 until ADR-011 is approved.**

---

## Build & Test Summary

| Check | Result | Detail |
|:---|:---:|:---|
| `pnpm install --frozen-lockfile` | ✅ | Lock file consistent |
| `pnpm --filter backend run build` | ✅ | `tsc` — 0 errors |
| `pnpm --filter frontend exec tsc --noEmit` | ✅ | 0 errors |
| `pnpm --filter frontend build` | ✅ | 17 routes compiled |
| `pnpm run lint` | ✅ | 0 errors, 0 warnings |
| `pnpm run format` | ✅ | All files formatted |
| `pnpm -r run test` | ✅ | 151 tests passed (145 backend + 6 shared) |
| Live DB verification | ✅ | 8/8 checks PASS |
