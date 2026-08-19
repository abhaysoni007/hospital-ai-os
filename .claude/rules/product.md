# Product Rules

> **Authority Level:** ENGINEERING — Governed by Core, Healthcare, and Security Rules.

## Fundamental Principle

Features must solve real hospital workflow problems for real users. A technically impressive feature that does not improve a workflow is waste.

## User Problems

- Every feature must be traceable to a documented user problem.
- Validate that the problem is real (observed in hospital workflows), not assumed.
- Understand the current workaround and its cost before proposing a solution.
- If no user problem can be articulated, the feature should not be built.

## Hospital Workflows

- Understand the end-to-end workflow before designing a feature.
- Map: who is involved, what systems are used, what data flows, where delays occur, what fails.
- Design features to integrate into existing workflows, not replace them overnight.
- Account for workflow variations across departments.
- Account for workflow variations across shifts (day, night, weekends).

## Personas

- Define the primary users for each feature: their role, goals, constraints, and context.
- A physician's needs differ from a nurse's, which differ from a billing clerk's.
- Do not design for an abstract "user"; design for a specific role in a specific context.
- Consider secondary users: administrators, IT staff, auditors.

## Acceptance Criteria

- Every feature must have explicit acceptance criteria before implementation begins.
- Acceptance criteria must be testable: not "the system should be fast" but "API response time under 500ms for 95th percentile."
- Acceptance criteria must cover: success path, failure paths, edge cases, accessibility, security.
- Acceptance criteria must be agreed upon by product and engineering before work begins.

## Scope

- Define what is in scope and what is out of scope for every feature.
- Scope creep during implementation requires explicit approval.
- If a feature grows beyond its original scope, stop and re-evaluate.
- Prefer smaller, deliverable increments over large, delayed releases.

## Prioritization

- Prioritize based on: patient safety impact, clinical workflow impact, user frequency, implementation complexity.
- Safety-critical features are highest priority.
- Foundation infrastructure that enables multiple future features should be prioritized appropriately.
- Do not prioritize based on perceived impressiveness.

## Edge Cases

- Identify edge cases during product definition, not after deployment.
- For every feature, ask: what happens when the data is missing, malformed, conflicting, stale, or access is denied?
- Edge cases in healthcare can be safety-critical; they must not be deferred indefinitely.
- Document known edge cases that are intentionally deferred with rationale.

## Operational Constraints

- Consider: hospital internet connectivity, device availability, user technical literacy, shift handover, peak load times.
- Consider: power failures, system downtime, degraded mode operation.
- Consider: multi-language requirements, multi-facility requirements, regulatory requirements by jurisdiction.

## Measurable Outcomes

- Define how success will be measured before building the feature.
- Metrics must be specific and observable: time saved, errors reduced, throughput improved.
- Do not use vanity metrics (page views, sign-ups) for healthcare operations tools.
- Collect baseline measurements before the feature is deployed to enable comparison.
