# ADR-012: Appointment Token Number Allocation

**Status:** ACCEPTED  
**Date:** 2026-08-25  
**Author:** Phase 5 Architecture Review  
**Supersedes:** None  
**References:** `database-design.md §3.5` (appointments, `idx_appointments_token`), `domain-model.md §2.5`, `api-architecture.md §2.3`, `PRODUCT_SPEC.md` / `FEATURE_CATALOG.md` F-APPT-02, `backend-architecture.md §5.3` (audit transaction boundary), `ADR-011-mrn-generation.md`

---

## Context

The `appointments` table carries `token_number INTEGER` with the partial unique index:

```sql
idx_appointments_token UNIQUE (doctor_id, scheduled_date, token_number)
WHERE token_number IS NOT NULL
```

The authoritative domain model defines `token_number` as a **"Per-doctor per-day sequence"** (`domain-model.md` §2.5), and the product catalog describes it as the patient's position in the **doctor's active OPD queue** (`FEATURE_CATALOG.md`). The intended conceptual behavior is therefore:

```text
Doctor A + Date X: 1, 2, 3, 4...
Doctor B + Date X: 1, 2, 3...
Doctor A + Date Y: 1, 2, 3...
```

No Phase 3 document specifies the **allocation mechanism**. The mechanism must be concurrency-safe, compatible with the existing unique index, and must not degrade the strictly serialized `audit_events` hash-chain write that occurs inside the *same booking transaction* (see `backend-architecture.md` §5.3 and the lock-ordering concern documented in ADR-011).

Token numbers are operational queue numbers, **not** MRNs. They are low-value, human-spoken, daily-reset identifiers. Gap tolerance is therefore higher than for MRNs, but predictability within a day is clinically useful (patients are called by token).

---

## Requirements

| # | Requirement | Source |
|:---|:---|:---|
| R1 | Uniqueness per `(doctor_id, scheduled_date)` | database-design.md §3.5 |
| R2 | Per-doctor, per-day numbering starting at 1 | domain-model.md §2.5 (authoritative) |
| R3 | Concurrency-safe under simultaneous front-desk bookings for one doctor/day | ADR-011 precedent |
| R4 | Must not introduce deadlock risk when combined with the `audit_events` EXCLUSIVE lock taken later in the same transaction | ADR-011 §Justification.2 |
| R5 | Allocated inside the booking transaction (booking + audit commit atomically) | backend-architecture.md §5.3 |
| R6 | No application-level locking unless architecture requires it | Phase constraints |

---

## Options Evaluated

### Option A — Global PostgreSQL sequence

One `CREATE SEQUENCE appointment_token_seq` shared by all doctors/days.

| Criterion | Assessment |
|:---|:---|
| Uniqueness | ✅ Guaranteed |
| Per-day reset | ❌ **Impossible without modulo tricks**; a single sequence cannot restart at 1 per doctor/day |
| Domain fit | ❌ Violates R2 directly |
| Gaps | Gaps on rollback (non-transactional `nextval`) |

**REJECTED:** fails the authoritative per-doctor/per-day requirement (R2). Not silently assumed despite being the cheapest option.

### Option B — Per-doctor/day counter row with transactional row lock

A dedicated counter table keyed `(doctor_id, scheduled_date)`; allocation is an atomic upsert-increment that takes a row lock until COMMIT.

