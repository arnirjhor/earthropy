---
id: B-POST-2
title: "Post create form + markdown editor (textarea + preview)"
status: ready
priority: high
phase: B
agent_model: sonnet
deps: [B-POST-1, A-SHAD-1]
tags: [posts, ui, server-actions]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Page at `/g/<slug>/post/new` in `apps/app`. Plain `<textarea>` for markdown body (no heavy editor in v0.1) with a server-rendered preview toggle, plus a per-post SDG multi-select that defaults to the group's SDG set (user may narrow). Calls `createPostAction` from B-POST-1.

## Acceptance criteria

- [ ] Page at `apps/app/src/app/[locale]/(authenticated)/g/[slug]/post/new/page.tsx` + `_form.tsx`.
- [ ] Server checks: user is signed in + group member; otherwise 403.
- [ ] Form fields: title, body (textarea, char counter), `SdgMultiSelect` defaulting to the group's `group_sdgs` (with the group's primary pre-selected as the post's primary).
- [ ] Submit → `createPostAction` → redirects to `/g/<slug>/p/<id>` on success.
- [ ] Markdown rendering: server-side using `marked` (MIT) + sanitization via `DOMPurify` (MIT). Add both to `apps/app` if not present. Render under a "Preview" tab when JS is enabled; non-JS users see raw markdown which is fine for v0.1.
- [ ] AAA contrast, RTL, axe-clean.

## Test plan
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/post/new/_form.test.tsx` — preview toggle renders escaped markdown; char counter increments.
- `e2e/post-create.spec.ts` — sign in → create group → navigate `/g/<slug>/post/new` → write a post → submit → assert landing on `/g/<slug>/p/<id>` showing the post as `pending_ai`.

## Notes
- `marked` + `DOMPurify` are both MIT, allowlist.
- Don't ship an editor library. The mission audience writes long-form text; a textarea is sufficient and zero-bundle.
