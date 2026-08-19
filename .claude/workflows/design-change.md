# Design Change Workflow

## Trigger

New UI design, modification to existing design, design system changes, or design token updates.

## Agents Involved

- **UX Designer** — workflow and interaction design.
- **UI Designer** — visual design and design tokens.
- **Frontend Engineer** — implementation.
- **Design Reviewer** — fidelity review.
- **Accessibility Reviewer** — accessibility review.

## Phases

### 1. Understand

- Review the user problem and workflow context.
- Review existing design patterns and components.
- Identify affected screens and components.

### 2. Design

- UX Designer creates workflow and interaction design.
- UI Designer creates visual design.
- Review against healthcare UX requirements.

### 3. Review Design

- Design review with Product Manager and Technical Lead.
- Accessibility review of the design.
- Resolve conflicts between aesthetics and usability.

### 4. Implement

- Frontend Engineer implements from design specifications.
- Use design tokens and design system components.
- Implement all visual states.

### 5. Review Implementation

- Design Reviewer verifies design fidelity.
- Accessibility Reviewer verifies compliance.
- Code Reviewer reviews implementation quality.

### 6. Document

- Update design documentation in `docs/design/`.
- Update design system documentation if tokens or components changed.

## Quality Gates

- [ ] Design addresses the user problem.
- [ ] Design follows healthcare UX requirements.
- [ ] Accessibility compliance verified.
- [ ] Implementation matches design specification.
- [ ] Design system consistency maintained.
