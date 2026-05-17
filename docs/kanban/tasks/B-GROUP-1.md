---
id: B-GROUP-1
title: "Groups CRUD: Server Actions + DB layer + tests"
status: ready
priority: critical
phase: B
agent_model: sonnet
deps: [A-AUTH-1]
tags: [groups, community, server-actions, db]
owner: ""
branch: ""
pr: ""
estimated_hours: 4
created: 2026-05-18
updated: 2026-05-18
---

## Description
The first community primitive. A new `@repo/groups` package (or a `groups/` module under `@earthropy/app` — Builder picks the simpler one, prefer package if shared with `apps/api`) provides the data layer + Server Actions for creating, reading, updating, and (soft-)closing groups, plus the SDG tag M2M with exactly-one-primary invariant.

The DB schema already exists (`packages/database/src/schema/groups.ts` — `groups`, `group_sdgs`, `group_members`). Do NOT add new columns or migrations.

## Acceptance criteria

- [ ] Pure-logic helpers in `packages/groups/` (new package):
  - `createGroup({ slug, name, description, primarySdgId, additionalSdgIds, visibility, preferredLocale, locationText, createdBy })` — wraps an insert + the group_sdgs rows in one transaction; enforces exactly one `primary` per group via the join-table rows.
  - `getGroupBySlug(slug)` — returns the group with its SDG rows joined.
  - `listGroups({ sdgIds?, visibility?, limit, offset })` — paginated faceted browse.
  - `updateGroup(id, { fields }, { actorId })` — authorization gate: actor must be owner or moderator.
  - `closeGroup(id, { actorId })` — soft-close (set a `closed_at`? — no, schema has no such column; instead set `visibility = 'private'` and document the convention. **Builder decides which** based on what the schema allows; do not add columns.)
- [ ] Server Actions in `apps/app/src/app/[locale]/(authenticated)/g/_actions.ts`:
  - `createGroupAction(formData)` — Zod validation, calls `createGroup`, redirects to `/g/<slug>`.
  - `updateGroupAction(id, formData)`.
- [ ] Slug generator: derive from name (kebab-case, ASCII fallback for non-Latin), uniqueness suffix on collision.
- [ ] Membership: when `createGroup` succeeds, automatically insert a `group_members` row for `createdBy` with role `owner`.
- [ ] All tests pass; coverage ≥ 85% for `@repo/groups`.

## Test plan
- `packages/groups/src/createGroup.test.ts` — happy path; primary-SDG-uniqueness invariant; rollback on failed group_sdg insert; auto-membership inserted.
- `packages/groups/src/listGroups.test.ts` — SDG filter; visibility filter; pagination cursor.
- `packages/groups/src/updateGroup.test.ts` — owner can update; member cannot; closed groups reject mutations.
- `packages/groups/src/slug.test.ts` — kebab-case, ASCII fold, collision suffix.

## Notes
- DB test pattern: use the running Postgres on :5434; wrap test assertions in a setup/teardown that inserts test users + groups and deletes them in `finally`. Mirror `@repo/auth`'s pattern.
- No UI in this task — pure data layer + the Server Actions that the upcoming `B-GROUP-2` form will call.
- Trust the schema's referential integrity; don't double-check FKs in app code.
- Use `@repo/sdg`'s `isSdgId` + `getSdgById` to validate incoming SDG selections.
