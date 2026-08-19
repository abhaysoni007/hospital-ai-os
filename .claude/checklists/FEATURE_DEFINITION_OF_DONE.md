# Feature Definition of Done

A feature is not complete until all applicable items are verified.

## Requirements

- [ ] Acceptance criteria are defined and agreed upon.
- [ ] All acceptance criteria are met.
- [ ] Edge cases identified during planning are addressed.
- [ ] Scope matches the approved specification (no scope creep, no missing items).

## Architecture

- [ ] Feature follows established architecture and patterns.
- [ ] No unauthorized architectural changes.
- [ ] ADR created if architectural decisions were made.
- [ ] No new circular dependencies introduced.

## Implementation

- [ ] Code follows engineering standards (`.claude/rules/engineering.md`).
- [ ] Input validation at all system boundaries.
- [ ] Error handling covers all failure paths.
- [ ] No hardcoded secrets, credentials, or environment-specific values.
- [ ] No dead code or commented-out code.
- [ ] Logging implemented at decision points without sensitive data.

## Tests

- [ ] Unit tests cover business logic.
- [ ] Integration tests cover module boundaries.
- [ ] API tests cover all endpoints (success, validation errors, auth errors).
- [ ] Edge case tests based on edge case philosophy.
- [ ] All tests are passing.
- [ ] Tests are deterministic and independent.

## Accessibility (if UI)

- [ ] Keyboard navigation works correctly.
- [ ] Screen reader compatible.
- [ ] Color contrast meets WCAG 2.1 AA.
- [ ] Form elements have labels and error messages.

## Security

- [ ] Authentication enforced on protected endpoints.
- [ ] Authorization enforced at API layer.
- [ ] Sensitive data not in logs, error messages, or URLs.
- [ ] Input validation prevents injection.
- [ ] Security review completed (for sensitive features).

## AI Safety (if AI involved)

- [ ] AI output validated against schema and business rules.
- [ ] Human approval enforced for clinical actions.
- [ ] Fallback behavior implemented for AI failures.
- [ ] AI evaluation passed thresholds.
- [ ] AI safety review completed.

## Error Handling

- [ ] All error states handled and user-facing errors are helpful.
- [ ] External service failures handled (timeout, retry, fallback).
- [ ] Partial failure scenarios considered.
- [ ] System fails safe (conservative default on failure).

## Observability

- [ ] Structured logging with correlation IDs.
- [ ] Key metrics trackable (latency, error rate).
- [ ] Health check endpoints (if new service).
- [ ] No sensitive data in logs.

## Documentation

- [ ] API documentation updated.
- [ ] Feature documentation updated.
- [ ] Architecture documentation updated (if architecture changed).
- [ ] Changelog updated.
- [ ] Code comments explain non-obvious decisions.

## Edge Cases

- [ ] Missing data scenarios handled.
- [ ] Concurrent access scenarios considered.
- [ ] Permission change scenarios considered.
- [ ] External system failure scenarios handled.
- [ ] AI uncertainty scenarios handled (if applicable).
