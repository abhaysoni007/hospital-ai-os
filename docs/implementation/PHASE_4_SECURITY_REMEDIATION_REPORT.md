# Phase 4 Security & Correctness Remediation Report

**Date:** 2026-08-24  
**Status:** COMPLETED (with one explicit architectural BLOCKED item)

## 1. COMPLETED: Independent Security Remediations

### 1.1 Secret Exposure Remediation
- **Finding:** A Figma access token (`figd_...`) was hardcoded in `.claude/mcp.json` and `scripts/sync-figma-tokens.js`.
- **Action Taken:** Removed the exposed token from both files. They now require an environment variable `FIGMA_ACCESS_TOKEN`.
- **Verification:** `grep` for the token yields no results in the working directory.
- **Action Required:** The token is in Git history and MUST be revoked externally in the Figma dashboard.

### 1.2 Audit & Patient Transaction Atomicity
- **Finding:** Patient registration and Audit logging occurred in two separate transactions.
- **Action Taken:** Wrapped `PatientService.registerPatient` in a single `db.transaction`, passing the `tx` instance down to `AuditService.logEvent`. If either fails, both rollback.
- **Verification:** Code review confirms `await auditService.logEvent(..., tx)` executes within the parent `tx` scope.

### 1.3 Audit Principal Truthfulness
- **Finding:** `actorRole` and `actorDepartment` were hardcoded to `'SYSTEM_USER'` / `'ADMISSIONS'`.
- **Action Taken:** Extracted `req.user.role` and `req.user.departmentId` from the verified JWT via `authMiddleware` and passed them into the Audit service.

### 1.4 Audit Hash Chain Concurrency
- **Finding:** Concurrent audits could read the same `previousHash`, causing a fork/corruption in the hash chain.
- **Action Taken:** Added a strict table lock `LOCK TABLE audit_events IN EXCLUSIVE MODE` during the `logEvent` transaction to guarantee sequential reads of the latest hash and sequential inserts.

### 1.5 PostgreSQL Immutability (Append-Only Audit)
- **Finding:** The Drizzle schema `REVOKE` was not natively enforceable/sufficient.
- **Action Taken:** Created a new raw SQL migration `0001_audit_append_only.sql` with a PostgreSQL trigger (`trg_prevent_audit_modification`) that unconditionally `RAISE EXCEPTION` on `UPDATE` or `DELETE` attempts against `audit_events`.

### 1.6 True Trigram Search
- **Finding:** `searchPatients` was using standard `ilike(..., '%query%')`.
- **Action Taken:** Implemented true PostgreSQL pg_trgm similarity search using `sql\u0060(first_name || ' ' || last_name) % ${query}\u0060`.

### 1.7 Frontend Token & RBAC Handling
- **Finding:** Required verification of secure token handling and correct M5 role mapping.
- **Verification:** Verified `AuthContext.tsx` uses strict in-memory tokens with HTTP-only cookies. Verified `rbac.ts` explicitly maps only canonical M5 roles (`physician`, `nurse`, etc.).

---

## 2. BLOCKED: MRN Generation Architecture Decision

- **Finding:** The requirement mandates a genuinely concurrency-safe MRN mechanism. However, the Phase 3 architecture specifies the MRN as `VARCHAR(20)` but does **not** define the generation mechanism (e.g., PostgreSQL SEQUENCE vs. UUID-hash vs. explicit lock table).
- **Action Taken:** 
  - **STOPPED:** Did not implement a new, unapproved mechanism (e.g., `SEQUENCE`).
  - **BLOCKED:** Modified `generateMRN()` to explicitly `throw new Error('MRN generation is DEFERRED...')` to prevent unsafe duplicate generation.
  - **ADR CREATED:** Drafted `docs/architecture/adrs/ADR-011-mrn-generation.md` (STATUS: PROPOSED) comparing alternatives.
- **Impact:** Patient Registration is structurally complete but blocked from executing successfully until ADR-011 is resolved.

---

## 3. Deferred Items

### 3.1 Identity Document Storage
- **Finding:** Secure storage mechanism (e.g., S3 buckets) not yet provisioned.
- **Action Taken:** Explicitly documenting that physical document upload is **DEFERRED** to Phase 5. No insecure mock logic was implemented.
