# UI Engineering Skill

## Purpose

Provide expert guidance for implementing visual design systems, component libraries, design tokens, and visual UI engineering for Hospital AI OS.

## When to Use

- Building or extending the design system.
- Implementing UI components from design specifications.
- Defining design tokens (colors, typography, spacing, shadows).
- Ensuring visual consistency across the application.

## When NOT to Use

- For UX research or workflow design (use ux-design skill).
- For frontend logic, state management, or API integration (use frontend-engineering skill).
- For accessibility audits (use accessibility skill).

## Inputs

- Approved design specifications.
- Design system documentation.
- Component requirements.

## Preconditions

- Design specifications must be approved.
- Design tokens must be defined (or being defined as part of this work).

## Responsibilities

### Design System

- Maintain a centralized design system with documented components.
- Every component must have: documented API (props), visual variants, states (default, hover, focus, active, disabled, error), usage guidelines.
- Components must be composable: build complex UIs from simple, reusable parts.
- The design system must be the single source of truth for visual implementation.

### Design Tokens

- Define tokens for: colors, typography, spacing, border radius, shadows, breakpoints, z-index, animation timing.
- Tokens must be used consistently; hardcoded values are prohibited.
- Tokens must support theming (e.g., light/dark mode, high-contrast mode).
- Token naming must be semantic (e.g., `color-error`, not `color-red`).

### Component Implementation

- Match the design specification precisely.
- Implement all visual states.
- Use design tokens, not hardcoded values.
- Ensure accessibility (keyboard, screen reader, contrast).
- Test at all supported breakpoints.

### Visual Consistency

- Consistent spacing, typography, and color usage.
- Consistent icon style and size.
- Consistent component behavior (buttons, inputs, modals).
- Consistent layout patterns (page structure, sidebars, headers).

### Healthcare-Specific Visual Design

- High-priority alerts must be visually prominent.
- Medication names should follow established display conventions.
- Numerical clinical values must include units.
- Color coding for clinical severity must be consistent and accessible.
- Patient identification must be visually persistent.

## Workflow

1. **Review design**: Understand the design specification.
2. **Define tokens**: Create or identify existing design tokens.
3. **Build component**: Implement with all states and variants.
4. **Test**: Visual testing, responsive testing, accessibility testing.
5. **Document**: Usage guidelines and examples.
6. **Review**: Submit for design review and code review.

## Related Rules

- `.claude/rules/ui.md`
- `.claude/rules/engineering.md`

## Related Agents

- `ui-designer` — primary user of this skill.
- `frontend-engineer` — builds with design system components.
- `design-reviewer` — reviews design implementation.
- `accessibility-reviewer` — reviews accessibility compliance.

## Verification Checklist

- [ ] Design specification followed precisely.
- [ ] Design tokens used (no hardcoded values).
- [ ] All visual states implemented.
- [ ] Responsive at all breakpoints.
- [ ] Accessible (contrast, keyboard, screen reader).
- [ ] Documented with usage guidelines.
- [ ] Consistent with existing design system.
