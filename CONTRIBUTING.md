# Contributing to Earthropy

Earthropy belongs to everyone working on the 17 SDGs. We welcome contributors from any country, culture, background, role, or experience level. Code, translations, documentation, moderation policy review, design — all of it matters.

## Code of conduct

Read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). It is binding for everyone in this project's spaces (repository, discussion forums, chat, events).

## Ways to contribute

- **Translate.** Open a PR adding or completing a `messages/<locale>.json` catalog under any app. Source of truth is English (`en.json`); preserve ICU placeholders exactly.
- **Documentation.** The `docs/` directory and per-package `README` files are always under-served.
- **Bug reports.** File an issue with reproduction steps. For security issues, see [Security](#security).
- **Feature ideas.** Open a discussion before coding anything beyond a small fix — we keep scope tight (see [`CLAUDE.md`](CLAUDE.md) for what's in v0.1 vs. deferred).
- **Code.** Pick a `good first issue` or an unowned task. Small PRs beat large ones.

## Dev setup

```bash
git clone https://github.com/<org>/earthropy
cd earthropy
nvm use                # Node 22 from .nvmrc
corepack enable        # pnpm via Corepack
pnpm i
pnpm db:up             # Docker required
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The dev server starts: `app:3000`, `web:3001`, `api:3002`, `docs:3004`. MailHog UI at `localhost:8025`. MinIO console at `localhost:9001`.

## Before you commit

```bash
pnpm typecheck
pnpm lint
```

Both must pass. If your change touches DB schema, regenerate the migration and include it in the PR.

## Code style

- TypeScript strict mode. No `any` without a comment explaining why.
- Imports: cross-package via `@repo/<name>`; intra-app via `@/...`.
- Formatting + linting via Biome (`pnpm lint:fix`). Don't add ESLint or Prettier.
- One responsibility per package. If you're tempted to add a new concept to an existing package, ask in the PR.
- No new dependencies without justification. Every dep must be license-compatible (MIT, BSD, Apache-2.0, MPL, AGPL).

## Pull requests

- Branch from `main`. Keep PRs under ~400 lines diff where reasonable.
- One logical change per PR. Drive-by cleanups go in their own PR.
- Title format: `<area>: <verb-phrase>` (e.g., `moderation: add Ollama provider`).
- Reference an issue if one exists.
- Maintainers review and merge; see [`GOVERNANCE.md`](GOVERNANCE.md) for who decides what.

## UI / design work

We do not bolt on design. Visual / UX changes require a Plan-mode design pass first — propose 2–3 distinct aesthetic directions (reference products + typography + color system + motion) before any code. Accepted/rejected directions are logged in [`docs/design-patterns.md`](docs/design-patterns.md).

## Translations

Add `messages/<locale>.json` files alongside an app's existing English catalog. Preserve all `{placeholders}` and ICU plural syntax. We use Crowdin or similar in v0.2; for v0.1, hand-edit and review in PR.

## Security

If you find a security issue, **do not** open a public issue. Email <security@earthropy.org> (TBD; placeholder until DNS is set up) or use GitHub's private security advisory feature. We aim to acknowledge within 72 hours.

## License of your contributions

By contributing, you agree your work is licensed under [AGPL-3.0-or-later](LICENSE), matching the rest of the project. Don't paste code from incompatible licenses (proprietary, non-commercial, anti-fork clauses).
