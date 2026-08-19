# Integration Engineering Skill

## Purpose

Provide expert guidance for designing, implementing, and operating integrations with external systems — including hospital HIS/EMR, lab systems (LIS), radiology (RIS), pharmacy, billing, insurance/TPA, and health information exchange standards (FHIR, ABDM, NHCX).

## When to Use

- Integrating with any external system or third-party API.
- Implementing webhooks (inbound or outbound).
- Building adapter layers for external data formats.
- Handling integration failures and retries.
- Designing data synchronization between systems.

## When NOT to Use

- For internal service-to-service communication (use backend-engineering skill).
- For AI model API calls (use agent-engineering skill).
- For frontend API calls (use frontend-engineering skill).

## Inputs

- External system API documentation.
- Data format specifications (FHIR resources, ABDM schemas, proprietary formats).
- Integration requirements (what data, which direction, how often, what latency).
- Failure tolerance requirements.

## Preconditions

- External system documentation or API specifications must be available.
- Integration scope must be defined: which data, which operations, which direction.
- Authentication mechanism for the external system must be known.

## Responsibilities

### External API Integration

- Wrap every external API in an adapter layer that isolates the rest of the application from the external system's API details.
- Define an internal data model that maps to the external format; never expose external data formats directly to business logic.
- Document the mapping between internal and external data models.

### Retries

- Implement retry logic for transient failures (network timeouts, 503 responses).
- Use exponential backoff with jitter.
- Define maximum retry count per integration.
- Log each retry attempt with context.
- Do not retry on permanent errors (400, 401, 403, 404).

### Timeouts

- Set explicit timeouts on all external calls.
- Timeout values should be based on the external system's documented SLA or measured performance.
- Handle timeout as a specific error type with appropriate user feedback.

### Idempotency

- Design integration operations to be idempotent where possible.
- Use idempotency keys for operations that create resources.
- Handle duplicate webhook deliveries gracefully.
- Log duplicate detection.

### Webhooks

- Validate webhook signatures/authenticity.
- Process webhooks asynchronously (acknowledge receipt immediately, process in background).
- Implement webhook replay capability for missed or failed deliveries.
- Log all webhook events: received, validated, processed, failed.

### Failure Handling

- Classify failures: transient (retry), permanent (log and alert), data mismatch (log and escalate).
- Implement circuit breaker pattern for external systems with persistent failures.
- Queue failed operations for manual review or automated retry.
- Never lose data due to external system failures; persist outbound data until confirmed delivered.

### Contract Validation

- Validate external system responses against expected schemas.
- Detect schema changes or unexpected data formats.
- Alert on contract violations; do not silently ignore unexpected data.
- Version integration adapters to handle known external API versions.

### Data Synchronization

- Define the source of truth for each data element.
- Handle conflicts between systems explicitly (timestamp-based, priority-based, or manual resolution).
- Log synchronization events: what was synced, source, destination, timestamp, result.
- Monitor synchronization latency and data freshness.

## Workflow

1. **Understand the external system**: Review API documentation, data formats, authentication.
2. **Design the adapter**: Define internal-to-external data mapping.
3. **Implement**: Build the adapter with retry, timeout, and error handling.
4. **Implement idempotency**: Ensure operations are safe to retry.
5. **Test**: Test with mock external system, test failure scenarios, test data mapping.
6. **Monitor**: Implement health checks, latency tracking, and failure alerts.

## Decision Rules

- If an external system has no documented SLA → assume it can be slow or unavailable; design for resilience.
- If data mapping is ambiguous → document the ambiguity and confirm with stakeholders.
- If the external system uses a non-standard format → build a dedicated adapter; do not pollute business logic.
- If integration involves PHI → apply healthcare safety and security constraints.

## Safety Constraints

- Never send PHI to unauthorized external systems.
- Never store external system credentials in source code.
- Validate all data received from external systems before processing.
- Log integration operations without including sensitive data values.

## Validation

- [ ] Adapter layer isolates external API details.
- [ ] Retry logic with exponential backoff implemented.
- [ ] Timeouts configured.
- [ ] Idempotency implemented for write operations.
- [ ] Failure handling covers transient, permanent, and data mismatch cases.
- [ ] Contract validation implemented.
- [ ] Tests cover success, failure, and edge cases.
- [ ] Monitoring and alerting configured.

## Expected Output

- Integration adapter with full error handling.
- Data mapping documentation.
- Integration tests.
- Monitoring configuration.

## Failure Handling

- If external API documentation is unavailable → do not guess the API behavior. Escalate.
- If data mapping has ambiguities → document and resolve before implementing.
- If the external system is unreliable → implement circuit breaker and degradation strategy.

## Related Rules

- `.claude/rules/engineering.md`
- `.claude/rules/security.md`
- `.claude/rules/healthcare.md`
- `.claude/rules/DO_NOT_GUESS.md`

## Related Agents

- `integration-engineer` — primary user of this skill.
- `backend-engineer` — consumes integration adapters.
- `security-engineer` — reviews data protection.

## Related Workflows

- `.claude/workflows/feature-development.md`

## Verification Checklist

- [ ] Adapter layer cleanly separates external and internal concerns.
- [ ] All external calls have timeout and retry handling.
- [ ] Idempotency keys used for write operations.
- [ ] Circuit breaker pattern for unreliable systems.
- [ ] Data mapping documented and validated.
- [ ] Tests cover failure scenarios.
