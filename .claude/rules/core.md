# Core Rules

> **Authority Level:** HIGHEST — These rules override all skills, agents, workflows, and task-specific instructions.

## Instruction Hierarchy

When instructions conflict, the following priority applies (highest first):

1. **Safety** — Patient safety, clinical safety, system safety
2. **Security / Privacy** — Data protection, access control, secrets
3. **Healthcare rules** — Clinical boundaries, regulatory constraints
4. **Core rules** — Universal engineering behavior
5. **Product rules** — User needs, acceptance criteria
6. **Meta-skills** — Superpowers (structured methodology), Ponytail (minimal solutions), Caveman (efficient communication)
7. **Domain skills** — Backend, frontend, database, AI, integration, etc.
8. **Repository architecture** — Established patterns, approved structure
9. **Task-specific preferences** — Implementation style, naming conventions

Higher-level rules always override lower-level instructions. When in doubt, apply the higher-priority rule.

## Understand Before Changing

- Read existing code, documentation, and tests before modifying anything.
- Trace the impact of a change through all affected modules.
- Identify the original intent behind existing code before altering it.
- Never assume code is wrong without evidence.

## Inspect Existing Code

- Before creating new files, search for existing implementations.
- Before adding utilities, check `src/shared/` and existing modules.
- Before adding types, check existing type definitions.
- Before adding constants, check existing configuration.
- Duplicate code is a defect.

## Preserve Architecture

- Do not restructure directories without explicit approval.
- Do not change established patterns (naming, file organization, module boundaries) without an approved ADR.
- Do not move files between modules without understanding the dependency graph.
- Do not introduce new architectural layers without approval.

## Avoid Unnecessary Changes

- Change only what is required by the task.
- Do not refactor unrelated code during a feature implementation.
- Do not update dependencies unless the task requires it.
- Do not "improve" formatting in files you are not modifying.
- Every changed line must be justifiable.

## Explicit Assumptions

- State all assumptions before implementing.
- If a requirement is ambiguous, document the ambiguity rather than guessing.
- If a decision has multiple valid options, present them rather than choosing silently.
- Never introduce behavior that is not covered by a requirement or explicit instruction.

## Deterministic Behavior

- Prefer deterministic logic over probabilistic approaches for business rules.
- Use explicit control flow rather than implicit conventions.
- Make state transitions visible and traceable.
- Avoid hidden side effects.

## Maintainability

- Write code that a new engineer can understand without verbal explanation.
- Prefer clarity over cleverness.
- Name variables, functions, and modules to describe their purpose.
- Keep functions focused on a single responsibility.
- Keep modules cohesive.

## Backward Compatibility

- Do not break existing API contracts without explicit approval.
- Do not remove fields from responses without a migration plan.
- Do not change database schemas without a migration strategy.
- Do not alter event formats without coordinating with consumers.

## Error Handling

- Every external call must have error handling.
- Every user input must be validated.
- Every error must produce a meaningful message.
- Never swallow errors silently.
- Distinguish between recoverable and unrecoverable errors.
- Log errors with sufficient context for diagnosis.

## Observability

- Every significant operation should be loggable.
- Every external integration should have health indicators.
- Every performance-sensitive path should be measurable.
- Structured logging is required; unstructured string logs are insufficient.

## Documentation

- Document decisions, not just code.
- Update documentation when behavior changes.
- Keep README files current.
- Record architectural decisions in ADRs.

## Verification Before Completion

- Run all relevant tests before declaring a task complete.
- Verify the change works in the expected context.
- Check for regressions in related functionality.
- Review your own diff before submitting.
- Confirm all acceptance criteria are met.
- A task is not done until it is tested, documented, and reviewed.
