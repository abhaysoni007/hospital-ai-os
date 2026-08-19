# Incident Response Workflow

## Trigger

Production incident affecting availability, data integrity, security, or patient safety.

## Agents Involved

- **DevOps Engineer** — infrastructure investigation and remediation.
- **Relevant Engineers** — application investigation and fixes.
- **Security Engineer** — if security-related incident.
- **Technical Lead** — coordinates response for major incidents.
- **Release Manager** — if rollback is needed.

## Phases

### 1. Detect and Classify

- Confirm the incident is real (not a false alarm).
- Classify severity:
  - **Critical**: Patient safety, data breach, complete service outage.
  - **High**: Significant functionality loss, data integrity concern.
  - **Medium**: Degraded performance, non-critical feature failure.
  - **Low**: Minor issue, cosmetic, workaround available.

### 2. Contain

- Prevent the incident from getting worse.
- If data breach: isolate affected systems.
- If service outage: assess rollback feasibility.
- If patient safety: immediately implement safest fallback.
- Communicate status to stakeholders.

### 3. Investigate

- Identify the root cause.
- Gather evidence: logs, metrics, error traces.
- Determine the scope of impact: affected users, data, time window.
- Do not guess at the cause; follow the evidence.

### 4. Remediate

- Implement the fix (or rollback if fix is not immediately available).
- Test the fix in staging before deploying to production.
- Monitor after remediation to confirm resolution.

### 5. Communicate

- Update stakeholders on status throughout.
- Provide resolution communication when resolved.

### 6. Post-Incident Review

- Document: timeline, root cause, impact, remediation steps, detection method.
- Identify: what went wrong, why it was not prevented, why it was not detected sooner.
- Define: action items to prevent recurrence.
- Update: tests, monitoring, alerts, runbooks as needed.

## Quality Gates

- [ ] Incident classified by severity.
- [ ] Root cause identified.
- [ ] Remediation verified in staging.
- [ ] Post-incident review completed.
- [ ] Action items defined and tracked.
