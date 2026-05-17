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

### 2026-05-18 — Visual identity: Field Record synthesis
**Status**: accepted
**Surface**: shared (`@repo/design-system`, `apps/app`, `apps/web`)
**Direction:** A — Field Record (institutional / terminal mood; Bloomberg, NYPL, NASA, Hacker News as references) is the **spine** of the design system. Two pieces of identity are grafted in:
  - From B — Civic Atlas: the **mono-font color chip** pattern for SDG tagging, and the **atlas-card** layout (6px primary-SDG-colored top stripe) for group landings.
  - From C — Press Sheet: a **slim 4px persistent 17-cell color bar** at the top of the authenticated app shell as a global SDG navigator. NOT the full-bleed display flag from C; just the slim navigator.
**Typography (locked):**
  - Sans / display + UI: **IBM Plex Sans** (OFL, IBM)
  - Mono (chips, metadata, version strings, SDG numbers): **IBM Plex Mono** (OFL, IBM)
  - Arabic: **IBM Plex Sans Arabic** (OFL) for RTL surfaces
  - Optional editorial accent (landing hero only): **Source Serif 4** (OFL, Adobe) — to be used sparingly if at all; default to Plex Sans display
**Color system:**
  - Light: warm paper neutrals (off-white background, slightly warmer surface, grey-700 text)
  - Dark: near-black with cream text; SDG colors hold luminance — verified at AAA where text sits on neutral
  - SDG colors from `packages/sdg/src/sdgs.ts` are canonical; used as edge rules, chip fills, atlas-card stripes, color bar cells. Never as large fills with text on top (contrast risk).
**Rationale**: A's gravity matches the mission; bolting on B's chip pattern + atlas-card and C's 4px bar gives Earthropy one piece of ownable identity (the slim navigator) without sacrificing legibility or sober institutional feel. Full proposal at [`design-proposals/v0.1-initial.md`](design-proposals/v0.1-initial.md).
**Decided by**: orchestrator decision after agent recommendation; maintainer-approved by user "go ahead"