| Criterion | Assessment |
|:---|:---|
| Uniqueness | ✅ Guaranteed (single-row increment; unique index as backstop) |
| Per-day reset | ✅ Automatic — date is part of the key |
| Doctor isolation | ✅ Different doctors/days never contend |
| Concurrency | ✅ Same doctor/day serializes at DB row level (correct semantics: one physical queue) |
| Gaps / rollback | ✅ Counter increment is transactional → rollback reverts the counter → **no gaps**, no reuse-after-commit |
| Transaction behavior | Native to the booking transaction; no extra connection state |
| Performance | One extra row upsert (~sub-ms); hot-row serialization limited to a single doctor's booking throughput — far above OPD front-desk rates |
| Operational complexity | Low — one table, zero background jobs, no cleanup required for correctness |
| Deadlock risk | Minimal — each transaction touches exactly **one** counter row; documented lock ordering (below) makes cycles impossible |
| Migration complexity | One new small table (Phase 5 migration, created at implementation time — **not** in this ADR's scope to apply) |
| Unique-index compatibility | ✅ Index remains as defense-in-depth |

**SELECTED.**

### Option C — `MAX(token_number) + 1` with unique-constraint retry

Read current max for `(doctor_id, scheduled_date)`, add 1, insert; on unique violation, retry.

| Criterion | Assessment |
|:---|:---|
| Uniqueness | ✅ Eventually guaranteed by the unique index |
| Correctness under concurrency | ✅ Safe under READ COMMITTED **provided** the retry re-reads max after the conflicting transaction commits |
| Contention profile | ⚠️ **Pathological under burst**: N concurrent bookings for the same doctor/day all compute the same max → N−1 fail → each retry repeats the cycle. Worst-case wait grows ~O(N²) in retry rounds, exactly when the front desk books a morning queue en masse |
| Interaction with audit lock | ❌ Retry loops extend transaction duration **while holding or awaiting the `audit_events` EXCLUSIVE lock**, amplifying the system-wide hash-chain serialization bottleneck (the precise risk ADR-011 used to reject its Option B) |
| Gaps / rollback | Ambiguous: a rolled-back booking frees its number for reuse by a later booking the same day (max-based), producing nondeterministic reissuance semantics |
| Complexity | Deceptively simple; hides a mandatory bounded-retry policy (retry cap → 409/503 mapping) |

Safety proof attempt (for the record): with a bounded retry loop that re-executes `SELECT MAX(...)` after each unique-violation, the scheme converges because each failed insert implies a committed higher max; monotonicity guarantees termination within ≤ N retries. It is **correct** — but termination is bought with quadratic retry traffic and prolonged transactions sharing locks with the audit chain.

**REJECTED:** correctness does not justify the contention pathology and its coupling to the audit hash-chain lock (R4).

### Option D — PostgreSQL advisory-lock based allocation

`pg_advisory_xact_lock(hash(doctor, date))` around a max-read/increment.

| Criterion | Assessment |
|:---|:---|
| Correctness | ✅ Equivalent serialization to Option B |
| Complexity | ❌ Application-managed key namespace; collision-prone hashing; lock lifetime tied to developer discipline |
| Failure modes | ❌ No visibility in `pg_locks` relation terms; easier to leak/misorder than a real row lock |
| Necessity | ❌ Option B achieves identical semantics with a plain row lock — advisory locks are redundant |

**REJECTED:** adds application-level locking machinery where the database already provides the primitive (violates R6's spirit).

---

## Decision Matrix

| Criterion | A: Global seq | B: Counter row | C: MAX+1 retry | D: Advisory lock |
|:---|:---:|:---:|:---:|:---:|
| Per-doctor/day reset (R2) | ❌ | ✅ | ✅ | ✅ |
| Uniqueness guarantee | ✅ | ✅ | ✅ (eventual) | ✅ |
| Burst contention | ✅ none | ✅ bounded, row-scoped | ❌ O(N²) retries | ✅ bounded |
| Audit-lock interaction | ✅ | ✅ short critical section | ❌ extended holds | ⚠️ manual ordering |
| Gaps on rollback | ⚠️ gaps | ✅ none | ⚠️ reuse ambiguity | ⚠️ reuse ambiguity |
| Ops complexity | ✅ | ✅ one table | ✅ | ❌ key namespace |
| Deadlock risk | ✅ | ✅ single-row, ordered | ⚠️ retry storms | ⚠️ manual ordering |
| Migration | trivial | one small table | none | none |

---

## Decision

**Option B is adopted:** a per-doctor/per-day counter row allocated via an atomic upsert-increment inside the booking transaction.

### Counter table schema (to be created in the M8 migration)

```sql
CREATE TABLE appointment_token_counters (
  doctor_id      UUID    NOT NULL REFERENCES staff(id),
  scheduled_date DATE    NOT NULL,
  last_token     INTEGER NOT NULL DEFAULT 0 CHECK (last_token >= 0),
  PRIMARY KEY (doctor_id, scheduled_date)
);
```

- Composite key `(doctor_id, scheduled_date)` — initialization and daily reset are both implicit in the key.
- No `updated_at`; the row is a pure high-water mark.

### Allocation statement (atomic; no creation race)

Executed inside the booking transaction, before inserting the appointment row:

```sql
INSERT INTO appointment_token_counters AS c (doctor_id, scheduled_date, last_token)
VALUES ($1, $2, 1)
ON CONFLICT (doctor_id, scheduled_date)
DO UPDATE SET last_token = c.last_token + 1
RETURNING last_token;
```

- First booking of a doctor/day: INSERT branch creates the row with token `1`.
- Concurrent/subsequent bookings: conflict branch increments under the row's exclusive lock.
- There is **no separate SELECT-then-INSERT window**; the row-creation race is impossible by construction.
- The `RETURNING` value is formatted as the integer token number (no padding, no prefix — it is spoken aloud in a waiting room).

### Locking behavior & lock-ordering contract

`ON CONFLICT ... DO UPDATE` acquires a **row-level exclusive lock** on the counter row, held until the transaction ends. Every booking transaction touches exactly **one** counter row. Mandatory lock acquisition order inside the booking transaction:

```text
1. appointment_token_counters row   (allocation)
2. patients / staff validation reads (shared reads, no new locks)
3. appointments insert               (unique index checks)
4. [check-in path only] encounters insert/update
5. audit_events EXCLUSIVE lock       (hash chain, via auditService.logEvent)
```

Because step 1 always precedes steps 4–5 in every code path, and no transaction ever takes a second counter row, no cyclic wait can form involving the counter table or the audit chain.

### Transaction boundary & rollback behavior

- Allocation lives in the **same transaction** as the appointment insert and the audit event(s). If any step fails (validation, unique-slot violation, `AuditWriteError`), the entire transaction rolls back **including the counter increment** — the next successful booking receives the same number. Token numbers therefore exhibit **no gaps from rollbacks** (a deliberate contrast with MRN sequences, which are intentionally gap-tolerant per ADR-011; here the transactional counter gives gap-freedom for free).
- Committed tokens are **never reused**: cancellation of an appointment does not decrement the counter or release its number. Cancelled slots become bookable again as *time slots*, but consume fresh token numbers. This keeps queue numbering monotonic and matches how physical OPD token books behave.

### Uniqueness guarantee

Three independent layers:

1. Single-row serialized increment (primary mechanism).
2. Existing partial unique index `idx_appointments_token (doctor_id, scheduled_date, token_number)` (defense-in-depth; any defect surfaces immediately as a constraint violation rather than silent duplication).
3. Booking-time double-booking check (same doctor/date/time, non-cancelled) remains orthogonal and unchanged.

---

## Consequences

- One additional table ships with the M8 migration; total Phase 8-slice DDL is this table only — no changes to existing tables.
- Front-desk bursts serialize per doctor at row-lock scope, which mirrors the physical reality of a single queue and cannot starve other departments/doctors.
- No background jobs, no Redis dependency, no cleanup required; historical counter rows accumulate at ≤ (doctors × days) rows and may be archived by a future retention job if ever needed.
- Tests must include: concurrent bookings for the same doctor/date produce strictly increasing unique tokens; concurrent bookings across doctors proceed without blocking; rollback (simulated audit failure) leaves the counter reverted.

## Rejected Alternatives (summary)

- **Option A:** violates the authoritative per-doctor/per-day definition in `domain-model.md`.
- **Option C:** provably correct but O(N²) retry contention coupled to the `audit_events` hash-chain lock; ambiguous rollback/reuse semantics.
- **Option D:** redundant application-managed locking where a native row lock suffices.
