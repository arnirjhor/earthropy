---
id: B-POST-3
title: "Post detail page + moderation-status indicator"
status: ready
priority: high
phase: B
agent_model: sonnet
deps: [B-POST-1]
tags: [posts, ui, pages]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Real post detail page at `apps/app/src/app/[locale]/(authenticated)/g/[slug]/p/[id]/page.tsx` (currently a placeholder from B-POST-2). Renders the post body (sanitized markdown), SDG chips, moderation-status banner if the post is not `published`, and a withdraw button if the viewer is the author and the post is `published`.

## Acceptance criteria

- [ ] Replaces placeholder with full server component.
- [ ] Fetches post via `getPostById` from `@repo/posts`; 404 if absent.
- [ ] Renders body using `marked` + `DOMPurify` (already deps of apps/app).
- [ ] Header row: title, author handle (link to profile, even if profile is just /u/[handle] stub), post SDGs as `SdgChip` row, status pill.
- [ ] If `status !== 'published'`, render a banner explaining what's happening: `pending_ai` ("Under AI review"), `pending_review` ("Held for human review"), `rejected` ("Rejected — reason: …; appeal available"), `withdrawn` ("Withdrawn by author"). Use the `status_reason` field for the rejection/hold reason.
- [ ] Visibility rules: `pending_ai` + `pending_review` visible only to author + group moderators; `rejected` visible only to author; `withdrawn` visible only to author + moderators (audit access).
- [ ] If author + status='published' → render a "Withdraw" Server Action button calling `withdrawPostAction`.
- [ ] AAA contrast; RTL works.

## Test plan
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/p/[id]/page.test.tsx` — render with each status; visibility rules.
- `e2e/post-detail.spec.ts` — sign in → create post → land on detail → withdraw → re-render shows withdrawn banner.

## Notes
- Comments are NOT in this task — B-COMMENT-2 inserts the thread component into this page later.
- Use `@repo/posts`'s `getPostById`; don't query Drizzle directly from the page.
- No new top-level deps.
