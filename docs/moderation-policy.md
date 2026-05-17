# Moderation Policy

Earthropy moderates content because open platforms without moderation become unusable, and unusable platforms cannot advance the SDGs. This document is a public, binding promise about how moderation works.

## Scope

This policy covers user-generated content on Earthropy: posts, comments, and group-level metadata. It does not cover private messages (v0.2+) or off-platform behavior.

## What gets removed

Content is rejected or held when it would meaningfully harm the platform's ability to serve its mission. The categories the AI moderator scores against:

- **Toxicity / harassment** — direct attacks, slurs, threats.
- **Hate** — content targeting people for who they are.
- **Sexual content** — explicit material; the platform is not a venue for it.
- **Self-harm content** — material promoting self-harm or suicide. (Help-seeking content is welcomed; routing details in v0.2.)
- **Violence** — incitement or graphic glorification.
- **Illegal content** — material that is illegal in the jurisdiction of the hosted instance.
- **Spam** — commercial promotion, link-stuffing, repetition, bot-driven content.
- **Misinformation** — claims of fact that are demonstrably false on topics that affect SDG outcomes (e.g., climate denial, vaccine misinformation). Held for human review when contested.
- **Off-topic** — content unrelated to the group's declared SDGs.

We do **not** moderate based on viewpoint within the SDG frame. People can disagree about strategies, priorities, and values. They cannot harass each other while doing so.

## How it works

1. When a user submits a post or comment, it is saved with status `pending_ai` and shown to the author as "under review."
2. A background worker calls the configured `ModerationProvider` (default: Anthropic Claude; self-hosters may swap to a local model).
3. The provider returns a score in [0, 1] for each category and a short reasoning string.
4. The policy layer applies thresholds:
   - All scores below `autoPublishMax` (default 0.25) → **auto_publish**.
   - Any score at or above `autoRejectMin` (default 0.85) → **auto_reject** (the author sees the reason and can appeal).
   - Otherwise → **hold_for_review** (a group moderator or platform anchor sees it in their queue).
5. Trusted authors (reputation ≥ `trustedReputation`, default 500) skip `hold_for_review` and auto-publish borderline content — they remain subject to community report-based review.

## Transparency promise

- Every moderation decision is logged in the `moderation_decisions` table with the provider, model, scores, and reasoning.
- These rows are **immutable**. Corrections happen by inserting a follow-up decision (e.g., a moderator override), never by editing the original.
- A public transparency page (Phase D) exposes aggregate stats: decisions per category, override rate, appeal volume, time-to-resolution.
- AI provider and model identifiers are surfaced to authors when their content is held or rejected.

## Appeals

Any author whose content was rejected or held can file an appeal with a written explanation. A platform moderator reviews. Outcomes:

- **Overturn** — content publishes; the author gets a reputation bump.
- **Uphold** — original decision stands; the author can request escalation to the core team if they believe the decision violates this policy.
- **Refer** — policy is ambiguous; the core team adjudicates and (if needed) revises this document.

Appeals are resolved within 7 days for the hosted instance. Self-hosters set their own SLA.

## What we will not do

- We will not censor lawful viewpoints within the SDG frame.
- We will not use moderation data to train any AI model not part of the Earthropy moderation pipeline.
- We will not sell moderation logs or share them with third parties for any purpose other than law-enforcement requests backed by valid legal process (and we will publish a transparency report of such requests).
- We will not allow advertisers, donors, or governments to dictate moderation outcomes.

## Changing this policy

This document is normative. Changes require a core-team decision per [`GOVERNANCE.md`](../GOVERNANCE.md), a written rationale in the commit, and a 14-day comment period before taking effect.

## Reporting content

The "Report" button on posts and comments creates a moderation queue entry visible to group moderators and platform anchors. Repeated abuse of the report function is itself a violation.
