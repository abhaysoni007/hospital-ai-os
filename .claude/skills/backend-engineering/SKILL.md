# Backend Engineering Skill

## Purpose

Provide expert guidance for designing and implementing backend services, APIs, and server-side logic for Hospital AI OS.

## When to Use

- Designing or implementing API endpoints.
- Building service layer business logic.
- Implementing data access patterns.
- Integrating with external services.
- Building authentication and authorization.
- Implementing event processing or background jobs.

## When NOT to Use

- For frontend-only changes.
- For database schema design (use database-engineering skill).
- For AI model integration patterns (use agent-engineering skill).
- For infrastructure/deployment (use devops skill).

## Inputs

- API specification or feature requirements.
- Data model documentation.
- Authentication/authorization requirements.
- Integration requirements (external systems).

## Preconditions

- API contracts should be defined before implementation.
- Data models should be designed before building data access layers.
- Security requirements should be identified before implementation.

## Responsibilities

### API Design

- Follow RESTful conventions where applicable; use consistent resource naming.
- Version APIs from the start (URL versioning: `/api/v1/`).
- Use consistent request/response formats across all endpoints.
- Define and document every endpoint: method, path, authentication, authorization, request body, query parameters, response body, error responses.
- Use appropriate HTTP methods: GET (read), POST (create), PUT (full update), PATCH (partial update), DELETE (remove).
- Use appropriate HTTP status codes: 200 (success), 201 (created), 400 (client error), 401 (unauthenticated), 403 (unauthorized), 404 (not found), 409 (conflict), 500 (server error).

### Service Boundaries

- Organize services by business domain, not by technical layer.
- Each service should own its data and expose it through its API.
- Services should not directly access another service's database.
- Keep service interfaces narrow: expose only what consumers need.
- Define clear contracts between services.

### Validation

- Validate all input at the API boundary: type, format, range, length, required fields.
- Use schema validation (not manual field-by-field checks).
- Return specific validation errors: which field, what constraint, what was received.
- Validate business rules after input validation.
- Never trust client-side validation; always validate server-side.

### Authentication and Authorization

- Enforce authentication on every endpoint (except explicitly public ones).
- Enforce authorization on every endpoint based on user role and resource ownership.
- Implement authorization checks in middleware/interceptors, not in individual route handlers.
- Log authentication and authorization events.
- Follow rules in `.claude/rules/security.md`.

### Error Handling

- Use typed error classes with error codes.
- Return consistent error response format: `{ code, message, details }`.
- Log full error context server-side (stack trace, request context, user context).
- Return safe error summaries client-side (no stack traces, no internal paths).
- Implement global error handlers for unhandled exceptions.
- Map internal errors to appropriate HTTP status codes.

### Observability

- Use structured logging (JSON) with correlation IDs.
- Log at decision points: request received, validation result, business logic decisions, external calls, response sent.
- Implement health check endpoints.
- Track request metrics: latency, status codes, error rates.
- Never log sensitive data (PHI, PII, credentials, tokens).

### Database Interaction

- Use parameterized queries or an ORM; never construct queries via string concatenation.
- Implement connection pooling.
- Use transactions for multi-step operations that must be atomic.
- Handle database connection failures gracefully (retry, circuit breaker).
- Optimize queries: use indexes, avoid N+1 patterns, analyze query plans for critical paths.

### Testing

- Unit test business logic in isolation (mock database, mock external services).
- Integration test API endpoints with a test database.
- Test all error paths, not just success paths.
- Test authentication and authorization enforcement.
- Test input validation with boundary values and malformed input.
- Test concurrent access scenarios for shared resources.

### Performance

- Set response time budgets for critical endpoints.
- Implement pagination for list endpoints.
- Implement caching where appropriate (with cache invalidation strategy).
- Use async processing for operations that do not need synchronous response.
- Profile and optimize database queries for high-frequency endpoints.

## Workflow

1. **Review API contract**: Confirm the endpoint specification is defined.
2. **Implement validation**: Input validation at the API boundary.
3. **Implement business logic**: In the service layer, not in the controller.
4. **Implement data access**: Using parameterized queries/ORM.
5. **Implement error handling**: Typed errors with appropriate status codes.
6. **Implement authorization**: Middleware-based role checks.
7. **Implement logging**: Structured logs at decision points.
8. **Write tests**: Unit and integration tests covering success and failure paths.
9. **Review**: Self-review diff, then submit for code review.

## Decision Rules

- If an endpoint modifies patient data → enforce audit logging and healthcare safety skill.
- If an endpoint calls an external service → implement timeout, retry, and fallback.
- If an endpoint returns a list → implement pagination.
- If an endpoint's response time exceeds budget → profile and optimize.

## Safety Constraints

- Never expose internal system details in API responses.
- Never log PHI or PII.
- Never bypass authentication or authorization checks.
- Never construct database queries via string concatenation.

## Validation

- [ ] API contract defined and documented.
- [ ] Input validation implemented.
- [ ] Authorization enforced.
- [ ] Error handling implemented with consistent format.
- [ ] Logging implemented without sensitive data.
- [ ] Tests cover success and failure paths.
- [ ] Performance within budget.

## Expected Output

- Implemented API endpoint(s) with validation, authorization, error handling, and logging.
- Unit and integration tests.
- Updated API documentation.

## Failure Handling

- If API contract is missing → request it before implementing.
- If data model is undefined → coordinate with database engineer before building data access.
- If security requirements are unclear → escalate to security engineer.

## Related Rules

- `.claude/rules/engineering.md`
- `.claude/rules/security.md`
- `.claude/rules/healthcare.md`

## Related Agents

- `backend-engineer` — primary user of this skill.
- `database-engineer` — for data model coordination.
- `security-engineer` — for security review.
- `code-reviewer` — for implementation review.

## Related Workflows

- `.claude/workflows/feature-development.md`

## Verification Checklist

- [ ] API contract followed.
- [ ] Validation at API boundary.
- [ ] Authorization enforced at API layer.
- [ ] Error responses consistent and safe.
- [ ] Structured logging without sensitive data.
- [ ] Tests passing for success and failure paths.
