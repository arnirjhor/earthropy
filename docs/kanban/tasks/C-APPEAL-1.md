---
id: C-APPEAL-1
title: "Appeal submission + resolution UI + reputation impact"
status: ready
priority: high
phase: C
agent_model: sonnet
deps: [C-PIPE-1]
tags: [moderation, appeals, ui]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Closes the moderation loop from the user's side. When a post/comment is rejected, the author can file an appeal (free-text rationale). Group moderators see appeals in their queue; resolution writes a moderation_decisions row + a status transition + a reputation event (positive if upheld).

## Acceptance criteria

- [ ] Server Action `submitAppealAction({ targetType, targetId, message })`:
  - Author-only (caller must match the target's authorId).
  - Inserts an `appeals` row (existing schema in `packages/database/src/schema/moderation.ts`).
  - Rate-limited (one appeal per post/comment).
- [ ] "Appeal" button on the post/comment detail page status banner when status='rejected' (extend B-POST-3's banner + B-COMMENT-2's comment status indicator).
- [ ] Appeal form page or inline: `_appeal-form.tsx` (client component for useActionState).
- [ ] Moderator queue (C-QUEUE-UI-1's `/moderation`) gains an "Appeals" tab listing unresolved `appeals` rows for the moderator's authority scope.
- [ ] `resolveAppealAction({ appealId, resolution: 'upheld'|'rejected', resolutionMessage })`:
  - Moderator/anchor only.
  - Updates the appeal row (resolution, resolvedBy, resolvedAt).
  - If upheld: writes a `moderation_decisions` row with `verdict='human_publish'`, transitions target to `published`, calls `recordEvent({ kind: 'appeal_resolved_for_user', userId: targetAuthorId })`.
  - If rejected: writes `moderation_decisions` with `verdict='human_reject'`, status remains rejected, no reputation impact.
- [ ] Notification fires to the appeal author on resolution (kind: 'appeal_resolved').

## Test plan

- `apps/app/src/app/[locale]/(authenticated)/_appeal-form.test.tsx` — submit success + already-appealed rejection.
- `apps/app/src/app/[locale]/(authenticated)/moderation/appeals/page.test.tsx` — authority gate; list pending.
- `e2e/moderation-appeal.spec.ts` — submit rejected post → file appeal → moderator upholds → post published + author rep +2.

## Notes

- Reuse existing components; no new top-level deps.
- The appeals table is already in schema. Don't change.
