# Contributing to MEDORA

Thank you for contributing to MEDORA (Hospital AI OS).

## Development workflow

1. Create a focused branch from `main`.
2. Keep changes scoped to one feature, fix, or documentation improvement.
3. Preserve the architectural boundaries documented in `docs/architecture/`.
4. Add or update tests for behavioral changes.
5. Run the repository verification commands before opening a pull request.

## Local verification

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm -r exec tsc --noEmit
pnpm -r run test
pnpm run build
```

## Pull requests

PRs should clearly describe:

- what changed
- why it changed
- how it was verified
- any architectural or security implications
- any follow-up work that remains

Avoid mixing unrelated refactors with feature work.

## Healthcare safety

MEDORA handles healthcare workflows and AI-assisted functionality. Do not introduce fabricated clinical claims, real patient data, secrets, or unsafe logging. Follow the applicable rules and specifications under `.claude/` and `docs/`.

## Commit style

Prefer concise, imperative commit messages using a conventional prefix where practical, for example:

```text
feat: add appointment workflow
fix: enforce diagnostic result boundary
security: harden token handling
refactor: simplify shared validation
```
