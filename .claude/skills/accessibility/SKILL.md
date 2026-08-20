# Accessibility Skill

## Purpose

Provide expert guidance for ensuring Hospital AI OS meets accessibility standards, enabling all users — including those with disabilities — to use the system effectively.

## When to Use

- Reviewing UI implementations for accessibility compliance.
- Designing new components or pages.
- Testing keyboard navigation and screen reader compatibility.
- Evaluating color contrast and visual design.

## When NOT to Use

- For backend-only changes with no UI impact.

## Inputs

- UI component or page implementation.
- Design specifications.
- WCAG 2.1 guidelines.

## Preconditions

- UI components must be rendered and inspectable.
- Design tokens (colors, typography) must be defined.

## Responsibilities

### Standards Compliance
- WCAG 2.1 AA is the minimum target.
- All interactive elements must be keyboard accessible.
- Focus order must follow logical reading order.
- Focus must be visible on all interactive elements.

### Keyboard Navigation
- Tab through all interactive elements in logical order.
- Enter/Space activates buttons and links.
- Escape closes modals and dropdowns.
- Arrow keys navigate within complex widgets (tabs, menus, grids).
- No keyboard traps (user can always navigate away).

### Screen Reader Compatibility
- All images have meaningful alt text or are marked decorative.
- Form inputs have associated labels.
- Error messages are announced.
- Dynamic content changes are announced via ARIA live regions.
- Headings form a logical hierarchy.
- Landmark regions are used (nav, main, aside, footer).

### Color and Contrast
- Text contrast: 4.5:1 for normal text, 3:1 for large text.
- Color is not the sole means of conveying information.
- Interactive element states (hover, focus, active, disabled) are distinguishable.
- Verify with color blindness simulation tools.

### Healthcare-Specific Accessibility
- Clinical alerts must be both visual and auditory/programmatic.
- Critical information (allergies, alerts) must be accessible to screen readers.
- Dense data displays (tables, grids) must have appropriate headers and ARIA attributes.
- Time-sensitive operations must have configurable timeouts for users who need more time.

## Workflow

1. **Audit**: Test the component/page against WCAG 2.1 AA criteria.
2. **Keyboard test**: Navigate using only the keyboard.
3. **Screen reader test**: Navigate using a screen reader.
4. **Contrast check**: Verify color contrast ratios.
5. **Report**: Document findings with severity and remediation guidance.

## Related Rules

- `.claude/rules/ui.md`

## Related Agents

- `accessibility-reviewer` — primary user of this skill.
- `frontend-engineer` — implements fixes.
- `ui-designer` — designs accessible interfaces.

## Verification Checklist

- [ ] WCAG 2.1 AA criteria met.
- [ ] Keyboard navigation complete and logical.
- [ ] Screen reader experience verified.
- [ ] Color contrast meets minimums.
- [ ] No keyboard traps.
- [ ] Dynamic content changes announced.
- [ ] Form accessibility complete (labels, errors, required fields).
