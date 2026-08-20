# Code Review Skill

## Purpose

Provide expert guidance for reviewing code changes for correctness, quality, security, maintainability, and adherence to project standards.

## When to Use

- Reviewing any code change before merge.
- Self-reviewing code before submission.
- Reviewing code as part of a feature development workflow.

## When NOT to Use

- For security-specific deep review (use security-engineering skill in addition).
- For AI-specific evaluation (use ai-evaluation skill in addition).
- For design review (use ux-design skill).

## Inputs

- Code diff (changed files).
- Task description or feature specification.
- Relevant test changes.

## Preconditions

- The code must compile/build successfully.
- Automated tests must be passing.
- The code must be the author's best effort (not a draft for review-driven development).

## Responsibilities

### Correctness
- Does the code implement the specified behavior?
- Does it handle all specified acceptance criteria?
- Are there logic errors, off-by-one errors, or missed conditions?
- Does it handle null, undefined, empty, and boundary values?

### Architecture
- Does the change follow established patterns?
- Does it maintain separation of concerns?
- Does it introduce unnecessary complexity?
- Does it create new dependencies that are justified?
- Is the change in the right module/layer?

### Error Handling
- Are all error paths handled?
- Are error messages meaningful and safe (no sensitive data)?
- Are errors logged with sufficient context?
- Are external call errors handled (timeout, retry, fallback)?

### Security
- Is input validated?
- Is authorization enforced?
- Are there injection vulnerabilities?
- Is sensitive data properly handled (not logged, not exposed)?
- Are secrets hardcoded?

### Testing
- Are there tests for the change?
- Do tests cover success and failure paths?
- Are tests meaningful (not just asserting that code runs)?
- Are edge cases tested?

### Maintainability
- Is the code readable without the author explaining it?
- Are names descriptive and consistent?
- Is there unnecessary duplication?
- Are functions appropriately sized?
- Are comments useful (explaining why, not what)?

### Performance
- Are there obvious performance issues (N+1 queries, unnecessary computation, missing pagination)?
- Are there missing indexes for new queries?
- Is caching appropriate?

### Healthcare Safety
- If the change involves patient data: is access control enforced? Is audit logging present?
- If the change involves clinical workflows: is human approval enforced where required?
- If the change involves AI: is output validation present?

## Workflow

1. **Understand context**: Read the task description and understand the intended change.
2. **Review structure**: Check file organization, module boundaries, architecture.
3. **Review logic**: Check correctness, error handling, edge cases.
4. **Review security**: Check validation, authorization, data handling.
5. **Review tests**: Check coverage, meaningfulness, edge cases.
6. **Review healthcare safety**: If applicable, check clinical safety controls.
7. **Provide feedback**: Clear, actionable, and specific.

## Decision Rules

- If a change is correct but architecturally wrong → request restructuring.
- If a change has no tests → request tests before approving.
- If a change has a security gap → block until fixed.
- If a change affects patient data without audit logging → block until fixed.
- Minor style issues → suggest but do not block.

## Related Rules

- `.claude/rules/core.md`
- `.claude/rules/engineering.md`
- `.claude/rules/security.md`
- `.claude/rules/healthcare.md`

## Related Agents

- `code-reviewer` — primary user of this skill.

## Verification Checklist

- [ ] Code implements specified behavior.
- [ ] Error handling is complete.
- [ ] Security controls are present.
- [ ] Tests are meaningful and passing.
- [ ] No sensitive data in logs or responses.
- [ ] Architecture and patterns followed.
- [ ] Healthcare safety verified (if applicable).
