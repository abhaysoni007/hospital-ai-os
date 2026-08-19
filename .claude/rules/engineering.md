# Engineering Rules

> **Authority Level:** ENGINEERING — Governed by Core, Healthcare, and Security Rules.

## Modular Architecture

- Organize code into modules with clear boundaries and responsibilities.
- Each module should have a defined public interface and encapsulated internals.
- Modules should be independently testable.
- Dependencies between modules must be explicit (imports, dependency injection), never implicit.
- Circular dependencies between modules are prohibited.

## Separation of Concerns

- Business logic must not depend on framework-specific code.
- Data access must be separated from business logic.
- Presentation logic must be separated from business logic.
- Configuration must be separated from application code.
- AI/model interaction must be separated from business workflows.

## Clean Code

- Functions should do one thing.
- Functions should be short enough to understand without scrolling.
- Nesting depth beyond 3 levels should be refactored.
- Avoid boolean parameters that change function behavior; use separate functions or configuration objects.
- Prefer early returns over deeply nested conditionals.
- Dead code must be removed, not commented out.

## TypeScript / JavaScript Standards

- Use TypeScript with strict mode where applicable.
- Define explicit types for function parameters, return values, and data structures.
- Avoid `any`; use `unknown` when the type is genuinely not known, then narrow.
- Use `readonly` for data that should not be mutated.
- Prefer `const` over `let`; never use `var`.
- Use async/await over raw Promises; never mix callbacks and Promises.

## API Contracts

- Define API contracts (request/response schemas) before implementation.
- Version APIs explicitly.
- Use consistent naming conventions across all endpoints.
- Use consistent error response formats.
- Document every endpoint: purpose, authentication, authorization, request format, response format, error cases.
- API changes must be backward-compatible or versioned.

## Error Handling

- Use typed errors with error codes, not just string messages.
- Distinguish between client errors (4xx) and server errors (5xx).
- Never expose internal implementation details in error responses.
- Log full error context server-side; return safe summaries client-side.
- Handle every possible error state; unhandled promise rejections and uncaught exceptions are defects.
- Implement global error boundaries in frontend and backend.

## Validation

- Validate at system boundaries: API input, database output, external service responses, AI outputs, user input.
- Use schema validation libraries rather than manual checks.
- Validation errors must be specific: identify which field failed and why.
- Validation must be server-side; client-side validation is supplementary.

## Logging

- Use structured logging (JSON format) with consistent fields.
- Required fields: timestamp, level, service, correlation ID, message.
- Log levels: ERROR (failures), WARN (degradation), INFO (significant events), DEBUG (development).
- Never log sensitive data: passwords, tokens, PHI, PII.
- Use correlation IDs to trace requests across services.
- Log at decision points, not at every line of code.

## Testing

- Write tests before or alongside code, not as an afterthought.
- Test behavior, not implementation details.
- Tests must be independent and deterministic.
- Tests must not depend on external services; mock external dependencies.
- Test failure paths with equal rigor as success paths.
- Maintain test quality with the same standards as production code.

## Performance

- Identify performance requirements before implementation.
- Measure performance; do not guess.
- Optimize based on profiling data, not assumptions.
- Set performance budgets for critical paths (API response time, page load time, AI response time).
- Database queries must be analyzed for performance (indexes, query plans).
- Avoid N+1 query patterns.

## Maintainability

- Prefer well-understood patterns over novel abstractions.
- Every abstraction must justify its complexity.
- If removing an abstraction makes the code simpler and equally correct, remove it.
- Code must be understandable without the original author present.

## Technical Debt

- Track technical debt explicitly; do not let it accumulate silently.
- Document known shortcuts with rationale and remediation plan.
- Prioritize technical debt that affects safety, security, or correctness.
- Do not introduce technical debt in safety-critical paths.

## Dependency Management

- Justify every new dependency: what problem does it solve, what are the alternatives, what are the risks?
- Prefer standard library solutions over third-party dependencies for simple tasks.
- Audit dependency licenses for compatibility.
- Pin dependency versions in production.
- Keep dependencies up to date; monitor for security advisories.
- Remove unused dependencies.
