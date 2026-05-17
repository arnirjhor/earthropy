# Design Patterns

Accepted and rejected design directions for Earthropy. Append entries as decisions are made — do not edit historical entries in place; add a new one referencing the change.

The visual identity has not yet been decided. UI work begins after a Plan-mode design pass that proposes 2–3 distinct directions; selections and rejections both land here.

## Format

Each entry:

```
### YYYY-MM-DD — <short title>
**Status**: accepted | rejected | superseded by ___
**Surface**: which app / which screen / shared
**Direction**: typography pair, color system, motion treatment, reference products
**Rationale**: why this fits / does not fit Earthropy
**Decided by**: <person or "core team">
```

## Entries

### 2026-05-18 — SDG color palette is canonical
**Status**: accepted
**Surface**: shared (`@repo/sdg`, `@repo/design-system`)
**Direction**: The 17 official UN SDG colors (hex codes in `packages/sdg/src/sdgs.ts`) are the only acceptable color identity for SDG-tagged surfaces. They drive CSS custom properties `--sdg-1` through `--sdg-17` injected by the locale layout in `apps/app/src/app/[locale]/layout.tsx`.
**Rationale**: The UN SDG colors are widely recognized; using them confers legitimacy and reduces visual decisions. Override is grounds for objection in PR review.
**Decided by**: core team (founding decision)

### 2026-05-18 — Default fonts are forbidden
**Status**: accepted
**Surface**: shared
**Direction**: Inter, Roboto, Arial, system-ui, and similar generic UI fonts are not allowed as the project's typography. Pair selection is open and pending the design pass.
**Rationale**: Distinctive design is part of the platform's signal that the work matters. Default fonts read as "AI demo" and undermine credibility with NGOs and serious contributors.
**Decided by**: founding decision

### 2026-05-18 — No glassmorphism, no purple-on-white gradients
**Status**: accepted
**Surface**: shared
**Rationale**: Same as above — these are 2020-era AI-demo aesthetics. They will not feel right with the gravity of the mission.
**Decided by**: founding decision
