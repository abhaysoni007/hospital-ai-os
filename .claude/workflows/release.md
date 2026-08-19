# Release Workflow

## Trigger

Release milestone reached; features are complete and ready for deployment.

## Agents Involved

- **Release Manager** — coordinates the release.
- **QA Engineer** — final quality verification.
- **Security Engineer** — security clearance.
- **Performance Reviewer** — performance clearance.
- **AI Safety Reviewer** — AI safety clearance (if AI features included).
- **Accessibility Reviewer** — accessibility clearance (if UI changes included).
- **DevOps Engineer** — deployment execution.
- **Project Manager** — communicates release status.

## Phases

### 1. Feature Freeze

- No new features merged after the freeze point.
- Only bug fixes and release preparation changes allowed.
- All features intended for this release are merged and tested.

### 2. Test

- QA Engineer runs the full test suite.
- Integration tests pass.
- E2E tests for critical workflows pass.
- Healthcare safety tests pass.
- Regression tests pass.
- All acceptance criteria for included features verified.

### 3. Security Review

- Security Engineer reviews changes since last release.
- Dependency vulnerability scan.
- No critical or high-severity security issues.
- Security checklist completed (`.claude/checklists/SECURITY_REVIEW.md`).

### 4. Performance Review

- Performance Reviewer validates critical path performance.
- No performance regressions from baseline.
- Performance budgets met.

### 5. AI Safety Review (if applicable)

- AI Safety Reviewer validates AI features included in the release.
- AI evaluation passes thresholds.
- AI safety checklist completed (`.claude/checklists/AI_REVIEW.md`).

### 6. Accessibility Review (if UI changes)

- Accessibility Reviewer validates UI changes.
- WCAG 2.1 AA compliance maintained.
- UI review checklist completed (`.claude/checklists/UI_REVIEW.md`).

### 7. Release Candidate

- Create release candidate build.
- Deploy to staging environment.
- Smoke test on staging.
- Verify environment configuration.

### 8. Verification

- Release Manager verifies all quality gates passed.
- All checklists completed.
- Release notes prepared.
- Changelog updated.
- Rollback plan verified.
- Monitoring and alerting configured for the release.

### 9. Release

- Deploy to production.
- Verify deployment health.
- Monitor error rates, latency, and key metrics.
- Announce release.

### 10. Post-Release Monitoring

- Monitor for 24-48 hours post-release.
- Watch for: error rate increases, latency changes, user-reported issues.
- If critical issues detected → evaluate rollback.
- Document post-release observations.

## Checklists Required

- `.claude/checklists/RELEASE_REVIEW.md`
- `.claude/checklists/SECURITY_REVIEW.md`
- `.claude/checklists/AI_REVIEW.md` (if applicable)
- `.claude/checklists/UI_REVIEW.md` (if applicable)

## Quality Gates

- [ ] All tests passing.
- [ ] Security review approved.
- [ ] Performance verified.
- [ ] AI safety verified (if applicable).
- [ ] Accessibility verified (if applicable).
- [ ] Release notes prepared.
- [ ] Rollback plan verified.
- [ ] Staging verification passed.
- [ ] Monitoring configured.
