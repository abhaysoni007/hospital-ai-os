# Testing Skill

## Purpose

Provide expert guidance for designing and implementing test strategies, test plans, and test cases for Hospital AI OS.

## When to Use

- Designing test strategy for a new feature.
- Writing test cases for any component.
- Reviewing test adequacy.
- Designing end-to-end test scenarios.
- Creating edge case test matrices.
- Testing AI features.
- Testing security controls.

## When NOT to Use

- For production incident investigation (use incident-response workflow).

## Inputs

- Feature specification with acceptance criteria.
- API contracts and data models.
- UI designs and interaction specifications.
- AI feature specifications with evaluation criteria.

## Preconditions

- Acceptance criteria must be defined before writing tests.
- Testable code architecture (dependency injection, mockable interfaces).

## Responsibilities

### Test Strategy Design

- Determine the right mix of test types for each feature: unit, integration, API, component, E2E, AI evaluation, security.
- Prioritize: more unit tests (fast, focused), fewer E2E tests (slow, broad).
- Define what each test level validates: unit tests validate logic, integration tests validate boundaries, E2E tests validate workflows.

### Test Case Design

- Derive test cases from acceptance criteria.
- For each test case, define: preconditions, inputs, expected output, postconditions.
- Cover: typical case, boundary cases, error cases, edge cases.
- Name tests descriptively: `should_reject_order_when_patient_allergy_matches_medication`.

### Edge Case Identification

- Apply the edge case philosophy (`.claude/rules/EDGE_CASE_PHILOSOPHY.md`).
- For every feature, systematically consider: missing data, invalid data, concurrent access, permission changes, external system failures, AI uncertainty.
- Document identified edge cases in the test plan.

### Healthcare-Specific Testing

- Test that clinical actions require human approval.
- Test that patient data access is role-restricted.
- Test that audit logs are created for sensitive operations.
- Test that clinical alerts cannot be silently dismissed.
- Test that conflicting clinical data is surfaced.
- Test wrong-patient-prevention mechanisms.

### AI Testing

- Follow the ai-evaluation skill for AI-specific testing.
- Test AI output validation (schema compliance, business rule compliance).
- Test AI failure modes (timeout, error, hallucination, low confidence).
- Test AI fallback behavior.
- Test prompt injection resistance.

### Security Testing

- Test authentication enforcement on protected endpoints.
- Test authorization enforcement (role-based, resource-based).
- Test input validation and injection prevention.
- Test sensitive data handling (not in logs, not in error responses).

## Workflow

1. **Review acceptance criteria**: Understand what the feature must do.
2. **Design test strategy**: Determine test types and coverage.
3. **Write test cases**: Typical, boundary, error, edge cases.
4. **Implement tests**: Write automated tests.
5. **Review**: Verify test quality and coverage.
6. **Maintain**: Update tests when behavior changes.

## Decision Rules

- If a feature has clinical impact → add healthcare safety test cases.
- If a feature uses AI → add AI evaluation test cases.
- If a feature handles sensitive data → add security test cases.
- If a feature has complex state → add concurrent access test cases.
- If a bug is fixed → add a regression test.

## Related Rules

- `.claude/rules/testing.md`
- `.claude/rules/healthcare.md`
- `.claude/rules/EDGE_CASE_PHILOSOPHY.md`

## Related Agents

- `qa-engineer` — primary user of this skill.
- `code-reviewer` — reviews test quality.

## Verification Checklist

- [ ] Test strategy defined for the feature.
- [ ] Acceptance criteria covered by test cases.
- [ ] Edge cases identified and tested.
- [ ] Healthcare safety tested (if applicable).
- [ ] AI behavior tested (if applicable).
- [ ] Security controls tested (if applicable).
- [ ] Tests are deterministic and independent.
