# Frontend Engineering Skill

## Purpose

Provide expert guidance for designing and implementing frontend components, pages, and user interactions for Hospital AI OS.

## When to Use

- Building UI components.
- Implementing page layouts and navigation.
- Integrating with backend APIs from the frontend.
- Implementing state management.
- Handling frontend error, loading, and empty states.
- Implementing accessibility features.
- Optimizing frontend performance.

## When NOT to Use

- For backend API design (use backend-engineering skill).
- For UX research or design decisions (use ux-design skill).
- For visual design system decisions (use ui-engineering skill).
- For database work (use database-engineering skill).

## Inputs

- UI design specifications or wireframes.
- API contracts for backend integration.
- Accessibility requirements.
- User workflow context (personas, tasks).

## Preconditions

- UI designs should be approved before implementation.
- API contracts should be defined before frontend integration.
- Design system tokens and components should be available.

## Responsibilities

### Component Architecture

- Build small, focused, reusable components.
- Separate presentational components (how things look) from container components (how things work).
- Components should be testable in isolation.
- Components should accept explicit props; avoid implicit coupling.
- Define clear component APIs: required props, optional props, events/callbacks.
- Document component usage with examples.

### State Management

- Keep state as local as possible; lift only when necessary.
- Distinguish between: UI state (local), application state (shared), server state (cached API data).
- Use appropriate state management for each category; do not put everything in a global store.
- Server state should be managed with a data fetching library that handles caching, invalidation, and synchronization.
- Avoid derived state stored separately; compute it from source state.

### Accessibility

- Follow WCAG 2.1 AA guidelines as a minimum.
- Use semantic HTML elements (`nav`, `main`, `section`, `article`, `button`, `label`).
- All interactive elements must be keyboard accessible.
- All images and icons must have alt text.
- Forms must have labels, error messages, and appropriate ARIA attributes.
- Test with keyboard navigation and screen readers.
- Follow rules in `.claude/rules/ui.md`.

### Loading States

- Every async operation must show a loading indicator.
- Use skeleton screens for content areas.
- Loading must not block unrelated UI sections.
- Set timeouts: show retry/error if loading exceeds a reasonable duration.
- Preserve existing content during background refreshes.

### Error States

- Every component that fetches data or performs actions must have an error state.
- Error messages must be user-friendly: explain what happened and what the user can do.
- Provide retry mechanisms for retriable errors.
- Provide navigation to alternative paths for non-retriable errors.
- Never show raw error objects, stack traces, or internal IDs to users.

### Empty States

- Every list, table, and data display area must handle the empty case.
- Empty states should explain why there is no data and what the user can do next.
- Distinguish between "no results for this search" and "no data exists yet."

### API Integration

- Centralize API calls in a service/client layer; do not call APIs directly from components.
- Handle all response states: loading, success, error, empty.
- Implement request cancellation for abandoned navigations.
- Use consistent error handling across all API calls.
- Cache appropriately; invalidate on mutations.

### Performance

- Minimize initial bundle size; use code splitting for routes and large features.
- Lazy-load components and data that are not needed for initial render.
- Optimize re-renders: memoize expensive computations, avoid unnecessary state updates.
- Optimize images and media: appropriate formats, sizes, and lazy loading.
- Measure performance using browser developer tools and real user metrics.

### Responsive Behavior

- Design for the primary device categories used in hospital settings.
- Use CSS-based responsiveness; avoid JavaScript-driven layout switching.
- Test at all supported breakpoints.
- Critical functionality must be available on all supported devices.
- Touch targets must be appropriately sized for touch devices.

## Workflow

1. **Review design**: Confirm the design specification is available and approved.
2. **Identify components**: Break the design into reusable components.
3. **Implement components**: Build from smallest to largest (atoms → molecules → organisms → pages).
4. **Implement state management**: Set up local and shared state as needed.
5. **Integrate API**: Connect components to backend APIs through the service layer.
6. **Handle all states**: Implement loading, error, empty, and success states.
7. **Implement accessibility**: Keyboard navigation, ARIA attributes, screen reader support.
8. **Test**: Component tests, accessibility tests, integration tests.
9. **Review**: Self-review, then submit for code review and UI review.

## Decision Rules

- If a component is used in more than one place → make it a shared component.
- If a component exceeds 200 lines → consider breaking it into smaller components.
- If state is needed by siblings → lift state to the common parent.
- If state is needed globally → use the application state management solution.
- If an API call is needed → use the centralized API service layer.

## Safety Constraints

- Never store sensitive data (PHI, PII, tokens) in unencrypted client-side storage.
- Never display sensitive data in URLs or browser history.
- Sanitize any user-generated content before rendering to prevent XSS.
- Never bypass server-side validation; client-side validation is supplementary.

## Validation

- [ ] All design specifications implemented.
- [ ] All states handled: loading, error, empty, success.
- [ ] Accessibility requirements met (keyboard, screen reader, contrast).
- [ ] API integration through service layer.
- [ ] Responsive behavior tested.
- [ ] Component tests passing.
- [ ] No sensitive data in client-side storage or URLs.

## Expected Output

- Implemented components with all states handled.
- Component tests.
- Accessibility compliance.
- Responsive layout.

## Failure Handling

- If design specification is missing → request it before implementing.
- If API contract is undefined → coordinate with backend engineer.
- If accessibility requirements are unclear → apply WCAG 2.1 AA as default.

## Related Rules

- `.claude/rules/ui.md`
- `.claude/rules/engineering.md`
- `.claude/rules/security.md`

## Related Agents

- `frontend-engineer` — primary user of this skill.
- `ui-designer` — provides design specifications.
- `accessibility-reviewer` — reviews accessibility compliance.
- `code-reviewer` — reviews implementation quality.

## Related Workflows

- `.claude/workflows/feature-development.md`
- `.claude/workflows/design-change.md`

## Verification Checklist

- [ ] Design specification followed.
- [ ] Component architecture is clean and reusable.
- [ ] All visual states implemented.
- [ ] Accessibility tested.
- [ ] API integration through service layer.
- [ ] Performance acceptable.
- [ ] Tests passing.
