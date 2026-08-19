# Documentation Skill

## Purpose

Provide expert guidance for creating and maintaining high-quality documentation across all layers of Hospital AI OS.

## When to Use

- Writing or updating architecture documentation.
- Creating ADRs (Architecture Decision Records).
- Writing API documentation.
- Documenting features, workflows, and configurations.
- Writing changelogs and release notes.
- Reviewing documentation quality.

## When NOT to Use

- For code comments (follow `.claude/rules/documentation.md` directly).

## Inputs

- Subject to be documented (feature, decision, API, architecture).
- Audience (developers, operators, users, auditors).
- Existing documentation to update.

## Preconditions

- The subject must be understood; do not document guesses.
- The audience must be identified.

## Responsibilities

### Architecture Documentation
- Use the C4 model: System Context → Container → Component → Code.
- Keep diagrams synchronized with implementation.
- Document system boundaries, data flows, and integration points.
- Document non-obvious constraints and trade-offs.

### ADRs
- Follow the template in `.claude/templates/adr.md`.
- Record context, problem, decision, alternatives, consequences, risks.
- ADRs are immutable once accepted; supersede with new ADRs.
- Create ADRs at the time of the decision, not retroactively.

### API Documentation
- Document every endpoint with examples.
- Keep synchronized with implementation (ideally auto-generated from code).
- Include authentication, authorization, error responses.

### Feature Documentation
- Explain purpose, usage, configuration, limitations.
- Written for the audience (user vs. developer vs. operator).
- Include edge cases and known limitations.

### Quality Standards
- Documentation must be accurate (verified against implementation).
- Documentation must be current (updated when implementation changes).
- Documentation must be concise (no filler or repeated content).
- Documentation must be navigable (table of contents, cross-references).

## Workflow

1. **Identify audience**: Who will read this documentation?
2. **Identify purpose**: What question does this documentation answer?
3. **Draft**: Write clear, accurate, concise content.
4. **Review**: Verify accuracy against implementation.
5. **Publish**: Place in the appropriate location in `docs/`.
6. **Maintain**: Update when the subject changes.

## Related Rules

- `.claude/rules/documentation.md`

## Related Agents

- All agents produce documentation as part of their deliverables.

## Verification Checklist

- [ ] Documentation is accurate (verified against current implementation).
- [ ] Documentation is placed in the correct location.
- [ ] Documentation is written for its intended audience.
- [ ] Documentation answers a clear question.
- [ ] No placeholder or speculative content.
