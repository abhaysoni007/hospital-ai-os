# Security Review Checklist

## Authentication

- [ ] Authentication required on all non-public endpoints.
- [ ] Token generation uses cryptographically secure methods.
- [ ] Token lifetimes are bounded and appropriate.
- [ ] Failed authentication is rate-limited and logged.
- [ ] Session invalidation works correctly (logout, password change, timeout).

## Authorization

- [ ] Authorization checked at API layer (not just UI).
- [ ] Least-privilege principle followed.
- [ ] Resource-level authorization enforced (user can only access their own data).
- [ ] Permission changes take effect within defined timeframe.
- [ ] Authorization failures are logged.

## RBAC

- [ ] Roles are granular and well-defined.
- [ ] No overly broad roles with unrestricted access.
- [ ] Role assignments are auditable.
- [ ] Temporary elevated access has automatic expiration.

## Sensitive Data

- [ ] Data classified by sensitivity (PHI, PII, operational, public).
- [ ] PHI/PII encrypted at rest and in transit.
- [ ] Sensitive data not in logs, error messages, URLs, or client-side storage.
- [ ] Data retention policies defined and implementable.
- [ ] Data deletion is secure (not just soft-delete for sensitive data).

## Secrets

- [ ] No secrets in source code or version control.
- [ ] Secrets loaded from environment or secrets management service.
- [ ] Secrets have rotation policies.
- [ ] Secret access is logged (not the values).

## Injection Prevention

- [ ] SQL queries use parameterized queries (no string concatenation).
- [ ] HTML output is encoded to prevent XSS.
- [ ] File paths are validated to prevent path traversal.
- [ ] System commands are sanitized.
- [ ] AI prompts are protected against prompt injection.

## API Security

- [ ] Input validation at all API boundaries.
- [ ] Request size limits enforced.
- [ ] Rate limiting implemented.
- [ ] Minimal error information returned to clients.
- [ ] CORS configured appropriately.
- [ ] Security headers set (CSP, HSTS, X-Frame-Options).

## Audit Logging

- [ ] Authentication events logged (success and failure).
- [ ] Authorization failures logged.
- [ ] Access to sensitive data logged.
- [ ] Data modifications logged.
- [ ] Administrative actions logged.
- [ ] Audit logs are immutable and tamper-evident.
- [ ] Audit logs do not contain sensitive data values.

## Dependencies

- [ ] Dependencies scanned for known vulnerabilities.
- [ ] Dependency versions pinned.
- [ ] New dependencies audited before adoption.
- [ ] Licenses compatible.

## Rate Limiting

- [ ] Rate limiting on authentication endpoints.
- [ ] Rate limiting on public-facing endpoints.
- [ ] Rate limiting appropriate for the endpoint's use case.

## Abuse Cases

- [ ] Identified potential abuse scenarios.
- [ ] Mitigations in place for identified abuse cases.
- [ ] Account takeover prevention.
- [ ] Data scraping prevention.

## Threat Model

- [ ] Assets identified.
- [ ] Threats identified (STRIDE analysis).
- [ ] Risks assessed (likelihood × impact).
- [ ] Mitigations defined for each threat.
- [ ] Accepted risks documented with justification.
