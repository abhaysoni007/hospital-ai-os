# Testing Rules

> **Authority Level:** ENGINEERING — Governed by Core, Healthcare, and Security Rules.

## Testing Philosophy

Testing validates that the system behaves correctly, safely, and reliably under expected, unexpected, and adversarial conditions. Code coverage is a metric, not a goal; behavioral coverage is the goal.

## Unit Tests

- Every module with business logic must have unit tests.
- Unit tests must be fast (milliseconds, not seconds).
- Unit tests must be isolated: no database, no network, no file system.
- Unit tests must test behavior (given input X, expect output Y), not implementation details.
- Mock external dependencies; do not mock the unit under test.

## Integration Tests

- Test interactions between modules: service-to-database, service-to-service, service-to-external-API.
- Integration tests must verify data flows correctly across boundaries.
- Integration tests must verify error propagation across boundaries.
- Use test databases/containers, not production resources.

## API Tests

- Every API endpoint must have tests covering: valid requests, invalid requests, authentication, authorization, error responses.
- Test request validation: missing fields, invalid types, boundary values.
- Test response contracts: status codes, response body structure, headers.
- Test rate limiting and request size limits.

## Component Tests (Frontend)

- Test components in isolation with controlled props and state.
- Test user interactions: clicks, form submissions, navigation.
- Test all visual states: loading, empty, error, success, partial data.
- Test accessibility attributes.

## End-to-End Tests

- Cover critical user workflows from start to finish.
- E2E tests must reflect real user behavior.
- E2E tests must cover the primary success path and the most important failure paths.
- Keep E2E tests focused; do not test every edge case via E2E.
- E2E tests must be maintainable and not brittle.

## AI Evaluation

- AI features must have evaluation datasets with known expected outputs.
- Evaluate: correctness, safety, consistency, robustness, latency, cost.
- Test with adversarial inputs: prompt injection, misleading context, edge cases.
- Test model fallback behavior.
- Test behavior when AI service is unavailable.
- Run evaluations on prompt changes and model changes before deployment.

## Security Tests

- Test authentication bypass scenarios.
- Test authorization escalation scenarios.
- Test injection vulnerabilities (SQL, XSS, command, prompt).
- Test sensitive data exposure in responses, logs, and errors.
- Test rate limiting and abuse prevention.
- Test session management (timeout, invalidation, hijacking).

## Regression Tests

- When a bug is fixed, add a test that reproduces the original bug.
- Regression tests must run in CI on every change.
- Do not delete regression tests without explicit justification.

## Edge Cases

- Identify edge cases during design, not after deployment.
- Test boundary values (empty, null, zero, maximum, negative).
- Test concurrent operations (race conditions, duplicate submissions).
- Test with missing or incomplete data.
- Test with malformed data.
- Test with unexpected state transitions.

## Failure Scenarios

- Test what happens when external services are unavailable.
- Test what happens when the database is unreachable.
- Test what happens when AI services return errors.
- Test what happens when network requests timeout.
- Test what happens when disk space is exhausted.
- Test what happens when authentication tokens expire mid-operation.

## Healthcare Safety Tests

- Test that clinical recommendations require human approval before becoming actions.
- Test that patient data access is restricted by role.
- Test that audit logs are created for all sensitive operations.
- Test that emergency access (break-glass) works and generates alerts.
- Test that conflicting clinical data is surfaced, not silently resolved.
- Test that patient-facing communications do not contain unapproved clinical information.

## Test Quality

- Tests must have clear names that describe the scenario and expected outcome.
- Tests must be deterministic: no flaky tests.
- Tests must be independent: no test should depend on another test's outcome.
- Failing tests must produce actionable error messages.
- Test code must be maintained with the same quality standards as production code.
