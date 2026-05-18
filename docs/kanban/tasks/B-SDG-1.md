---
id: B-SDG-1
title: "/sdg/[code] hub: groups + posts faceted"
status: ready
priority: high
phase: B
agent_model: sonnet
deps: [B-GROUP-1, B-POST-1]
tags: [sdg, ui, pages]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Public hub page at `/sdg/[code]` (e.g. `/sdg/climate-action`) — discoverability for each of the 17 SDGs. Header with the SDG's color/name/description (from `@repo/sdg`). Two sections: "Groups working on this" (uses `listGroups({ sdgIds: [n] })`) + "Recent posts tagged" (uses `listPosts` filtered by post_sdgs). Follow/unfollow toggle for authenticated viewers.

## Acceptance criteria

- [ ] Page at `apps/app/src/app/[locale]/(public)/sdg/[code]/page.tsx`.
- [ ] `notFound()` if code isn't a valid SDG code (use `isSdgCode` from `@repo/sdg`).
- [ ] Header: 6px top stripe in the SDG's color; goal number (Plex Mono display); name (Plex Sans display); description; link to the official UN indicators URL (from `@repo/sdg`).
- [ ] Groups section: AtlasCard grid (max 12, "see all" → `/g?sdgs=<id>`).
- [ ] Posts section: compact PostCard list (max 25 most recent published, links to /g/[slug]/p/[id]).
- [ ] Follow/unfollow toggle (Server Action) for authenticated viewers; uses `user_followed_sdgs` table.
- [ ] AAA contrast; RTL; axe-clean.

## Test plan

- `page.test.tsx` — render with each SDG code; unknown code → 404; follow toggle.
- `e2e/sdg-hub.spec.ts` — navigate to /sdg/climate-action → groups + posts visible.

## Notes

- Reuse `AtlasCard` + the compact PostCard from B-GROUP-4 (`apps/app/src/app/[locale]/(authenticated)/g/[slug]/_post-card.tsx` — extract to a shared location if needed).
- The SDG color CSS var (`--sdg-{n}`) is already injected globally.
- No new top-level deps.
