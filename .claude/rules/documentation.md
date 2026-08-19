# Documentation Rules

> **Authority Level:** ENGINEERING — Governed by Core Rules.

## Fundamental Principle

Documentation must explain decisions, context, and intent — not merely repeat what the code does. Good documentation tells a new team member why the system works this way, not just how.

## Architecture Documentation

- Maintain a current system architecture overview.
- Document system boundaries, external integrations, and data flows.
- Update architecture documentation when the architecture changes.
- Use diagrams to visualize system structure (C4 model recommended).
- Architecture documentation must be reviewable by non-implementers.

## Architecture Decision Records (ADRs)

- Record every significant architectural decision as an ADR.
- An ADR must include: context, problem, decision, alternatives considered, consequences, risks, status.
- ADRs are immutable once accepted; create a new ADR to supersede an old one.
- ADRs must be created before or during implementation, not retroactively.
- Store ADRs in `docs/decisions/`.

## API Documentation

- Every API endpoint must be documented: purpose, authentication, authorization, request format, response format, error cases.
- Keep API documentation synchronized with implementation.
- Use a standard format (OpenAPI/Swagger where applicable).
- Include example requests and responses.
- Document rate limits, pagination, and versioning.

## Feature Documentation

- Document each feature: purpose, user journey, behavior, configuration, limitations.
- Document behavior that is not obvious from the UI.
- Document known limitations and planned improvements.
- Keep feature documentation current; outdated documentation is worse than no documentation.

## README Quality

- The root README must provide: project purpose, prerequisites, setup instructions, development workflow, project structure overview.
- Each major module may have its own README explaining its responsibility and usage.
- READMEs must be current; update them when the project structure or setup changes.

## Code Comments

- Comment on why, not what. The code shows what; comments explain intent, trade-offs, and non-obvious constraints.
- Do not add comments that merely restate the code.
- Comment on: complex algorithms, non-obvious business rules, workarounds, known limitations.
- Remove outdated comments; a wrong comment is worse than no comment.
- TODO comments must include context: what needs to be done, why, and a tracking reference.

## Changelogs

- Maintain a changelog that documents user-visible changes.
- Group entries by: Added, Changed, Fixed, Removed, Security.
- Write changelog entries for the audience of the change (users, operators, developers).
- Update the changelog as part of the change, not as a separate task.

## Documentation as Code

- Store documentation alongside code in version control.
- Documentation changes should be reviewed with the same rigor as code changes.
- Documentation must be written in Markdown.
- Documentation must not contain hardcoded environment-specific values.
