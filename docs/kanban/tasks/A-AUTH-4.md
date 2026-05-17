---
id: A-AUTH-4
title: "Profile + settings pages (locale, notification prefs)"
status: backlog
priority: high
phase: A
agent_model: sonnet
deps: [A-AUTH-3]
tags: [auth, ui, settings]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Authenticated user can edit their profile (`display_name`, `handle`, `locale`) and notification preferences (in-app + email opt-ins per notification kind). Active sessions list with revoke. Account deletion (soft-disable, retains audit rows).

## Acceptance criteria
- [ ] `/account` route shows profile + active sessions + notification prefs.
- [ ] Handle change is allowed; uniqueness check; rate-limited (one change per 30 days).
- [ ] Locale change persists to `users.locale`, immediately switches the UI.
- [ ] Notification prefs persist (new table `notification_preferences` if needed — but prefer a JSON column on `users` to avoid schema churn).
- [ ] Active sessions list shows User-Agent + last-seen + revoke button per session.
- [ ] Account deletion sets `users.disabled_at`; user is signed out and shown a confirmation.
- [ ] All actions via Server Actions; no JS needed for the read path.

## Test plan
- E2E (`e2e/account.spec.ts`): edit display name, switch locale, revoke other session, delete account → sign-in blocked.
- Unit: notification pref logic (which kinds are enabled by default).

## Notes
Use the existing `sessions` schema; "User-Agent" is the truncated value already stored. Don't add geo-IP or other inference.
