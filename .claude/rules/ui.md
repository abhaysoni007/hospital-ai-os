# UI Rules

> **Authority Level:** ENGINEERING — Governed by Core, Healthcare, and Security Rules.

## Fundamental Principle

The UI for a hospital system must prioritize clarity, correctness, and safety over visual impressiveness. A visually appealing interface that leads to clinical errors is a failure.

## Accessibility

- Meet WCAG 2.1 AA compliance as a minimum.
- All interactive elements must be keyboard accessible.
- All images and icons must have meaningful alt text (or be marked decorative).
- Color must not be the sole means of conveying information.
- Minimum contrast ratios must be enforced (4.5:1 for normal text, 3:1 for large text).
- Form inputs must have associated labels.
- Error messages must be programmatically associated with their fields.
- Screen reader testing must be included in the QA process.
- Focus management must be intentional: modals trap focus, page navigation moves focus.

## Responsive Design

- The UI must function on the device categories used in hospital settings (desktop workstations, tablets, potentially mobile for specific roles).
- Layouts must adapt without losing functionality or information.
- Touch targets must be appropriately sized for touch devices (minimum 44x44px).
- Critical information must not be hidden behind responsive breakpoints.

## Information Hierarchy

- The most important information for the current task must be immediately visible.
- Group related information visually.
- Use progressive disclosure for complex data: summary first, details on demand.
- Maintain consistent information placement across similar screens.
- Healthcare dashboards must prioritize actionable information over decorative elements.

## Healthcare Workflow Usability

- UI flows must match the mental model of hospital staff (not the database model or API model).
- Minimize clicks and navigation for frequent operations.
- Support interruption-driven workflows: hospital staff are frequently interrupted.
- Preserve user state across interruptions (drafts, partial entries).
- Display patient context persistently during patient-related workflows.

## Error States

- Every component that can fail must have an error state.
- Error messages must be specific and actionable: what went wrong, what the user can do.
- Error messages must not expose technical details (stack traces, database errors, internal IDs).
- Errors must be visually distinct but not panic-inducing.
- Provide recovery paths from errors: retry, alternative action, contact support.

## Loading States

- Every asynchronous operation must show a loading state.
- Loading states must indicate progress where possible (determinate vs. indeterminate).
- Loading states must not block unrelated UI areas.
- Consider skeleton screens for content areas.
- Set timeouts for loading states; show an alternative (error, retry) if loading takes too long.

## Empty States

- Every list, table, and data area must have an empty state.
- Empty states must explain why there is no data and what the user can do.
- Distinguish between "no results found" and "no data exists yet."

## Dangerous Actions

- Destructive actions (delete, cancel, override) must require confirmation.
- Confirmation dialogs must clearly state what will happen and whether it is reversible.
- Dangerous buttons must be visually distinct from safe actions.
- Clinical actions with safety implications must have additional safeguards beyond standard confirmation.
- Do not place dangerous actions adjacent to frequently used safe actions.

## Confirmation Flows

- High-impact operations must use explicit confirmation (not just a single click).
- Confirmation must present: action being taken, affected entities, consequences, reversibility.
- Multi-step confirmation for critical clinical or financial actions.
- Confirmation must not be a reflexive "Are you sure?" — it must add information value.

## Patient and Staff Context

- When displaying patient data, show identifying context (name, ID, demographics) to prevent wrong-patient errors.
- Use patient identification verification at critical workflow steps.
- Display the current user's role and active department context.
- Clearly indicate when viewing data from a different time period or encounter.

## Data Density

- Hospital users often need to see many data points simultaneously; avoid over-simplification.
- Use tables, grids, and dense layouts where appropriate for professional users.
- Provide filtering, sorting, and search for large datasets.
- Allow users to configure visible columns and data density where practical.

## Consistency

- Use a design system with defined components, tokens, and patterns.
- Consistent navigation patterns across all sections.
- Consistent terminology: the same concept must use the same label everywhere.
- Consistent interaction patterns: similar actions should work the same way across the application.
- Consistent iconography: the same icon must represent the same concept everywhere.

## Clinical Display Safety

- Drug names must be displayed using Tall Man lettering where applicable.
- Numerical values must include units.
- Lab values must indicate normal ranges and flag abnormal results.
- Date and time must use unambiguous formats.
- Medication dosages must be clearly separated from frequency and route.
- Allergies and alerts must be prominently displayed and not dismissible without documentation.
