# ADR 021: Break-Glass Emergency Access

## Status
Accepted

## Context
Hospital AI OS operates with a strict, deny-by-default role-based access control (RBAC) model. However, in acute clinical settings, rigid authorization boundaries can occasionally endanger patient safety. For example, an ER physician might need immediate access to a patient's historical records outside their assigned department to make life-saving decisions, or a covering nurse may require access during an unexpected shift change.

We need a mechanism to allow authorized clinicians to bypass strict department/assignment-level scoping in emergency scenarios, without compromising the integrity of the audit log or turning into a generic authorization bypass.

## Decision
We will implement a **Break-Glass Emergency Access** system with the following characteristics:

1. **Patient-Scoped Reactivity**: Break-Glass is not a blanket privilege escalation. It grants a temporary, read-only session scoped strictly to a single `patientId`.
2. **Explicit Activation**: Clinicians must explicitly activate a break-glass session by providing a valid clinical reason (e.g., `emergency_care`, `patient_safety`, `continuity_of_care`) and a detailed justification (min 20 characters).
3. **Hard Fallback Pattern**: Break-Glass never bypasses authentication or the foundational M5 RBAC permission matrix. It acts solely as a fallback when ordinary resource-level authorization (M6-M10 scope checks) denies access.
4. **Time-Bounded**: Sessions expire automatically after 4 hours. The server manages all duration and expiry logic using `NOW() + interval '4 hours'`; client timestamps are ignored.
5. **Full Auditability**: Every activation and every subsequent clinical read utilizing a break-glass session is cryptographically logged. The `breakGlassSessionId` is injected into the existing M13 clinical audit event payloads.
6. **Concurrency Safety**: To prevent duplicate active sessions for the same actor-patient pair, we use PostgreSQL's `pg_advisory_xact_lock(hashtext(actorId || patientId))` during the activation transaction. This avoids using `NOW()` in partial indexes (which is disallowed in Postgres) while guaranteeing deterministic conflict resolution.
7. **Privacy Preservation**: The clinical justification is highly sensitive. It is excluded from standard audit payloads and is only accessible via a dedicated, permission-gated (`break_glass:review`) review API for security administrators.

## Consequences

**Positive:**
- Clinicians can safely access necessary records in life-threatening emergencies.
- Patient privacy is maintained through strict auditing and rigorous justification requirements.
- The core M5 authorization model and previously frozen milestones (M8-M13) remain completely unmodified, reducing regression risk.
- Security administrators gain full visibility into emergency access patterns and can revoke sessions instantly.

**Negative:**
- Adds complexity to the resource authorization middleware (`authorizeBreakGlassResourceAccess`), which must now wrap existing scope checks.
- Adds an additional database query to check for active sessions when normal scope checks fail.
