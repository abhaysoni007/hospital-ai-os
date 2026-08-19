# Bug Fix Workflow

## Trigger

Bug report or defect discovered during testing, review, or production monitoring.

## Agents Involved

- **Engineer** (backend, frontend, database, or AI — depending on the bug).
- **QA Engineer** — verifies the fix.
- **Code Reviewer** — reviews the fix.
- **Security Engineer** — if the bug has security implications.
- **AI Safety Reviewer** — if the bug involves AI behavior.

## Phases

### 1. Reproduce

- Confirm the bug is reproducible.
- Document reproduction steps: environment, inputs, expected behavior, actual behavior.
- If the bug cannot be reproduced, gather more information before proceeding.
- Do not guess at the cause.

### 2. Isolate

- Identify the module, component, and function where the defect occurs.
- Trace the data flow to understand where the behavior diverges from expected.
- Identify if the bug is in: business logic, data handling, UI rendering, API integration, AI output, or external system interaction.

### 3. Identify Root Cause

- Determine the root cause (not just the symptom).
- Understand why the defect was not caught by existing tests.
- Check if the same pattern exists elsewhere in the codebase (systemic issue vs. isolated defect).

### 4. Implement Minimal Safe Fix

- Fix the root cause with the smallest safe change.
- Do not refactor unrelated code in the same fix.
- Do not introduce new features in a bug fix.
- If the root cause requires significant architectural change, create a separate task for the refactoring.
- Follow engineering standards and healthcare rules.

### 5. Regression Test

- Write a test that reproduces the original bug (the test must fail without the fix and pass with it).
- Run the full test suite to verify no regressions.
- If the bug was in a healthcare-related area, add healthcare safety test cases.

### 6. Review

- Submit for code review.
- If the bug has security implications → security review.
- If the bug involves AI behavior → AI safety review.

### 7. Document

- Update the bug report with: root cause, fix description, tests added.
- If the bug reveals a gap in testing strategy, update the test plan.
- Update changelog if the fix is user-visible.

### 8. Complete

- Fix merged.
- Regression test passing in CI.
- Bug report closed with resolution notes.

## Checklists Required

- `.claude/checklists/CODE_REVIEW.md`
- `.claude/checklists/SECURITY_REVIEW.md` (if security implications)

## Quality Gates

- [ ] Root cause identified (not just symptom patched).
- [ ] Regression test added.
- [ ] All tests passing.
- [ ] Code review approved.
- [ ] No unrelated changes in the fix.
