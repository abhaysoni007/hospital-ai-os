# Security Review Workflow

## Trigger

Feature with security implications, architecture change affecting trust boundaries, or periodic security assessment.

## Agents Involved

- **Security Engineer** — conducts the review.
- **Technical Lead** — approves security architecture decisions.
- **Relevant Engineers** — provide context and implement fixes.

## Phases

### 1. Scope

- Identify assets, entry points, and trust boundaries.
- Identify data sensitivity classification.
- Identify user roles and permissions involved.

### 2. Threat Model

- Apply STRIDE analysis.
- Identify threats for each entry point.
- Assess risk: likelihood × impact.

### 3. Review Controls

- Verify authentication enforcement.
- Verify authorization enforcement.
- Verify input validation and injection prevention.
- Verify sensitive data handling.
- Verify audit logging.
- Verify dependency security.

### 4. Report

- Document findings with severity classification.
- Document recommendations.
- Document accepted risks (if any) with justification.

### 5. Remediate

- Engineers implement fixes for identified issues.
- Security Engineer verifies fixes.

### 6. Verify

- Run security test cases.
- Verify all critical and high-severity findings are addressed.
- Complete security review checklist.

## Checklists Required

- `.claude/checklists/SECURITY_REVIEW.md`

## Quality Gates

- [ ] Threat model completed.
- [ ] No unaddressed critical or high-severity findings.
- [ ] Security test cases passing.
- [ ] Security review checklist completed.
