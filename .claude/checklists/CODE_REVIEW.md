# Code Review Checklist

## Correctness

- [ ] Code implements the specified behavior.
- [ ] All acceptance criteria are addressed.
- [ ] Logic is correct (no off-by-one, no missed conditions).
- [ ] Null, undefined, and empty values are handled.
- [ ] Boundary values are handled.

## Architecture

- [ ] Change follows established patterns and module boundaries.
- [ ] No unnecessary complexity or abstraction introduced.
- [ ] New dependencies are justified.
- [ ] Change is in the correct module/layer.
- [ ] No circular dependencies introduced.

## Error Handling

- [ ] All error paths are handled.
- [ ] Error messages are meaningful and safe (no sensitive data).
- [ ] External call errors are handled (timeout, retry, fallback).
- [ ] Errors are logged with sufficient context.
- [ ] No silently swallowed errors.

## Security

- [ ] Input is validated at API boundary.
- [ ] Authorization is enforced (not just hidden in UI).
- [ ] No injection vulnerabilities.
- [ ] Sensitive data not in logs, error messages, or URLs.
- [ ] No hardcoded secrets or credentials.

## Testing

- [ ] Tests exist for the change.
- [ ] Tests cover success and failure paths.
- [ ] Tests are meaningful (not just checking that code runs).
- [ ] Edge cases are tested.
- [ ] Tests are deterministic and independent.

## Maintainability

- [ ] Code is readable without verbal explanation.
- [ ] Names are descriptive and consistent.
- [ ] No unnecessary duplication.
- [ ] Functions are focused (single responsibility).
- [ ] Dead code and commented-out code removed.

## Performance

- [ ] No obvious performance issues (N+1 queries, missing pagination, unnecessary computation).
- [ ] Database queries are indexed appropriately.
- [ ] Caching is used appropriately (if applicable).

## Healthcare Safety (if applicable)

- [ ] Patient data access control enforced.
- [ ] Audit logging for sensitive operations.
- [ ] Clinical actions require human approval.
- [ ] AI output validated before use.
- [ ] No PHI in logs or error messages.

## Documentation

- [ ] Code comments explain non-obvious decisions (why, not what).
- [ ] API documentation updated (if endpoints changed).
- [ ] Changelog updated (if user-visible change).
