# ADR-011: MRN Generation Mechanism

**Status:** PROPOSED / PENDING APPROVAL  
**Date:** 2026-08-24  
**Author:** Phase 4 Remediation Review  
**Supersedes:** None  
**References:** `database-design.md §3.1`, `domain-model.md`, `security-architecture.md §3.3`, `ADR-002`

---

## Context

The Patient Registration vertical slice requires a system-generated Medical Record Number (MRN). The Phase 3 architecture specifies the MRN column as `VARCHAR(20) NOT NULL UNIQUE` with a format implied to be `MRN-YYYY-NNNNN`, but **no authoritative generation mechanism was defined**.

The original naive implementation — fetching the latest `mrn` by `ORDER BY mrn DESC` and incrementing — was rejected during Phase 4 Remediation because:
- It is not safe under concurrent inserts (two simultaneous registrations can both read the same "latest" row and generate a duplicate MRN).
- It is not atomic with the overall registration transaction.
- It does not guarantee uniqueness at the database layer, only relying on a `UNIQUE` constraint to catch races after the fact.

Patient registration is **BLOCKED** until an ADR is approved and implemented.

---

## Decision Drivers

| Driver | Description |
|:---|:---|
| **Uniqueness** | MRN must be globally unique across the lifetime of the system, including across years |
| **Concurrency safety** | Must guarantee no duplicates under concurrent patient registrations |
| **Format** | Must produce `MRN-YYYY-NNNNN` or approved equivalent; human-dictable |
| **Human usability** | Clinical staff must be able to read, write, and dictate over phone |
| **Enumeration/privacy risk** | Sequential MRNs expose total patient volume and allow enumeration |
| **Rollback behavior** | What happens to MRN counter if the registration transaction rolls back? |
| **Database guarantees** | Must be provably safe at the storage layer, not just application logic |
| **Operational complexity** | Must be maintainable, observable, and operable by the infrastructure team |
| **Migration complexity** | Must integrate cleanly with Drizzle ORM migrations without breaking existing M2 schema |

---

## Considered Options

### Option 1: PostgreSQL `SEQUENCE` (`CREATE SEQUENCE`)

**Mechanism:** Create a dedicated per-year sequence `patient_mrn_seq_YYYY`. Use `nextval('patient_mrn_seq_YYYY')` inside the registration transaction to obtain the next integer; format as `MRN-YYYY-{value:05d}`.

| Criterion | Assessment |
|:---|:---|
| **Uniqueness** | ✅ Guaranteed — SEQUENCE is a crash-safe, monotonically increasing DB object |
| **Concurrency safety** | ✅ `nextval()` is non-transactional; concurrent callers never receive the same value |
| **Format** | ✅ Supports `MRN-YYYY-NNNNN` naturally |
| **Human usability** | ✅ Short, numeric suffix; no ambiguous characters |
| **Enumeration risk** | ⚠️ Fully enumerable — sequential from 1 each year. Exposes patient volume. |
| **Rollback behavior** | ❌ If registration transaction rolls back (e.g., audit write fails), the sequence value is **consumed and wasted**. Gaps appear in MRN numbering. |
| **DB guarantees** | ✅ Native PostgreSQL primitive; persists across restarts |
| **Operational complexity** | ✅ Low — standard PostgreSQL object, backed up automatically |
| **Migration complexity** | ✅ Low — one `CREATE SEQUENCE` per year; Drizzle `sql` migration file |
| **ADR-002 alignment** | ✅ PostgreSQL native |

**Key concern:** Gaps in MRN numbering may cause audit or compliance confusion ("why does no patient have MRN-2026-00012?"). The `UNIQUE` constraint on `mrn` column already enforces uniqueness as a safety net.

---

### Option 2: Dedicated Sequence Table + `SELECT … FOR UPDATE`

**Mechanism:** A table `mrn_sequences(year INT PRIMARY KEY, last_seq INT NOT NULL DEFAULT 0)` tracks the last issued sequence per year. Registration acquires a row lock with `SELECT ... FOR UPDATE`, increments by 1, formats the MRN, and releases within the main transaction.

| Criterion | Assessment |
|:---|:---|
| **Uniqueness** | ✅ Guaranteed within the transaction |
| **Concurrency safety** | ✅ Row lock serializes concurrent registrations per year |
| **Format** | ✅ Supports `MRN-YYYY-NNNNN` naturally |
| **Human usability** | ✅ Same as Option 1 |
| **Enumeration risk** | ⚠️ Same as Option 1 — fully sequential and enumerable |
| **Rollback behavior** | ✅ If the outer transaction rolls back, the `last_seq` update rolls back too — **no gaps** |
| **DB guarantees** | ✅ Standard ACID transactional guarantee |
| **Operational complexity** | ⚠️ Medium — requires the `mrn_sequences` table to be seeded per year; serializes all concurrent registrations onto a single row lock (potential bottleneck at high volume) |
| **Migration complexity** | ⚠️ Medium — new table + initial seed row; must be applied before any patient can be registered |
| **ADR-002 alignment** | ✅ |

**Key concern:** All concurrent registrations contend for the same row lock on the current year's row. At peak load this is a serialization bottleneck. Deadlock risk if combined with other locked tables (e.g., `audit_events`).

---

