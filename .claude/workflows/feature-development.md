# Feature Development Workflow

## Trigger

New feature request or approved product requirement.

## Agents Involved

Depends on feature scope. Typical involvement:

- **Product Manager** — requirements and acceptance criteria.
- **Project Manager** — task breakdown and tracking.
- **Technical Lead** — architecture decisions.
- **UX Designer** — workflow design (if UI involved).
- **UI Designer** — visual design (if UI involved).
- **Backend Engineer** — backend implementation.
- **Frontend Engineer** — frontend implementation.
- **Database Engineer** — data model (if new entities).
- **Integration Engineer** — external integrations (if applicable).
- **AI Engineer** — AI features (if applicable).
- **QA Engineer** — test planning and execution.
- **Code Reviewer** — code review.
- **Security Engineer** — security review (if sensitive data or new attack surface).
- **AI Safety Reviewer** — AI safety review (if AI features).
- **Accessibility Reviewer** — accessibility review (if UI).
- **Performance Reviewer** — performance review (if performance-sensitive).

Not every feature requires every agent. The Technical Lead determines which agents are needed based on feature scope.

## Phases

### 1. Understand

- Product Manager defines the user problem, acceptance criteria, and success metrics.
- Review related documentation in `docs/product/`.
- Identify affected personas and workflows.
- Confirm scope (in-scope, out-of-scope, non-goals).

### 2. Inspect

- Review existing codebase for related implementations.
- Review existing architecture in `docs/architecture/`.
- Identify reusable components, services, and patterns.
- Identify affected modules and potential side effects.

### 3. Plan

- Technical Lead determines architecture approach and involved agents.
- Database Engineer designs data model (if needed).
- UX Designer designs workflow (if UI involved).
- Project Manager breaks down tasks and identifies dependencies.
- Create an ADR if the feature requires architectural decisions.
- Apply healthcare safety skill if patient data or clinical workflows are involved.

### 4. Design

- UI Designer creates visual design (if UI involved).
- Backend Engineer defines API contracts.
- AI Engineer defines AI feature specification (if applicable).
- Review designs with relevant stakeholders.

### 5. Implement

- Backend Engineer implements API endpoints and service logic.
- Frontend Engineer implements UI components and pages.
- Database Engineer implements migrations.
- Integration Engineer implements external integrations.
- AI Engineer implements AI features.
- Follow rules in `.claude/rules/engineering.md`.
- Follow healthcare rules if applicable.
- Follow security rules if applicable.

### 6. Validate

- QA Engineer executes test plan.
- Unit tests, integration tests, and API tests pass.
- Healthcare safety tests pass (if applicable).
- AI evaluation passes thresholds (if applicable).
- Edge cases from the edge case philosophy are addressed.

### 7. Review

- Code Reviewer reviews implementation quality.
- Security Engineer reviews security (if applicable).
- AI Safety Reviewer reviews AI safety (if applicable).
- Accessibility Reviewer reviews accessibility (if UI).
- Performance Reviewer reviews performance (if performance-sensitive).
- Design Reviewer reviews design fidelity (if UI).

### 8. Document

- Update relevant documentation in `docs/`.
- Update API documentation.
- Update changelog.
- Create ADR if architectural decisions were made.

### 9. Complete

- All acceptance criteria verified.
- All quality gates passed.
- All reviews approved.
- Documentation updated.
- Feature merged to main branch.

## Checklists Required

- `.claude/checklists/FEATURE_DEFINITION_OF_DONE.md`
- `.claude/checklists/CODE_REVIEW.md`
- `.claude/checklists/SECURITY_REVIEW.md` (if applicable)
- `.claude/checklists/AI_REVIEW.md` (if applicable)
- `.claude/checklists/UI_REVIEW.md` (if applicable)

## Quality Gates

A feature cannot be considered complete unless:

- [ ] Acceptance criteria are met.
- [ ] Tests are passing.
- [ ] Code review is approved.
- [ ] Security review is approved (if applicable).
- [ ] AI safety review is approved (if applicable).
- [ ] Accessibility review is approved (if UI).
- [ ] Documentation is updated.
