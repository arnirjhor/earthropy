---
id: B-GROUP-2
title: "Group create form + slug-gen + SDG multi-select"
status: ready
priority: critical
phase: B
agent_model: sonnet
deps: [B-GROUP-1, A-SHAD-1]
tags: [groups, ui, server-actions]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
The `/g/new` page in `apps/app`. A real group-creation form using the `createGroupAction` Server Action already wired by B-GROUP-1. The form needs: name (auto-derives slug; user can override), description, visibility radio (public / listed / private), preferred locale select, optional free-text location, and a **SDG multi-select with exactly-one-primary** semantic — the 17 SDGs as chips, one marked primary (radio-like), the rest as secondary (multi-select checkboxes within the chip).

Field Record visual identity throughout. No JS required for the read+submit path.

## Acceptance criteria

- [ ] Page at `apps/app/src/app/[locale]/(authenticated)/g/new/page.tsx` + a client `_form.tsx` for `useActionState`.
- [ ] Server Action posted from the form is the existing `createGroupAction` from `apps/app/src/app/[locale]/(authenticated)/g/_actions.ts` (call it; don't re-create).
- [ ] Slug field auto-fills from name on the client (`useEffect` watching name input), but the server independently re-derives via `@repo/groups`' `toSlug` if the slug field is empty. No JS, server-derives.
- [ ] SDG multi-select component (new): `<SdgMultiSelect />` lives in `@repo/design-system/src/components/SdgMultiSelect.tsx`. Props: `sdgs: Sdg[]` (defaults to `SDGS`), `name` prefix for form fields. Each chip toggleable; one chip marked primary at any time; primary defaults to the first selected.
- [ ] Form validation errors render server-side via `useActionState`; client enhancements (auto-slug) are optional.
- [ ] Successful submit redirects to `/g/<slug>`.
- [ ] AAA contrast; axe-a11y zero serious/critical; RTL works.

## Test plan

- `packages/design-system/src/components/SdgMultiSelect.test.tsx` — interactive test of chip selection, primary toggle, form data shape produced.
- `e2e/group-create.spec.ts` — sign in as a seeded user (via MailHog verify flow OR a test-only fixture session); navigate to `/g/new`; fill form; pick SDGs; submit; assert landing on `/g/<slug>`; assert membership row exists for the creator.

## Notes

- `createGroupAction` already exists; do not re-implement.
- The schema's `group_sdgs.primary` is a boolean; exactly one must be true per group. The action enforces this; the form should pre-validate so the action gets clean input.
- Do not add new top-level deps. Compose using existing shadcn primitives + the SDG color palette.
