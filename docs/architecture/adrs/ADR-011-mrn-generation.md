# ADR-011: MRN Generation Mechanism

**Status:** ACCEPTED  
**Date:** 2026-08-24  
**Author:** Phase 4 Architecture Review  
**Supersedes:** None  
**References:** `database-design.md §3.1`, `domain-model.md`, `security-architecture.md §3.3`, `ADR-002`

---

## Context

The Patient Registration vertical slice requires a system-generated Medical Record Number (MRN). The Phase 3 architecture specifies the MRN column as `VARCHAR(20) NOT NULL UNIQUE` with a format implied to be `MRN-YYYY-NNNNN`, but no authoritative generation mechanism was defined.

The naive implementation (fetching `MAX(mrn)`) was rejected during Phase 4 Remediation because it is not concurrency-safe. We must select a generation mechanism that satisfies uniqueness, concurrency, human usability, and database transactional integrity.

---

## Resolution of Open Questions

1. **Are MRN gaps acceptable?**
   **Yes.** Gaps caused by transaction rollbacks (e.g., if a registration fails due to an audit log error) are acceptable for a business identifier like an MRN. Unlike the `audit_events` sequence which requires strict cryptographic continuity, the MRN is merely a unique human-readable tag.
   
2. **How important is enumeration resistance?**
   **Mitigated by Architecture.** Enumeration resistance is handled at the architectural layer. The database primary key (`id`) is a UUID v4, meaning object references in URLs or APIs do not use the MRN. Furthermore, M4 (Auth) and M5 (RBAC) ensure no unauthenticated access is possible. While sequential MRNs reveal annual patient volume to authenticated staff, this is a standard healthcare pattern and is acceptable given the strict RBAC boundary and UUID primary keys.
   
3. **Is changing the proposed MRN format allowed?**
   **No.** The format `MRN-YYYY-XXXXX` (numeric suffix) provides high human usability. It is easy to dictate verbally over the phone and avoids ambiguous characters (I/l/1, O/0). Alphanumeric strings (e.g., from ULIDs) are cognitively harder for clinical staff during emergencies and are rejected.
   
4. **What peak concurrent registration load must be supported?**
   **Lock-free concurrency preferred.** While no specific quantitative TPS is stated in the architecture documents, the system must support safe, non-blocking concurrent registrations without introducing serialization bottlenecks or deadlock risks (especially since registrations also write to the strictly locked `audit_events` table).

---

## Decision Matrix

| Criterion | Option A: PG Sequence | Option B: Lock Table | Option C: UUID/ULID | Option D: DB Trigger |
|:---|:---:|:---:|:---:|:---:|
| **Uniqueness** | ✅ Guaranteed | ✅ Guaranteed | ✅ Probabilistic | ❌ Race condition |
| **Concurrency safety** | ✅ Lock-free | ⚠️ Serialized | ✅ Lock-free | ❌ Unsafe |
| **Format compliant** | ✅ `MRN-YYYY-NNNNN` | ✅ `MRN-YYYY-NNNNN` | ❌ Alphanumeric | ✅ Any |
| **Human usability** | ✅ High (numeric) | ✅ High (numeric) | ❌ Low (dictation risk) | ✅ High |
| **Enumeration risk** | ⚠️ Exposes volume | ⚠️ Exposes volume | ✅ Opaque | ⚠️ Exposes volume |
| **Rollback behavior** | ⚠️ Creates gaps | ✅ No gaps | ✅ No gaps | ✅ No gaps |
| **DB native guarantee**| ✅ Yes | ✅ Yes | ⚠️ Needs UNIQUE | ❌ No concurrency fix |

---

## Decision

We will implement **Option A: PostgreSQL SEQUENCE**.

A dedicated sequence will be created per year (e.g., `patient_mrn_seq_2026`). The application layer will request the next value using `nextval()` inside the registration transaction, format it as `MRN-YYYY-{value:05d}`, and insert it into the `patients` table.

### Justification
1. **Concurrency Safety:** `nextval()` operates outside transaction visibility, meaning multiple concurrent registrations will instantly receive unique values without waiting on row locks.
2. **Deadlock Prevention:** The registration transaction must acquire an `EXCLUSIVE` lock on the `audit_events` table. Adding a second lock (Option B) for MRN generation creates a severe deadlock risk. Option A requires no locks.
3. **Simplicity:** PostgreSQL Sequences are a native, battle-tested primitive for this exact use case (ADR-002 alignment).
4. **Usability:** Preserves the highly usable `MRN-YYYY-NNNNN` format.

### Rejected Alternatives
- **Option B (Lock Table):** Rejected due to serialization bottlenecks and the risk of deadlocks when combined with the audit table lock.
- **Option C (UUID/ULID):** Rejected because alphanumeric MRNs compromise clinical usability and dictation safety.
- **Option D (Trigger):** Rejected because it obscures business logic and does not natively solve concurrency without internally using Option A or B.

---

## Security & Privacy Implications

- **Primary Key Distinction:** The MRN is a human-facing business identifier. It is **NOT** the database primary key. All foreign keys and API endpoints use the `id` (UUID v4) to prevent URL enumeration.
- **Enumeration:** Sequential MRNs allow authenticated users to infer total registration volume for the year. This is accepted risk, mitigated by the fact that only authorized staff (M5 RBAC) can query patient data.
- **No Public Access:** There are no unauthenticated endpoints in the system. M4 JWT validation is required for all access.

---

## Implementation Contract (Phase 5)

When unblocking patient registration in Phase 5, the following exact specifications must be followed:

1. **Database Mechanism:**
   - Create a Drizzle migration that defines a PostgreSQL sequence for the current year (e.g., `CREATE SEQUENCE IF NOT EXISTS patient_mrn_seq_2026 START 1;`).
   - The application must dynamically determine the current year and use the corresponding sequence.
   - A background task or initialization script must ensure the sequence for the *next* year is created before January 1st (or the application can lazily create it). For the MVP, lazily creating or assuming the sequence exists via migration is acceptable.
2. **Format:**
   - `MRN-YYYY-NNNNN`
   - `YYYY` is the current UTC year.
   - `NNNNN` is the sequence value, zero-padded to at least 5 digits (e.g., `00001`).
3. **Transaction Behavior:**
   - Execute `SELECT nextval('patient_mrn_seq_' || EXTRACT(YEAR FROM NOW()))` inside the main registration transaction.
   - Format the result.
   - Insert the patient row.
   - If the transaction rolls back, the sequence value is lost (gap created). This is expected and correct.
4. **Uniqueness Guarantee:**
   - The database sequence guarantees no two concurrent transactions receive the same number.
   - The `mrn VARCHAR(20) NOT NULL UNIQUE` constraint on the `patients` table provides the final safety net.
5. **Testing:**
   - Must include a concurrent registration test that blasts the API with simultaneous requests to verify no duplicate MRN errors are thrown and no deadlocks occur.
