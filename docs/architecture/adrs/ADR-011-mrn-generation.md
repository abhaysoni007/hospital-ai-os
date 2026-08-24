# ADR-011: MRN Generation Mechanism

**Status:** PROPOSED / PENDING APPROVAL  
**Date:** 2026-08-24  
**Context:** The Phase 4 Patient Registration vertical slice requires a system-generated Medical Record Number (MRN). The naive implementation (fetching the latest row and incrementing) was rejected as unsafe under concurrent registrations. The architecture specifies MRN as a `VARCHAR(20)` with a format like `MRN-YYYY-XXXXX`, but did not specify the authoritative concurrency-safe database mechanism to generate the sequence.

## Considered Alternatives

1. **PostgreSQL SEQUENCE (`CREATE SEQUENCE`)**
   - **Mechanism:** Create a dedicated sequence `patient_mrn_seq`. Fetch `nextval('patient_mrn_seq')` and format it in the application or DB layer.
   - **Pros:** 
     - Extremely fast and perfectly concurrency-safe.
     - Database-native guarantee of uniqueness.
     - Operational simplicity; survives application restarts.
   - **Cons:** 
     - Sequences can leave gaps if a transaction rolls back (e.g. if the audit event insertion fails, the MRN sequence is still incremented).
     - Predictable format allows enumeration of patient volume.

2. **Dedicated Sequence Table with Row Locks (`SELECT ... FOR UPDATE`)**
   - **Mechanism:** A table specifically tracking the latest MRN sequence per year, locked during the transaction.
   - **Pros:** 
     - No gaps. If the transaction rolls back, the lock is released and the sequence is preserved.
     - Concurrency-safe within a strict transaction boundary.
   - **Cons:** 
     - High contention. Concurrent registrations will serialize, blocking on the lock.
     - Harder to implement and more prone to deadlocks.

3. **UUID-backed / Public MRN Mapping (e.g., Hashids / ULID)**
   - **Mechanism:** MRN is derived from a unique identifier (like ULID) or a hash of the UUID.
   - **Pros:**
     - Absolutely no central lock or sequence coordination needed.
     - Unpredictable and non-enumerable.
   - **Cons:**
     - Non-sequential, which may violate human usability expectations (e.g., clerks expecting `MRN-2026-00001`).
     - Alphanumeric strings can be confusing to dictate verbally (I vs 1, O vs 0).

4. **Database-Generated Default (`nextval` mapped to a custom trigger)**
   - **Mechanism:** DB trigger automatically constructs `MRN-YYYY-XXXXX` on `INSERT`.
   - **Pros:**
     - Application doesn't need to know about the format.
   - **Cons:**
     - Business logic leaks into the database. Drizzle ORM does not easily fetch trigger-mutated fields unless explicitly configured with `RETURNING`.

## Evaluation Criteria
- **Uniqueness & Concurrency Safety:** MUST guarantee no duplicates under high concurrent load.
- **Format Requirements:** MUST support the `MRN-YYYY-XXXXX` architectural format.
- **Human Usability:** MUST be easy for clinical staff to read, write, and dictate.
- **Predictability/Enumeration Risk:** Should mitigate the risk of exposing patient volume, though internal MRNs are often sequential by industry convention.
- **Database Guarantees & Migration Implications:** Must align with our Drizzle ORM migrations and PostgreSQL capabilities.

## Decision
[To be decided based on architectural review. Currently DEFERRED. Patient registration is blocked pending this decision.]

## Consequences
- Patient registration endpoints currently throw a `NotImplementedError` regarding MRN generation to prevent unsafe duplicates.
- Testing of concurrent registrations is blocked.
