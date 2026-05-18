# v0.2 Contributor Backlog

Planned items for the v0.2 release. None of these are assigned. If you want to work on one, open a GitHub discussion first so we can coordinate scope and avoid duplicate effort.

Complexity key: **S** = a few days, **M** = 1–2 weeks, **L** = multiple weeks + design discussion.

---

## Plugin SDK / MCP integrations

**Complexity: L**

Define a stable extension interface that lets third parties hook into the moderation and notification pipelines without forking the core. The pattern for the interface contract already exists in `packages/moderation/src/provider.ts` — this work generalises it into a first-class Plugin API and provides MCP server bindings so AI agents can call Earthropy actions.

Scope includes: interface definition, versioning strategy, an example plugin, and docs.

---

## AI community-manager agent

**Complexity: M**

An opt-in background agent (BullMQ worker + LLM calls) that:
- surfaces stale discussions to group admins
- suggests relevant groups to new members based on their SDG interests
- drafts weekly digest emails (optional, off by default)

Must be fully opt-in at the instance level and the user level. Provider must be swappable (Anthropic default, Ollama fallback).

---

## LLM-translated post bodies

**Complexity: M**

On-demand translation of post and comment bodies using a pluggable translation provider. Target providers: LibreTranslate (self-host, default) and DeepL (managed, opt-in). Translations are cached, never stored as the canonical text. The original language is always preserved and shown.

Scope includes: translation provider interface in `packages/`, UI to toggle translated view, cache layer.

---

## GitHub Actions CI pipeline

**Complexity: S**

Automated pipeline that runs on every PR and push to `main`:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- Docker image build smoke test

The repo has no CI today; all checks are manual. This is a good first medium-sized task for someone familiar with GitHub Actions and Turborepo.

---

## More locale translations

**Complexity: S per locale**

Each locale is an independent S-complexity task. Locales wanted next (in rough priority order):

1. Spanish (`es`)
2. Japanese (`ja`)
3. Bahasa Indonesia (`id`)
4. Korean (`ko`)
5. Turkish (`tr`)
6. Bengali (`bn`)

Copy `apps/app/messages/en.json` (and equivalents in `apps/web`, `apps/docs`) to the new locale file. Register the locale in `packages/i18n/src/locales.ts`. Mark RTL in that file if applicable.

---

## Federation exploration (ActivityPub)

**Complexity: L — research spike first**

A research spike to answer: what would federated groups and posts cost in terms of schema changes, identity model changes, and protocol complexity? No commitment to ship in v0.2; the spike should produce a short design doc with a recommendation. If the recommendation is "yes, do it", implementation follows in a later version.

---

## Verifiable outcome tracking

**Complexity: L**

Let groups and posts link to specific UN SDG indicator metrics and report measurable progress. For example, a reforestation group could attach their work to SDG 15.2.1 (forest area as proportion of total land area) and log hectares restored.

This requires: indicator metadata in `packages/sdg/`, a new `outcomes` table, UI to attach/report outcomes, and a public read API. Verification of reported numbers is out of scope for v0.2.
