# Superpowers — Structured Engineering Methodology

## Purpose

A meta-level behavioral skill that enforces disciplined, structured engineering practice across all Hospital AI OS development. Superpowers ensures agents approach work systematically — understanding before acting, planning before building, and verifying before completing — while adapting the methodology's rigor to the task at hand.

## When to Use

- Feature development (full methodology).
- Bug investigation and fixing (systematic debugging path).
- Architecture changes (structured analysis and planning).
- Complex refactoring (impact analysis and verification).
- AI feature development (evaluation-driven development).
- Any task where skipping a step could introduce defects, regressions, or safety risks.

## When NOT to Use

- Trivial formatting or typo fixes (apply directly).
- Simple configuration value changes with clear instructions (validate, don't brainstorm).
- Purely mechanical file moves with no logic changes (verify, don't plan extensively).

## Inputs

- Task description or requirement.
- Relevant codebase context.
- Acceptance criteria (if defined).

## Preconditions

- The agent must have read and understood the task before activating this skill.
- Healthcare safety rules (`.claude/rules/healthcare.md`) and security rules (`.claude/rules/security.md`) take absolute precedence over any workflow step in this skill.

## The Superpowers Workflow

### Phase 1: Understand

Before writing any code, fully understand:

- What is being asked?
- Why is it being asked?
- Who is affected?
- What exists already?
- What constraints apply (healthcare, security, architecture, performance)?

**Actions:**
- Read the task description and acceptance criteria.
- Inspect related code, documentation, and tests.
- Identify affected modules, data models, and APIs.
- Identify healthcare safety implications (apply healthcare-safety skill if patient data or clinical workflows are involved).
- Identify security implications.

**Do not proceed until you can articulate the problem clearly.**

### Phase 2: Brainstorm

Before committing to an approach, consider alternatives:

- What are the possible solutions?
- What are the trade-offs of each?
- Which solution best fits the existing architecture?
- Which solution minimizes risk?
- Does the Ponytail decision ladder apply (is there a simpler existing solution)?

**Actions:**
- List 2-3 viable approaches (for non-trivial tasks).
- Identify pros, cons, and risks of each.
- Select the approach with the best balance of correctness, simplicity, safety, and maintainability.
- Document the decision rationale (in comments, ADR, or commit message as appropriate).

**For trivial tasks:** A single obvious approach is sufficient. Do not force artificial alternatives.

### Phase 3: Design

For significant features, design before implementation:

- Define the interfaces (API contracts, component props, data models).
- Define the data flow.
- Define error handling strategy.
- Define the test strategy.

**For small tasks:** A mental design is sufficient. Not every change needs a design document.

### Phase 4: Plan

Break the work into steps:

- What changes are needed, in what order?
- What dependencies exist between steps?
- What can be verified independently?
- What checkpoints should exist?

**Actions:**
- Create a task list (mental or written, proportional to task complexity).
- Identify the order of implementation (dependencies first).
- Identify verification points between steps.

### Phase 5: Implement

Execute the plan incrementally:

- Implement one logical change at a time.
- Verify each change before proceeding.
- Follow existing patterns and architecture.
- Apply relevant domain skills (backend-engineering, frontend-engineering, etc.).

**Test-driven development guidance:**

| Task Type | TDD Approach |
|-----------|-------------|
| Business logic with defined inputs/outputs | Write tests first or alongside |
| API endpoints with defined contracts | Write API tests first or alongside |
| Bug fixes | Write the failing test first (reproducing the bug) |
| UI components | Write component tests alongside |
| Configuration changes | Validate configuration, tests may not apply |
| Documentation | No implementation tests needed |
| Exploratory research | Tests come after findings are confirmed |
| AI features | Define evaluation criteria first, implementation tests alongside |

**TDD is a tool, not a dogma.** Use it where it adds value. Do not force unit tests on documentation changes or configuration files. Do not skip tests on business logic because "it's simple."

### Phase 6: Test

Verify the implementation:

- Run existing tests to check for regressions.
- Run new tests to verify the change.
- Test edge cases identified during the brainstorm/design phase.
- Test error paths, not just the happy path.

### Phase 7: Review

Self-review before submission:

- Review your own diff.
- Check for unintended changes.
- Check for debug code or temporary artifacts.
- Check for sensitive data exposure.
- Verify against acceptance criteria.
- Apply relevant checklists (`.claude/checklists/`).

### Phase 8: Verify

Final verification:

- All tests passing.
- Acceptance criteria met.
- Documentation updated.
- No regressions introduced.
- Healthcare safety verified (if applicable).
- Security verified (if applicable).

### Phase 9: Complete

Declare completion only when:

- All phases are satisfied (proportional to task complexity).
- Evidence of completion exists (tests passing, criteria met, reviews approved).
- No known issues are hidden.

## Systematic Debugging Path

For bugs, use this adapted workflow:

```
1. Reproduce — confirm the bug is real and reproducible
2. Isolate — narrow down to the specific module/function/line
3. Understand — read the code to understand intended behavior
4. Identify root cause — not just the symptom
5. Check for systemic issues — does this pattern exist elsewhere?
6. Plan the fix — minimal, safe, targeted
7. Write the regression test — the test must fail without the fix
8. Implement the fix — change only what is necessary
9. Verify — fix works, no regressions, test passes
10. Document — root cause, fix, lessons learned
```

## Checkpoints and Delegation

### Explicit Checkpoints

For multi-step tasks, define checkpoints:

- After each significant implementation step, verify before proceeding.
- If a checkpoint fails, stop and reassess rather than pushing forward.
- Do not accumulate errors across steps.

### Subagent Delegation

When delegating to specialized agents:

- Provide clear, complete context.
- Define the expected output.
- Define the quality criteria.
- Review the output against the criteria.

## Safety Override

**This skill must never cause an agent to skip:**

- Authorization checks.
- Healthcare safety checks.
- Security reviews.
- Human approval requirements.
- Required validation.
- Audit logging.

If the Superpowers workflow suggests skipping a safety step for efficiency, **safety wins.**

If a production safety issue requires immediate mitigation, the normal Superpowers workflow is suspended — apply the fix, then retroactively complete the review and documentation steps.

## Decision Rules

- If the task is trivial → apply phases proportionally (understand, implement, verify).
- If the task is complex → apply all phases.
- If the task involves patient data → healthcare-safety skill is mandatory.
- If the task involves AI → ai-evaluation skill is mandatory.
- If a production incident requires immediate action → safety response first, Superpowers workflow second.

## Related Rules

- `.claude/rules/core.md` — governs all behavior.
- `.claude/rules/healthcare.md` — overrides workflow preferences.
- `.claude/rules/security.md` — overrides workflow preferences.

## Related Skills

- `.claude/skills/ponytail/` — complementary; Ponytail simplifies, Superpowers structures.
- `.claude/skills/caveman/` — complementary; Caveman optimizes communication output.
- All domain skills — Superpowers coordinates their application.

## Related Agents

- All engineering agents should reference Superpowers for structured work.
- `technical-lead` — Superpowers + Ponytail for architecture decisions.
- `code-reviewer` — Superpowers for structured review.
- `ai-safety-reviewer` — Superpowers, but never allowing workflow optimization to bypass safety.

## Verification Checklist

- [ ] Task was understood before implementation began.
- [ ] Alternatives were considered (for non-trivial tasks).
- [ ] Implementation followed existing patterns.
- [ ] Tests verify the change.
- [ ] Self-review completed before submission.
- [ ] Healthcare safety verified (if applicable).
- [ ] Security verified (if applicable).
- [ ] No safety steps were skipped.
