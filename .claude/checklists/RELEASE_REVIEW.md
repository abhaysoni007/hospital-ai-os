# Release Review Checklist

## Tests

- [ ] All unit tests passing.
- [ ] All integration tests passing.
- [ ] All API tests passing.
- [ ] All E2E tests for critical workflows passing.
- [ ] All regression tests passing.
- [ ] Healthcare safety tests passing.
- [ ] No skipped or disabled tests without documented justification.

## Security

- [ ] Security review completed for changes in this release.
- [ ] Dependency vulnerability scan passed (no critical/high unaddressed).
- [ ] No secrets in source code.
- [ ] Authentication and authorization verified.
- [ ] Audit logging operational.
- [ ] Security checklist (`.claude/checklists/SECURITY_REVIEW.md`) completed.

## Performance

- [ ] Performance regression testing passed.
- [ ] Critical path latency within budget.
- [ ] No N+1 queries or performance anti-patterns introduced.
- [ ] Database query performance verified.

## Migrations

- [ ] Database migrations tested (up and down).
- [ ] Migrations tested against realistic data volumes.
- [ ] Migration backward compatibility verified.
- [ ] Migration rollback tested.

## Environment Configuration

- [ ] Environment variables documented.
- [ ] Configuration differences between staging and production documented.
- [ ] Secrets rotated if needed.
- [ ] Feature flags configured correctly.

## Monitoring

- [ ] Health check endpoints operational.
- [ ] Monitoring dashboards configured for new features.
- [ ] Alerts configured for error rates, latency, and critical failures.
- [ ] Log aggregation operational.

## Rollback

- [ ] Rollback plan documented.
- [ ] Rollback procedure tested.
- [ ] Rollback criteria defined (what triggers a rollback).
- [ ] Database rollback feasible (migration down tested).

## Documentation

- [ ] Release notes prepared.
- [ ] Changelog updated.
- [ ] API documentation current.
- [ ] Architecture documentation current.
- [ ] Runbook updated (if operational changes).

## Known Issues

- [ ] Known issues documented with severity and workarounds.
- [ ] No critical known issues blocking release.
- [ ] Risk assessment for any high-severity known issues.

## Healthcare Safety (if applicable)

- [ ] AI safety review completed for AI features in this release.
- [ ] Clinical workflow changes validated.
- [ ] Human-in-the-loop controls verified.
- [ ] Patient data access controls verified.
- [ ] Audit logging verified for clinical operations.

## Final Verification

- [ ] Release candidate deployed to staging.
- [ ] Smoke tests passed on staging.
- [ ] Release approved by Release Manager.
