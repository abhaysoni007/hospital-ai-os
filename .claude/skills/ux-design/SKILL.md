# UX Design Skill

## Purpose

Provide expert guidance for user experience research, workflow design, information architecture, and interaction patterns for Hospital AI OS.

## When to Use

- Designing new feature workflows.
- Mapping user journeys for hospital staff.
- Defining information architecture and navigation.
- Designing interaction patterns for complex clinical workflows.
- Evaluating UX for existing features.

## When NOT to Use

- For visual design implementation (use ui-engineering skill).
- For backend implementation (use backend-engineering skill).
- For accessibility audits (use accessibility skill).

## Inputs

- User personas and their goals.
- Hospital workflow context.
- Feature requirements.

## Preconditions

- Target user personas must be defined.
- The hospital workflow being designed for must be understood.

## Responsibilities

### User Research

- Understand the user's role, goals, constraints, and environment.
- Map the current workflow: steps, pain points, workarounds.
- Identify interruption patterns (hospital staff are frequently interrupted).
- Consider shift variations (day, night, weekend).

### Workflow Design

- Design workflows that match users' mental models.
- Minimize steps for frequent operations.
- Support interruption recovery (save state, restore context).
- Design for error prevention, not just error recovery.
- Consider the full workflow lifecycle, not just the happy path.

### Information Architecture

- Organize information by clinical/operational context, not technical structure.
- Most important information first.
- Use progressive disclosure: summary → details on demand.
- Consistent navigation across the application.

### Interaction Patterns

- Consistent interaction patterns for similar operations.
- Explicit confirmation for destructive or high-risk actions.
- Clear feedback for every user action (success, loading, error).
- Undo capability where feasible.
- Search and filter for large data sets.

### Healthcare-Specific UX

- Patient identification must be persistent and verifiable during patient-related workflows.
- Clinical alerts must be prominent and not accidentally dismissible.
- Data density should serve professional users (not oversimplified).
- Time-critical workflows must have clear urgency indicators.
- Handover workflows must support context transfer between shifts.

## Workflow

1. **Research**: Understand users, workflows, and constraints.
2. **Map**: Document current workflow and pain points.
3. **Design**: Create the proposed workflow with all states and paths.
4. **Validate**: Review with stakeholders and representative users.
5. **Document**: Record design decisions and rationale.
6. **Iterate**: Refine based on feedback.

## Related Rules

- `.claude/rules/ui.md`
- `.claude/rules/product.md`
- `.claude/rules/healthcare.md`

## Related Agents

- `ux-designer` — primary user of this skill.
- `ui-designer` — translates UX into visual design.
- `product-manager` — provides requirements and priorities.
- `accessibility-reviewer` — reviews accessibility.

## Verification Checklist

- [ ] User personas identified and understood.
- [ ] Workflow matches users' mental model.
- [ ] All states handled (success, error, loading, empty, edge cases).
- [ ] Interruption recovery supported.
- [ ] Healthcare-specific UX requirements met.
- [ ] Design decisions documented with rationale.
