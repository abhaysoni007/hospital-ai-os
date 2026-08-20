# Product Management Skill

## Purpose

Provide expert guidance for defining product requirements, user journeys, acceptance criteria, prioritization, and scope management for Hospital AI OS.

## When to Use

- Defining new feature requirements.
- Writing user stories and acceptance criteria.
- Prioritizing the backlog.
- Evaluating scope changes.
- Defining success metrics for features.
- Identifying and documenting user personas.

## When NOT to Use

- For technical implementation decisions (use engineering skills).
- For visual design (use ux-design or ui-engineering skills).

## Inputs

- User research findings, hospital workflow observations.
- Stakeholder requests.
- Existing product documentation in `docs/product/`.

## Preconditions

- Target user personas must be identified.
- Hospital workflow context must be understood.

## Responsibilities

### Requirements Definition
- Define requirements as user problems, not solutions.
- Each requirement must be traceable to a user persona and workflow.
- Requirements must be testable: verifiable acceptance criteria.
- Distinguish between must-have, should-have, and nice-to-have.

### Acceptance Criteria
- Written in Given/When/Then format or explicit conditions.
- Must cover: success path, primary error paths, edge cases.
- Must be specific and measurable (not "the system should be fast").
- Must be agreed upon before implementation begins.

### Prioritization
- Patient safety features first.
- Core workflow enablers second.
- Operational efficiency improvements third.
- Enhancement and polish fourth.
- Prioritize based on: impact × frequency × safety criticality.

### Scope Management
- Define in-scope and out-of-scope for every feature.
- Scope changes require re-evaluation and approval.
- If scope grows during implementation, stop and re-evaluate.

### Success Metrics
- Define measurable outcomes for every feature.
- Baseline before deployment; measure after.
- Metrics must be specific: time saved, errors prevented, throughput improved.

## Workflow

1. **Research**: Understand the user problem and hospital workflow context.
2. **Define**: Write requirements with acceptance criteria.
3. **Prioritize**: Rank against other work based on impact and feasibility.
4. **Scope**: Define boundaries clearly.
5. **Review**: Validate with stakeholders and engineering.
6. **Track**: Monitor implementation against requirements.

## Related Rules

- `.claude/rules/product.md`
- `.claude/rules/healthcare.md`

## Related Agents

- `product-manager` — primary user of this skill.
- `project-manager` — coordinates execution.
- `technical-lead` — evaluates feasibility.

## Verification Checklist

- [ ] User problem clearly articulated.
- [ ] Requirements traceable to personas and workflows.
- [ ] Acceptance criteria testable and complete.
- [ ] Scope clearly defined.
- [ ] Success metrics established.
- [ ] Prioritization justified.
