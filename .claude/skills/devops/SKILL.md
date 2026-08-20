# DevOps Skill

## Purpose

Provide expert guidance for build systems, deployment pipelines, infrastructure, monitoring, and operational reliability for Hospital AI OS.

## When to Use

- Setting up or modifying CI/CD pipelines.
- Configuring deployment environments.
- Implementing monitoring and alerting.
- Managing infrastructure as code.
- Troubleshooting operational issues.
- Planning disaster recovery and rollback strategies.

## When NOT to Use

- For application logic implementation (use the relevant engineering skill).
- For security architecture (use security-engineering skill, though coordinate on infrastructure security).

## Inputs

- Application architecture and deployment requirements.
- Environment requirements (development, staging, production).
- Monitoring and alerting requirements.
- Compliance requirements (data residency, availability).

## Preconditions

- Application architecture must be defined enough to determine deployment topology.
- Environment requirements must be specified.

## Responsibilities

### CI/CD Pipeline

- Build pipeline: lint → type check → unit test → integration test → build.
- Deploy pipeline: build → security scan → deploy to staging → smoke test → deploy to production.
- Pipeline must fail fast: if any stage fails, stop.
- Pipeline status must be visible to the team.
- Pipeline configuration must be version-controlled.

### Environment Management

- Define environments: development, staging, production.
- Environment configuration must be externalized (environment variables, config files), not hardcoded.
- Staging must closely mirror production.
- Secrets must be managed through a secrets management service, not in configuration files.

### Monitoring and Alerting

- Monitor: application health, error rates, response latency, resource utilization, external dependency status.
- Alert on: error rate spikes, latency exceeding budget, service unavailability, resource exhaustion.
- Use structured metrics and dashboards.
- Healthcare-specific: alert on audit logging failures, authentication anomalies, PHI access anomalies.

### Infrastructure as Code

- All infrastructure should be defined as code (reproducible, reviewable, version-controlled).
- Infrastructure changes should go through the same review process as code changes.
- Document infrastructure dependencies and constraints.

### Rollback Strategy

- Every deployment must have a rollback plan.
- Rollback should be fast (minutes, not hours).
- Database migrations must support rollback.
- Define rollback criteria: what conditions trigger a rollback.
- Test rollback procedures regularly.

### Disaster Recovery

- Define RPO (Recovery Point Objective) and RTO (Recovery Time Objective).
- Implement automated backups with tested restore procedures.
- Document disaster recovery procedures.
- Test recovery procedures periodically.

### Operational Reliability

- Implement health check endpoints for all services.
- Implement graceful shutdown (drain connections, complete in-flight requests).
- Implement log aggregation and centralized logging.
- Define on-call procedures and escalation paths.

## Workflow

1. **Assess requirements**: Understand deployment topology, environments, monitoring needs.
2. **Configure pipeline**: Set up CI/CD with all required stages.
3. **Configure environments**: Set up with externalized configuration.
4. **Configure monitoring**: Dashboards, alerts, log aggregation.
5. **Document**: Runbooks, deployment procedures, rollback procedures.
6. **Test**: Verify pipeline, deployment, monitoring, rollback.

## Related Rules

- `.claude/rules/engineering.md`
- `.claude/rules/security.md`

## Related Agents

- `devops-engineer` — primary user of this skill.
- `release-manager` — coordinates releases.
- `security-engineer` — reviews infrastructure security.

## Verification Checklist

- [ ] CI/CD pipeline configured and tested.
- [ ] Environments configured with externalized secrets.
- [ ] Monitoring and alerting operational.
- [ ] Rollback procedures defined and tested.
- [ ] Backup and recovery procedures defined.
- [ ] Infrastructure defined as code.
- [ ] Runbooks documented.
