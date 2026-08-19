# Security Rules

> **Authority Level:** DOMAIN — Second only to Core Rules on safety matters. Security rules override engineering convenience and feature velocity.

## Fundamental Principle

Healthcare data is highly sensitive by default. Every component must be designed with the assumption that it handles protected health information (PHI) and personally identifiable information (PII).

## Authentication

- Every API endpoint must require authentication unless explicitly designated as public (and public endpoints must be documented and reviewed).
- Authentication tokens must have bounded lifetimes.
- Token refresh must be implemented securely; refresh tokens must be stored securely and rotated.
- Multi-factor authentication must be supported for privileged roles.
- Failed authentication attempts must be logged and rate-limited.
- Session invalidation must be immediate and complete (server-side session state, not just client-side token deletion).

## Authorization

- Authentication proves identity; authorization determines access. Both are required.
- Every API endpoint must enforce authorization checks.
- Authorization must be checked at the API layer, not just the UI layer.
- Hiding a UI element is not authorization; the backend must independently enforce access control.
- Authorization logic must be centralized, not duplicated across controllers.

## Role-Based Access Control (RBAC)

- Define clear roles with explicit permissions.
- Follow the principle of least privilege: grant the minimum permissions necessary for a role.
- Role assignments must be auditable.
- Role changes must require authorized approval.
- Do not create overly broad roles (e.g., "admin" with unrestricted access); segment privileges.
- Temporary role elevation must have automatic expiration.

## Least Privilege

- Every service, user, and automated process must operate with the minimum permissions required.
- Database connections must use role-specific credentials, not superuser accounts.
- API keys must be scoped to specific operations.
- File system access must be limited to required paths.

## Secrets Management

- Never hardcode secrets (API keys, passwords, tokens, certificates) in source code.
- Never commit secrets to version control.
- Use environment variables or a secrets management service.
- Rotate secrets on a defined schedule.
- Revoke compromised secrets immediately.
- Log secret access (not the secret value).
- Never log secret values.

## Encryption

- Encrypt sensitive data at rest using industry-standard algorithms.
- Encrypt all data in transit using TLS.
- Manage encryption keys securely with proper rotation.
- Do not implement custom cryptographic algorithms.
- Use established cryptographic libraries.

## Secure APIs

- Validate all input at the API boundary.
- Sanitize output to prevent injection.
- Enforce request size limits.
- Implement rate limiting.
- Return minimal error information to clients (no stack traces, no internal paths, no schema details).
- Use consistent error response formats.
- Document security requirements for every endpoint.

## Input Validation

- Validate all input: type, format, range, length.
- Validate on the server side; client-side validation is a UX feature, not a security control.
- Reject invalid input; do not attempt to sanitize and proceed.
- Use allowlists over denylists where possible.
- Validate file uploads: type, size, content (not just extension).

## Injection Prevention

- Use parameterized queries for all database operations; never construct queries with string concatenation.
- Sanitize all output rendered in HTML to prevent XSS.
- Validate and sanitize file paths to prevent path traversal.
- Sanitize input used in system commands to prevent command injection.
- Validate and sanitize data used in AI prompts to prevent prompt injection.

## Session Security

- Generate cryptographically random session identifiers.
- Enforce session timeout for inactive sessions.
- Invalidate sessions on logout, password change, and role change.
- Bind sessions to client characteristics where practical (IP, user agent).
- Protect session tokens from XSS (HttpOnly, Secure, SameSite flags).

## Audit Logging

- Log all authentication events (success and failure).
- Log all authorization failures.
- Log all access to sensitive data.
- Log all administrative actions.
- Log all data modifications.
- Audit logs must be immutable and tamper-evident.
- Audit logs must not contain sensitive data values (log the access, not the data).
- Audit log infrastructure failure is a critical system failure.

## Sensitive Data Handling

- Classify data by sensitivity level.
- Apply appropriate controls based on classification.
- Minimize data collection to what is necessary.
- Define and enforce data retention policies.
- Implement secure data deletion when retention period expires.
- Never expose sensitive data in URLs, logs, error messages, or client-side storage.

## Dependency Security

- Audit dependencies for known vulnerabilities before adoption.
- Monitor dependencies for newly disclosed vulnerabilities.
- Pin dependency versions; do not use floating version ranges in production.
- Minimize the number of dependencies.
- Prefer well-maintained dependencies with active security response.

## Security Testing

- Include security test cases in the test suite.
- Test authentication bypass scenarios.
- Test authorization escalation scenarios.
- Test injection vectors.
- Test rate limiting effectiveness.
- Perform dependency vulnerability scanning in CI.
- Conduct threat modeling for new features.

## Threat Modeling

- Identify assets (what needs protection).
- Identify threats (who might attack, how).
- Identify vulnerabilities (where the system is exposed).
- Define mitigations for each identified threat.
- Review and update threat models when architecture changes.
- Document accepted risks with justification.