### Option 3: UUID-based / ULID / Hashid Public MRN

**Mechanism:** MRN is derived from an unpredictable identifier: either (a) the patient's UUID cast via Hashids/Base62 to a fixed-width alphanumeric, or (b) a ULID truncated and formatted.

| Criterion | Assessment |
|:---|:---|
| **Uniqueness** | ✅ UUID-collision probability is negligible in practice |
| **Concurrency safety** | ✅ No central lock or sequence needed |
| **Format** | ❌ Cannot produce `MRN-YYYY-NNNNN` format. Format would be `MRN-ABC12XY45` or similar alphanumeric |
| **Human usability** | ❌ Alphanumeric strings are difficult to dictate verbally (I/l/1, O/0). Cognitively harder for clinical staff. |
| **Enumeration risk** | ✅ Non-enumerable — no patient volume leakage |
| **Rollback behavior** | ✅ UUID generated before insert — if transaction rolls back, identifier is simply discarded |
| **DB guarantees** | ⚠️ Relies on UUID collision resistance; still requires `UNIQUE` constraint |
| **Operational complexity** | ✅ Low — no additional DB objects needed |
| **Migration complexity** | ✅ Low — just changes application logic, schema unchanged |
| **ADR-002 alignment** | ✅ |

**Key concern:** Fails the human usability and format requirements. Clinical staff routinely dictate MRNs over phone during emergencies. An alphanumeric MRN of `MRN-R7K2P9A1C3` is unacceptable. Blocked unless architecture formally allows format change.

---

### Option 4: Database-Generated Trigger (`BEFORE INSERT`)

**Mechanism:** A PostgreSQL `BEFORE INSERT` trigger on `patients` reads the current year's max sequence from the table and assigns `MRN-YYYY-{next}`. Application sends no MRN; trigger populates it.

| Criterion | Assessment |
|:---|:---|
| **Uniqueness** | ❌ Trigger runs per-row but does NOT guarantee uniqueness under concurrent inserts unless it locks internally |
| **Concurrency safety** | ❌ Two concurrent `INSERT` statements can both fire the trigger before either commits, reading the same max sequence |
| **Format** | ✅ Trigger can produce any desired format |
| **Human usability** | ✅ If format is sequential integers, same usability as Options 1/2 |
| **Enumeration risk** | ⚠️ Same as Options 1/2 |
| **Rollback behavior** | ✅ Trigger runs inside the transaction, so rollback discards the assignment |
| **DB guarantees** | ❌ **Does not solve the concurrency problem** — the trigger itself has the same MAX+1 race unless it internally uses a SEQUENCE or a lock |
| **Operational complexity** | ⚠️ High — DB trigger is opaque to the application; Drizzle cannot easily RETURNING trigger-mutated columns without explicit config |
| **Migration complexity** | ⚠️ Medium — requires custom migration SQL; trigger must be maintained across schema changes |
| **ADR-002 alignment** | ⚠️ Against principle of keeping business logic in application layer |

**Key concern:** This option merely relocates the problem into a trigger. It does NOT solve concurrency unless the trigger internally uses Option 1 or 2. It adds operational opacity. **Not recommended.**

---

## Comparison Summary

| | Option 1: PG SEQUENCE | Option 2: Lock Table | Option 3: UUID/ULID | Option 4: Trigger |
|:---|:---:|:---:|:---:|:---:|
| **Uniqueness** | ✅ | ✅ | ✅ | ❌ |
| **Concurrency safety** | ✅ | ✅ | ✅ | ❌ |
| **Format compliant** | ✅ | ✅ | ❌ | ✅ |
| **Human usability** | ✅ | ✅ | ❌ | ✅ |
| **No enumeration risk** | ❌ | ❌ | ✅ | ❌ |
| **No gaps on rollback** | ❌ | ✅ | ✅ | ✅ |
| **DB native guarantee** | ✅ | ✅ | ⚠️ | ❌ |
| **Low operational complexity** | ✅ | ⚠️ | ✅ | ❌ |
| **Low migration complexity** | ✅ | ⚠️ | ✅ | ⚠️ |

---

## Open Questions for Decision

1. **Are gaps in MRN numbering acceptable?** If yes → Option 1 (SEQUENCE) is simplest. If no → Option 2 (lock table).
2. **Is enumeration risk a privacy/compliance concern?** If yes → only Option 3 qualifies, but requires relaxing the format requirement.
3. **Can the MRN format be changed** from `MRN-YYYY-NNNNN` to alphanumeric? If yes → Option 3 becomes viable.
4. **What is the expected peak concurrency** for patient registration? Very high peak → prefer Option 1 over Option 2 to avoid lock contention.

---

## Decision

**STATUS: PROPOSED / PENDING APPROVAL**

[No implementation decision has been made. The engineering team and clinical/compliance stakeholders must answer the open questions above before this ADR can be moved to ACCEPTED.]

---

## Consequences (Post-Decision)

- Implementation will require a new Drizzle migration file.
- Patient registration API will remain blocked (throwing a hard error) until the approved mechanism is implemented and tested.
- M2 schema (`patients` table) is unchanged regardless of which option is chosen — the `mrn VARCHAR(20) NOT NULL UNIQUE` constraint remains valid for all options.
- Concurrent registration test suite must be written and pass before the patient module can be considered complete.
