
# Edge Case Philosophy

> **Authority Level:** GLOBAL — This rule applies universally to all agents, skills, and workflows.

## Fundamental Principle

Every important feature must consider its failure modes before implementation. In a hospital system, edge cases are not rare curiosities — they are daily realities that, if unhandled, lead to patient harm, data loss, and system failures.

## Missing Data

- What happens when a required field is null, empty, or not provided?
- What happens when a patient record is incomplete?
- What happens when referenced data has been deleted?
- What happens when historical data is not available?
- **Rule**: Never silently substitute defaults for missing clinical data. Surface the gap.

## Contradictory Data

- What happens when two systems report different values for the same patient attribute?
- What happens when a lab result contradicts a clinical note?
- What happens when an AI recommendation contradicts clinician input?
- **Rule**: Surface contradictions for human resolution. Never silently pick one.

## Stale Data

- What happens when cached data is outdated?
- What happens when a patient's status changed since the screen was loaded?
- What happens when an approval is based on data that has since changed?
- **Rule**: Define freshness requirements for critical data. Detect and alert on staleness.

## Malformed Data

- What happens when incoming data does not match the expected schema?
- What happens when external system data contains unexpected characters, formats, or encodings?
- What happens when AI output does not match the expected structure?
- **Rule**: Validate at boundaries. Reject malformed data with clear error messages. Never attempt to interpret malformed clinical data.

## Partial Failures

- What happens when a multi-step operation fails midway?
- What happens when one of several parallel operations fails?
- What happens when a database write succeeds but a notification fails?
- **Rule**: Design for atomicity where possible. Where not possible, implement compensation/rollback. Always leave the system in a known state.

## Network Failures

- What happens when an external API is unreachable?
- What happens when a request times out?
- What happens when a response is truncated?
- **Rule**: Every external call must have timeout, retry, and fallback behavior. Network failures must not corrupt local state.

## Duplicate Requests

- What happens when a user clicks a submit button twice?
- What happens when a webhook is delivered twice?
- What happens when a message is processed twice due to retry?
- **Rule**: Critical operations must be idempotent. Use idempotency keys where applicable. Detect and de-duplicate where necessary.

## Race Conditions

- What happens when two users modify the same record simultaneously?
- What happens when a status check and a status change happen concurrently?
- What happens when two agents attempt the same action?
- **Rule**: Use optimistic concurrency control (versioning) for critical records. Use database-level constraints to prevent invalid concurrent state.

## Permission Changes

- What happens when a user's permissions are revoked during an active session?
- What happens when a role assignment changes while an approval is pending?
- What happens when an administrator is demoted while performing admin actions?
- **Rule**: Re-validate permissions at the point of action, not just at session start. Critical actions must check permissions immediately before execution.

## Invalid User Actions

- What happens when a user navigates to a page they no longer have access to?
- What happens when a user submits a form for a record that has been deleted?
- What happens when a user attempts an action that is no longer valid (e.g., approving an already-cancelled request)?
- **Rule**: Validate state before executing actions. Return meaningful errors that guide the user.

## AI Uncertainty

- What happens when the AI model returns a low-confidence result?
- What happens when the AI model returns an unexpected output format?
- What happens when the AI model is unavailable?
- What happens when the AI model hallucinates data that looks plausible?
- **Rule**: Define confidence thresholds. Route low-confidence outputs to human review. Validate AI outputs against source data.

## Conflicting Clinical Information

- What happens when a medication order conflicts with a documented allergy?
- What happens when a dosage exceeds the standard range?
- What happens when two active orders contradict each other?
- **Rule**: Flag conflicts immediately. Require explicit clinician acknowledgment before proceeding. Log the acknowledgment.

## External System Failures

- What happens when the HIS/EMR is down?
- What happens when the lab system returns an error?
- What happens when the insurance/TPA gateway is unreachable?
- **Rule**: Degrade gracefully. Inform the user of the external system status. Queue operations for retry where safe. Never lose data due to external failures.

## Human Rejection

- What happens when a clinician rejects an AI recommendation?
- What happens when an approver denies a request?
- What happens when a reviewer rejects a code change?
- **Rule**: Rejection is a first-class outcome, not an error. Log rejections with reason. Provide clear next steps after rejection.

## Agent Loops

- What happens when an AI agent enters an infinite planning cycle?
- What happens when two agents create work for each other indefinitely?
- What happens when an agent retries a failing action without limit?
- **Rule**: Enforce maximum iteration limits on all agent loops. Detect repeated failures and escalate rather than retry.

## Prompt Injection

- What happens when user input contains instructions intended to manipulate the AI?
- What happens when external data contains prompt injection payloads?
- **Rule**: Sanitize user-provided content before including it in AI prompts. Use clear delimiters between system instructions and user content. Validate AI outputs independently of the prompt.

## Malformed Model Responses

- What happens when the AI returns valid JSON but with incorrect field types?
- What happens when the AI returns a partial response (truncated)?
- What happens when the AI returns a response that passes schema validation but is semantically wrong?
- **Rule**: Validate AI responses at both the structural level (schema) and the semantic level (business rules). Never trust; always verify.

## Process for New Features

When designing any significant feature, explicitly answer:

1. What are the inputs? What if they are missing, malformed, or adversarial?
2. What are the dependencies? What if they fail?
3. What is the success path? What are the failure paths?
4. What state transitions occur? What if they happen out of order or concurrently?
5. What data is created or modified? What if the modification partially fails?
6. Who can trigger this? What if someone unauthorized triggers it?
7. Is AI involved? What if the AI is wrong, slow, or unavailable?
8. Is clinical data involved? What if it is incomplete, contradictory, or stale?
