# Architecture Change Workflow

## Trigger

Proposed change to system architecture, module boundaries, data models, or technology stack.

## Agents Involved

- **Technical Lead** — evaluates and approves architecture changes.
- **Relevant Engineers** — assess impact on their domains.
- **Security Engineer** — assesses security implications.
- **Project Manager** — assesses schedule and risk impact.

## Phases

### 1. Understand

- Document the motivation for the change: what problem does it solve?
- Identify alternatives considered.
- Identify affected components and modules.

### 2. Assess Impact

- Which existing code is affected?
- Which data models change?
- Which APIs change?
- What are the migration requirements?
- What are the risks?

### 3. Create ADR

- Document the decision using the ADR template (`.claude/templates/adr.md`).
- Include: context, problem, decision, alternatives, consequences, risks, status.
- Store in `docs/decisions/`.

### 4. Review

- Technical Lead reviews and approves.
- Security Engineer reviews security implications.
- Affected engineers review impact on their domains.

### 5. Plan Migration

- Define a migration plan if existing data or APIs are affected.
- Define backward compatibility strategy.
- Define rollback plan.

### 6. Implement

- Follow the feature development workflow for the implementation.
- Implement in the smallest safe increments.

### 7. Verify

- Verify the architecture change achieves its goals.
- Verify no regressions.
- Verify migration completed successfully.
- Update architecture documentation.

## Quality Gates

- [ ] ADR created and approved.
- [ ] Impact assessment complete.
- [ ] Migration plan defined.
- [ ] Rollback plan defined.
- [ ] All reviews approved.
- [ ] Architecture documentation updated.
