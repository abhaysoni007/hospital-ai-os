# UI Review Checklist

## Design Fidelity

- [ ] Implementation matches approved design specification.
- [ ] Design tokens used consistently (no hardcoded colors, spacing, typography).
- [ ] Component matches the design system.

## Visual States

- [ ] Default state implemented.
- [ ] Hover state implemented.
- [ ] Focus state implemented (visible focus indicator).
- [ ] Active/pressed state implemented.
- [ ] Disabled state implemented.
- [ ] Error state implemented.
- [ ] Loading state implemented.
- [ ] Empty state implemented.
- [ ] Success/confirmation state implemented.

## Accessibility

- [ ] Keyboard navigation works (Tab, Enter, Space, Escape, Arrow keys).
- [ ] No keyboard traps.
- [ ] Focus order is logical.
- [ ] Screen reader announces content correctly.
- [ ] Images have alt text.
- [ ] Form inputs have labels.
- [ ] Error messages are programmatically associated with fields.
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 normal text, 3:1 large text).
- [ ] Color is not the sole means of conveying information.
- [ ] ARIA attributes used correctly.

## Responsive Design

- [ ] Layout adapts at all supported breakpoints.
- [ ] No content is lost or hidden at any breakpoint.
- [ ] Touch targets are appropriately sized (minimum 44x44px).
- [ ] Text is readable without horizontal scrolling.

## Healthcare-Specific UI

- [ ] Patient identification is visible during patient workflows.
- [ ] Clinical alerts are prominent and not accidentally dismissible.
- [ ] Dangerous actions require confirmation.
- [ ] Confirmation dialogs explain consequences.
- [ ] Numerical values include units.
- [ ] Date/time formats are unambiguous.
- [ ] Allergies and alerts are prominently displayed.

## Interaction Quality

- [ ] Feedback is provided for every user action.
- [ ] Loading indicators show for async operations.
- [ ] Error messages are user-friendly and actionable.
- [ ] Successful actions are confirmed.
- [ ] Transitions and animations are smooth and purposeful.

## Data Display

- [ ] Large datasets have pagination, filtering, and search.
- [ ] Tables have sortable columns (where applicable).
- [ ] Empty states explain why there is no data.
- [ ] Data formatting is consistent (numbers, dates, currencies).
