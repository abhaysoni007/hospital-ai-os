# Ponytail — Minimal Correct Solutions

## Purpose

A meta-level behavioral skill that drives agents toward the smallest correct solution that solves the actual problem. Ponytail actively resists unnecessary complexity, speculative architecture, and premature abstraction while respecting the non-negotiable requirements of healthcare safety, security, and data integrity.

## When to Use

- Before implementing any new code, component, or abstraction.
- When evaluating whether a refactoring is justified.
- When reviewing a proposed architecture change.
- When evaluating whether a new dependency is necessary.
- When assessing technical debt remediation priorities.
- During code review to identify over-engineering.

## When NOT to Use

- When healthcare safety requires additional complexity (safety wins over simplicity).
- When security requires additional validation layers (security wins over simplicity).
- When regulatory requirements mandate specific implementations (compliance wins over simplicity).
- When accessibility standards require additional markup (accessibility wins over simplicity).
- When auditability requires additional logging (audit requirements win over simplicity).

## The Decision Ladder

Before writing new code, walk through this ladder from top to bottom. Stop at the first step that solves the problem:

### Step 1: Does this need to exist?

- Is the feature actually needed, or is it speculative?
- Is the problem real and validated, or assumed?
- Could the workflow work without this addition?
- **If it does not need to exist → do not build it.**

### Step 2: Does the codebase already solve it?

- Search the existing codebase for similar functionality.
- Check `src/shared/` for reusable utilities.
- Check existing services for overlapping capabilities.
- Check existing components for reusable UI patterns.
- **If it already exists → use it. Do not duplicate.**

### Step 3: Can an existing abstraction be reused?

- Can an existing service, utility, or component be extended minimally to cover this case?
- Would a small parameter addition or configuration change suffice?
- **If reusable → extend. Do not create a parallel abstraction.**

### Step 4: Can the standard library or platform solve it?

- Does the language standard library have a built-in solution?
- Does the runtime platform provide this capability?
- **If the platform solves it → use it. Do not wrap it unnecessarily.**

### Step 5: Can an existing dependency solve it?

- Is there an already-adopted dependency that handles this?
- Would using it avoid significant implementation effort?
- **If an existing dependency covers it → use it. Do not add a new dependency for marginal benefit.**

### Step 6: Can the problem be solved more simply?

- Can the solution use fewer abstractions?
- Can the solution use less state?
- Can the solution have fewer moving parts?
- Is there a more direct path from input to output?
- **Simplify the design before implementing.**

### Step 7: Only then implement new code.

- Implement the minimum correct solution.
- Do not add features that are not yet needed.
- Do not add abstractions "in case we need them later."
- Do not add configuration for things that have only one valid value today.
- **Build what is needed now. Extend when the need is proven.**

## What Ponytail Actively Resists

### Unnecessary Abstractions
- Abstraction layers with only one implementation and no foreseeable second.
- Wrapper functions that add no logic, only indirection.
- Generic solutions for problems that are currently specific.

### Premature Optimization
- Performance optimization without measured bottleneck evidence.
- Caching without verified need.
- Denormalization without query performance data.

### Duplicate Utilities
- Creating a new date formatter when one exists in `src/shared/`.
- Creating a new validation helper when the existing one covers the case.
- Creating a new API client pattern when the established pattern works.

### Unnecessary Dependencies
- Adding a library for something achievable in 10 lines of straightforward code.
- Adding a library whose API surface far exceeds the needed functionality.
- Adding a library with questionable maintenance or security posture.

### Speculative Architecture
- Microservices for a system that works well as a monolith.
- Message queues for synchronous workflows.
- Event sourcing for simple CRUD operations.
- Plugin systems for features with one known implementation.

### Over-Engineered Agent Systems
- Multi-agent orchestration for a task achievable by a single function.
- Complex planning loops for deterministic operations.
- Tool frameworks for operations that are simple function calls.

### Excessive Configuration
- Environment variables for values that never change.
- Feature flags for features that are always on.
- Configuration files for settings with one valid value.

### Unnecessary State
- Storing derived data that can be computed.
- Maintaining caches without invalidation strategy.
- Keeping historical state that is never queried.

## Healthcare Safety Override

**Simplicity is valuable, but safety is non-negotiable.**

Ponytail must NEVER override:

| Requirement | Example |
|-------------|---------|
| Patient safety | "We don't need this validation" → **Wrong.** If it prevents a medication error, we need it. |
| Security | "We don't need this auth check" → **Wrong.** If it protects PHI, we need it. |
| Authorization | "We don't need per-record access control" → **Wrong.** If the data is role-restricted, we need it. |
| Auditability | "We don't need this log entry" → **Wrong.** If it's a clinical action, we need the audit trail. |
| Data integrity | "We don't need this constraint" → **Wrong.** If it prevents data corruption, we need it. |
| Regulatory requirements | "We don't need this field" → **Wrong.** If regulation mandates it, we need it. |
| Accessibility | "We don't need ARIA labels" → **Wrong.** If it enables assistive technology, we need it. |
| Required validation | "We don't need to validate AI output" → **Wrong.** AI output must always be validated. |

**A smaller implementation is not automatically better if it creates hidden clinical or security risk.**

## Evaluating Complexity

When deciding whether complexity is justified, ask:

1. **What is the cost of this complexity?** (Maintenance burden, cognitive load, testing surface.)
2. **What is the benefit?** (Safety, correctness, performance, extensibility.)
3. **Is the benefit proven or speculative?** (Proven need → accept. Speculative → reject.)
4. **Does removing this complexity create risk?** (If yes → keep it.)

## Decision Rules

- If a solution exists in the codebase → use it.
- If an abstraction has one implementation → it is probably unnecessary.
- If an optimization has no benchmark → it is premature.
- If a dependency is larger than the problem → solve it directly.
- If simplification removes a safety control → the simplification is wrong.
- If simplification removes auditability → the simplification is wrong.

## Related Rules

- `.claude/rules/core.md` — "Avoid Unnecessary Changes" aligns with Ponytail.
- `.claude/rules/engineering.md` — "Every abstraction must justify its complexity."
- `.claude/rules/healthcare.md` — overrides Ponytail when safety is at stake.
- `.claude/rules/security.md` — overrides Ponytail when security is at stake.

## Related Skills

- `.claude/skills/superpowers/` — complementary; Superpowers structures the work, Ponytail simplifies the solution.
- `.claude/skills/caveman/` — complementary; Caveman simplifies communication, Ponytail simplifies implementation.
- All domain skills — Ponytail influences how domain skills are applied (prefer simpler implementations).

## Related Agents

- `technical-lead` — applies Ponytail when evaluating architecture proposals.
- `backend-engineer` — applies Ponytail to avoid unnecessary service layers.
- `frontend-engineer` — applies Ponytail to avoid unnecessary component abstractions.
- `code-reviewer` — applies Ponytail to identify over-engineering.
- `performance-reviewer` — applies Ponytail to resist premature optimization.

## Verification Checklist

- [ ] Checked existing codebase before creating new code.
- [ ] No unnecessary abstractions introduced.
- [ ] No unnecessary dependencies added.
- [ ] Solution is the simplest correct approach.
- [ ] Simplification did not remove safety, security, or audit controls.
- [ ] Complexity is justified where it exists.
