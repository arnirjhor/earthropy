---
id: A-AUTH-3
title: "Sign-up / sign-in / verify pages in apps/app"
status: backlog
priority: critical
phase: A
agent_model: sonnet
deps: [A-AUTH-1, A-AUTH-2, A-SHAD-1]
tags: [auth, ui, pages]
owner: ""
branch: ""
pr: ""
estimated_hours: 4
created: 2026-05-18
updated: 2026-05-18
---

## Description
The user-facing auth flow. Pages live under `apps/app/src/app/[locale]/(public)/` — sign-up, sign-in (password + magic link toggle), email verify confirmation, password reset request, password reset confirm. All Server-Actions-based; progressive enhancement; works without JS.

## Acceptance criteria
- [ ] Pages: `/signup`, `/signin`, `/verify-email`, `/forgot-password`, `/reset-password`.
- [ ] Server Actions handle each submission (Zod validation, calls into `@repo/auth`, sets session cookie on success).
- [ ] Errors render server-side via `useActionState`; same form works without JS (form posts to the same Server Action URL).
- [ ] Successful sign-up → email sent (MailHog catches in dev) → user is redirected to a "check your email" page.
- [ ] Verify token click → confirms email → redirects to dashboard.
- [ ] Magic-link flow: enter email → token emailed → click → signed in.
- [ ] All forms use shadcn `<Form>`, `<Input>`, `<Label>`, `<Button>` from A-SHAD-1.
- [ ] Field Record visual identity (Plex Sans body, Plex Mono for labels in small caps, warm-paper neutrals).
- [ ] AAA contrast verified by axe on each page.

## Test plan
- Unit: Server Actions tested in isolation (mocked auth + notifications).
- E2E (`e2e/auth.spec.ts`):
  - Sign up with new email → verify email via MailHog API → sign in → land on dashboard
  - Magic-link sign in
  - Password reset round-trip
  - Sign in with wrong password — friendly error, no enumeration leak

## Notes
The (authenticated) routes (dashboard, group create) are gated by middleware that checks the session cookie and redirects to `/signin?next=<path>` if absent. The middleware lands as a small follow-up commit at the end of this task.
