<!--
Earthropy PR template. Reviewer (or auto-merge) gates on these.
-->

## Task

Closes `<TASK-ID>` — see `docs/kanban/tasks/<TASK-ID>.md`.

## Summary

One short paragraph: what this PR does and *why* (the why belongs in the commit body too).

## Gates

Paste output of:

```
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e   # only if UI changed
```

For UI changes: also confirm axe a11y reports zero `serious`/`critical` violations on the changed page.

## TDD evidence

- [ ] Test plan items from the task all exist as committed tests.
- [ ] First commit of this branch is the failing tests (git history proves it).

If TDD genuinely doesn't apply (pure CSS, asset, doc-only), explain in one line:

> _e.g., "Doc-only change; no behavior to test."_

## Diff scope

- [ ] No file touched outside the task's stated scope.
- [ ] No new top-level dep introduced. If yes, name it + license + why:
  - `<name>` — `<license>` — `<reason>`

## DB / migration safety (if schema changed)

- [ ] Migration is additive, OR
- [ ] Down path is tested.

## Bundle size (if UI / app code changed)

First Load JS delta for affected routes:

```
<route>  before: <kb>   after: <kb>   delta: <kb>
```

If `>20kb` increase: justify here.

## Screenshots (UI changes)

Inline or attached. Both light and dark mode if applicable. LTR + RTL if Arabic-affected.

## Notes

Anything the next maintainer should know.
