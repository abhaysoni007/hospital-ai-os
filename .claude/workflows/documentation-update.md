# Documentation Update Workflow

## Trigger

Code change that affects documented behavior, new feature, architecture change, or periodic documentation review.

## Agents Involved

- **Relevant Engineer** — updates documentation as part of their change.
- **Code Reviewer** — verifies documentation is updated.

## Phases

### 1. Identify

- Determine which documentation is affected by the change.
- Types: architecture docs, API docs, feature docs, ADRs, README, changelog.

### 2. Update

- Update affected documentation to reflect the current state.
- Follow documentation standards (`.claude/rules/documentation.md`).
- Ensure accuracy against the actual implementation.

### 3. Review

- Documentation changes reviewed alongside code changes.
- Verify accuracy and completeness.

### 4. Complete

- Documentation merged with the code change.
- Changelog updated if user-visible change.

## Quality Gates

- [ ] Documentation accurately reflects current implementation.
- [ ] No placeholder or speculative content.
- [ ] Documentation reviewed.
