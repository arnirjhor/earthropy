---
id: B-GROUP-5
title: "Membership: join/leave/invite + role transitions"
status: done
priority: high
phase: B
agent_model: sonnet
deps: [B-GROUP-1]
tags: [groups, membership, ui]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Membership management for groups: invite by email (issues a single-use token to claim membership), revoke pending invites, role transitions (owner can promote member → moderator, demote, transfer ownership). Private groups become joinable via invite link.

## Acceptance criteria

- [ ] Extend `@repo/groups`:
  - `inviteToGroup({ groupId, inviterId, email, role: 'member'|'moderator' })` — issues a single-use token (via `@repo/auth`'s tokens primitive with a new `tokenPurpose='group_invite'` — schema enum already extensible, OR store invites in a new in-memory pattern; Builder picks). Sends email via `sendTransactional` (uses an `invite.tsx` React Email template — add it).
  - `claimInvite(token, userId)` — consumes token, inserts `group_members` row with the role.
  - `revokeInvite(tokenId, actorId)` — owner/moderator only.
  - `setMemberRole(groupId, userId, newRole, actorId)` — owner can promote/demote; only owners can manage owners.
  - `transferOwnership(groupId, newOwnerId, actorId)` — current owner; atomic.
- [ ] UI: `/g/<slug>/members` page (owner + moderator only) listing members + pending invites + actions.
- [ ] Server Actions for each.
- [ ] Tests: invite happy path; invite to non-existent email creates a pre-account row (or returns "user not found" — Builder decides; document); claim consumes token; role transitions enforce hierarchy.

## Test plan

- `packages/groups/src/inviteToGroup.test.ts`, `claimInvite.test.ts`, `setMemberRole.test.ts`, `transferOwnership.test.ts`.
- `e2e/group-members.spec.ts` — owner invites a second user → second user claims via emailed link → second user appears in members list.

## Notes

- Reuse `@repo/auth`'s tokens table. If `tokenPurpose` enum needs `'group_invite'`, this is the one schema migration we allow for B-GROUP-5 (additive).
- The email template lives in `@repo/notifications`.
- No new top-level deps.
