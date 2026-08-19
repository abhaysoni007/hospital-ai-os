# Git Rules

> **Authority Level:** ENGINEERING — Governed by Core Rules.

## Branch Discipline

- The main branch must always be in a deployable state.
- Create feature branches from the main branch.
- Use a consistent branch naming convention: `type/short-description` (e.g., `feature/discharge-workflow`, `fix/auth-token-expiry`, `docs/api-contracts`).
- Delete branches after they are merged.
- Long-lived branches are discouraged; merge frequently.

## Meaningful Commits

- Each commit must represent a single logical change.
- Each commit must leave the codebase in a working state.
- Do not combine unrelated changes in a single commit.
- Do not commit generated files, build artifacts, or dependencies (unless explicitly required).
- Do not commit secrets, credentials, or environment-specific configuration.

## Small Changes

- Prefer small, focused pull requests over large, sweeping changes.
- If a change grows large, consider breaking it into a sequence of smaller, reviewable changes.
- Large diffs are harder to review and more likely to introduce defects.
- Infrastructure changes, refactoring, and feature work should be in separate commits.

## Commit Messages

- Use the format: `type: concise description`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `security`, `perf`
- The description should explain what was changed and, if not obvious, why.
- Reference relevant issue or task IDs.
- Do not use generic messages: "fix bug", "update code", "WIP".

## Pull Requests

- Every pull request must have: a title describing the change, a description explaining what and why, reference to the relevant task or issue.
- Pull requests must pass all automated checks before review.
- Pull requests must be reviewed by at least one other team member (or agent).
- Pull requests must not include unrelated changes.
- Address all review comments before merging.

## Merge Safety

- Always use merge strategies that preserve history and traceability.
- Resolve merge conflicts carefully; never accept "both" without understanding the intent.
- After merging, verify that the result compiles and tests pass.
- Do not force-push to shared branches.

## Avoiding Unrelated Modifications

- Do not "fix" formatting in files you are not modifying.
- Do not update imports in files unrelated to your change.
- Do not refactor code outside the scope of your task.
- Every file change in a commit must be justified by the commit's purpose.

## Reviewing Diffs Before Completion

- Review your own diff before creating a pull request.
- Verify that no unintended changes are included.
- Verify that no debug code, console logs, or temporary code is included.
- Verify that no sensitive data is included.
- Verify that all new files are intentional and correctly placed.

## Destructive Operations

- Never force-push to main or shared branches.
- Never rewrite shared branch history.
- Never delete branches that others may be using without coordination.
- Never perform hard resets on shared branches.
- Git operations that lose history require explicit authorization.
