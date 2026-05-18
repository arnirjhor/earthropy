---
id: A-AUTH-2
title: "SMTP transport via Nodemailer + React Email templates"
status: done
priority: critical
phase: A
agent_model: sonnet
deps: [A-AUTH-1]
tags: [auth, notifications, email]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Wire `@repo/notifications` to actually send transactional email via SMTP (MailHog in dev). Add React Email templates for the three auth flows: email verification, magic-link sign-in, password reset. Templates render to both HTML and plaintext.

## Acceptance criteria
- [ ] `nodemailer` and `react-email` (and `@react-email/components`) added to `@repo/notifications` (all MIT).
- [ ] `sendTransactional({ to, template, props })` resolves a `SmtpTransport` from env (`SMTP_*` vars).
- [ ] Three templates under `packages/notifications/src/emails/`: `verify-email.tsx`, `magic-link.tsx`, `password-reset.tsx`. Each renders HTML + plain text.
- [ ] Templates honor user locale (passed as prop) and Earthropy's voice (sober, direct, no marketing).
- [ ] All templates pass mail-tester-like checks: plain text alternative present, no broken links, sufficient color contrast in HTML.
- [ ] Sending in dev hits MailHog; the messages appear at `localhost:8025`.

## Test plan
- `packages/notifications/src/transactional.test.ts` — mock SMTP; assert payload structure for each template; locale switching renders the correct strings; plaintext is generated.
- `packages/notifications/src/emails/verify-email.test.tsx` (and siblings) — snapshot test of the rendered HTML for `en` and `ar` (RTL).

## Notes
Resend stays as an *optional* adapter (commented config block + a one-line README note); SMTP is the default to preserve the corp-agnostic story.
