# Governance

Earthropy is **managed open source**: anyone can contribute, but a small set of maintainers stewards the codebase and the platform. This document is the source of truth on who decides what and how to become a maintainer.

## Roles

### Contributors
Anyone who has a PR, issue, translation, or doc change merged. No formal nomination. The bar is "your work was useful and met our standards." Contributors have no special permissions on the repository itself — they participate the same way anyone else does.

### Maintainers
The people with merge rights on the main repository and on the `earthropy.org` deployment. Responsibilities:

- Reviewing and merging PRs.
- Triaging issues.
- Releasing versions.
- Stewarding the moderation policy and incident response.
- Speaking on behalf of the project in collaborations with NGOs, the UN, foundations.

Maintainers commit to acting in the project's stated mission — coordinating action on the 17 SDGs, forever free, corp-agnostic — over any personal, employer, or commercial interest.

### Core team
A subset of maintainers who can decide on architectural direction, license decisions, governance changes, and admit new maintainers. The core team is small by design (target: 3–7 people). Initial core team is named when v0.1 ships.

### Moderators (platform — not codebase)
Community members who staff the moderation queue on `earthropy.org`. Separate from maintainers; see [`docs/moderation-policy.md`](docs/moderation-policy.md).

## Becoming a maintainer

Standard path:
1. Sustained, high-quality contributions over months (code, docs, review, triage — any of these qualify).
2. An existing maintainer nominates you in a private channel.
3. Existing maintainers reach lazy consensus (no objection within 7 days).
4. You're added to the GitHub team and the contact list.

There's no quota or election cycle. Earthropy doesn't want to be a popularity contest; it wants reliable stewards.

## How decisions get made

### Day-to-day (PR merges, small changes)
Any maintainer can merge a PR after review. If a PR draws objection, hold and discuss until consensus.

### Architectural changes
Open an RFC issue (label: `rfc`). Discussion stays open for at least 7 days. Lazy consensus among maintainers approves; core team can veto.

### License or governance changes
Core team decision. Cannot be made by a single maintainer.

### Maintainer disagreements
Talk it out. If unresolved after a reasonable attempt, the core team decides. If the disagreement is with the core team itself, the project has a problem larger than this document can solve — convene mediators from outside the project.

### Mission drift
If a decision would compromise the stated mission (forever free, corp-agnostic, universally accessible, transparent moderation), any maintainer can flag it. The change requires explicit core-team approval and a written rationale.

## Conflicts of interest

Maintainers disclose:
- Employment at organizations that consume or compete with Earthropy.
- Funding relationships that could influence decisions.
- Affiliations with groups that hold strong positions on contested SDG topics (e.g., fossil-fuel lobbies for SDG 13).

Disclosed conflicts don't bar participation; undisclosed ones do.

## Funding

Earthropy's hosted instance is funded by grants, foundations, and individual donors. The project does not accept funding that comes with editorial or moderation conditions. Funders are listed publicly. Funding decisions are core-team scope.

## Removal of maintainers

Causes for removal:
- Code of Conduct violations.
- Acting against the stated mission for personal, employer, or commercial benefit.
- Disappearance (12+ months of zero participation).

Removal is a core-team decision; the affected person is informed and given a chance to respond before the decision is finalized.

## Forking

Earthropy is AGPL. Anyone can fork. We hope forks happen for the same reason we hope governments fork laws — to adapt to local context. If a fork supplants us by being better-stewarded, that's a win for the mission, not a loss for us.

## Open questions

- A **transparent council** model (a body with elected community representatives, separate from the core team) is on the v2 governance roadmap. The initial managed-open-source structure is designed to bootstrap a community before adding democratic structure.
- **Bus-factor protection** — the project needs at least one neutral non-profit backstop that holds the domain, infrastructure credentials, and license assets. Identifying that institution is a v1 task.
