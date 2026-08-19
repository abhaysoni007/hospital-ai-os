# Security Engineering Skill

## Purpose

Provide expert guidance for threat modeling, security design, vulnerability prevention, and security review within Hospital AI OS.

## When to Use

- Designing authentication or authorization systems.
- Implementing access control.
- Handling sensitive data (PHI, PII, credentials).
- Reviewing code for security vulnerabilities.
- Conducting threat modeling for new features.
- Implementing audit logging.
- Evaluating dependency security.

## When NOT to Use

- For general code quality review (use code-review skill).
- For AI-specific safety evaluation (use ai-evaluation skill, though coordinate on prompt injection).
- For UI visual design (use ui-engineering skill).

## Inputs

- Feature specification with security implications.
- System architecture diagrams (data flows, trust boundaries).
- User roles and permission requirements.
- Data classification (what is sensitive).
- Threat model (if existing).

## Preconditions

- Data handled by the feature must be classified by sensitivity.
- User roles interacting with the feature must be defined.
- System boundaries and external integrations must be identified.

## Responsibilities

### Threat Modeling

Use a structured approach for every new feature or architecture change:

1. **Identify assets**: What needs protection? (patient data, credentials, system integrity, availability)
2. **Identify entry points**: Where can attackers interact with the system? (APIs, UI inputs, file uploads, webhooks, AI prompts)
3. **Identify threats**: Use STRIDE categories:
   - **S**poofing: Can an attacker impersonate another user or system?
   - **T**ampering: Can an attacker modify data in transit or at rest?
   - **R**epudiation: Can an actor deny performing an action?
   - **I**nformation disclosure: Can sensitive data leak?
   - **D**enial of service: Can an attacker make the system unavailable?
   - **E**levation of privilege: Can an attacker gain unauthorized access?
4. **Assess risk**: Likelihood × impact for each threat.
5. **Define mitigations**: Specific controls for each identified threat.
6. **Document accepted risks**: Risks that are not mitigated must be explicitly accepted with justification.

### Authentication

- Verify that authentication is enforced on every non-public endpoint.
- Verify token generation uses cryptographically secure methods.
- Verify token lifetimes are bounded and appropriate.
- Verify failed authentication handling (lockout, rate limiting, logging).
- Verify session management (creation, validation, invalidation, timeout).
- Verify multi-factor authentication for privileged roles.

### Authorization

- Verify authorization checks exist at the API layer (not just UI).
- Verify least-privilege principle is followed.
- Verify role definitions are granular enough for the use case.
- Verify resource-level authorization (can this user access this specific record?).
- Verify that permission changes take effect immediately or within a defined window.

### Secrets Management

- Verify no secrets in source code, configuration files committed to VCS, or logs.
- Verify secrets are loaded from environment variables or a secrets management service.
- Verify secrets have rotation policies.
- Verify revoked secrets are actually revoked (not just removed from config).

### Data Protection

- Verify PHI/PII is encrypted at rest and in transit.
- Verify sensitive data is not exposed in: logs, error messages, URLs, client-side storage, analytics.
- Verify data access is logged (audit trail).
- Verify data retention and deletion policies are implementable.

### Injection Prevention

- Verify parameterized queries for all database operations.
- Verify output encoding for HTML contexts (XSS prevention).
- Verify input validation and sanitization.
- Verify file upload validation (type, size, content scanning).
- Verify prompt injection prevention for AI features.

### Audit Logging

- Verify audit events are generated for: authentication, authorization failures, data access, data modifications, administrative actions, security-relevant events.
- Verify audit logs are immutable.
- Verify audit logs do not contain sensitive data values.
- Verify audit log infrastructure failure is detected and alerted.

### Dependency Security

- Verify dependencies are scanned for known vulnerabilities.
- Verify dependency versions are pinned.
- Verify new dependencies are audited before adoption.

## Workflow

1. **Classify data**: Identify sensitive data involved in the feature.
2. **Threat model**: Apply STRIDE analysis to the feature.
3. **Define controls**: Specify security controls for each identified threat.
4. **Review implementation**: Verify controls are correctly implemented.
5. **Test**: Run security test cases.
6. **Document**: Record threat model, controls, accepted risks.

## Decision Rules

- If a feature handles PHI → require encryption, access control, audit logging, and security review.
- If a feature has an external-facing API → require authentication, authorization, rate limiting, and input validation.
- If a feature accepts user input → verify injection prevention.
- If a feature introduces a new dependency → audit for known vulnerabilities.
- If a threat has high likelihood and high impact → mitigation is mandatory.

## Safety Constraints

- Never skip security review for features handling sensitive data.
- Never accept "security through obscurity" as a mitigation.
- Never store passwords in plaintext or reversible encryption.
- Never disable security controls for convenience during development.

## Validation

- [ ] Threat model completed for the feature.
- [ ] Authentication enforced.
- [ ] Authorization enforced at API layer.
- [ ] Sensitive data encrypted and protected.
- [ ] Injection prevention verified.
- [ ] Audit logging implemented.
- [ ] Security test cases passing.
- [ ] Dependencies audited.

## Expected Output

- Threat model document.
- Security controls specification.
- Security test cases.
- Audit logging specification.

## Failure Handling

- If a critical vulnerability is found → block deployment until fixed.
- If threat model reveals unmitigatable risks → escalate to Technical Lead and stakeholders.
- If security requirements conflict with UX → escalate; do not silently weaken security.

## Related Rules

- `.claude/rules/security.md`
- `.claude/rules/healthcare.md`
- `.claude/rules/engineering.md`

## Related Agents

- `security-engineer` — primary user of this skill.
- `backend-engineer` — implements security controls.
- `code-reviewer` — reviews security aspects during code review.

## Related Workflows

- `.claude/workflows/security-review.md`
- `.claude/workflows/feature-development.md`

## Verification Checklist

- [ ] Threat model completed.
- [ ] All identified threats have mitigations or accepted-risk documentation.
- [ ] Authentication and authorization verified.
- [ ] Data protection verified.
- [ ] Injection prevention verified.
- [ ] Audit logging verified.
- [ ] Security tests passing.
