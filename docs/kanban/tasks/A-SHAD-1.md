---
id: A-SHAD-1
title: "Init shadcn/ui in @repo/design-system + base components"
status: ready
priority: critical
phase: A
agent_model: sonnet
deps: []
tags: [design-system, ui, foundation]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Initialize shadcn/ui inside `@repo/design-system` so every subsequent UI Builder can pull primitives without re-deciding the contract. Tailwind v4 `@theme` is already wired in `packages/design-system/src/theme.css`; reuse those tokens. Install the canonical base set: Button, Input, Label, Form, Card, Badge, Avatar, Dialog, Sheet, Toast (via Sonner).

Wire the components to consume the Field Record token palette — buttons get warm-paper neutrals, primary surfaces use Plex Mono uppercase small caps for actions, inputs use the border + radius tokens already defined. Do not introduce a new color system.

## Acceptance criteria
- [ ] `packages/design-system/components.json` configured for monorepo (Tailwind v4, src dir, base path).
- [ ] Components installed into `packages/design-system/src/components/ui/`: `button`, `input`, `label`, `form`, `card`, `badge`, `avatar`, `dialog`, `sheet`. Toasts via Sonner (separate dep).
- [ ] Sonner installed as a dep of `@repo/design-system`; `<Toaster />` exported.
- [ ] Each component re-exported from `packages/design-system/src/index.ts` (or a `ui` barrel).
- [ ] All components consume design tokens from `theme.css` — no inline color hex values.
- [ ] Existing `SdgChip`, `SdgColorBar`, `AtlasCard` continue to work unchanged.
- [ ] Component tests (Vitest + React Testing Library): a `<Button>` renders with the correct token classes; a `<Dialog>` opens/closes via keyboard.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass.

## Test plan
- `packages/design-system/src/components/ui/button.test.tsx` — render variants; assert correct class strings; keyboard activation triggers `onClick`.
- `packages/design-system/src/components/ui/dialog.test.tsx` — open with `<button>` click; close with Escape; focus trap holds.

## Notes
shadcn's Tailwind v4 path is `pnpm dlx shadcn@canary init`. If the CLI insists on a workspace `tailwind.config`, point it at `packages/design-system/tailwind.config.ts` (create as empty re-export since v4 is CSS-first). Don't accept dark-mode-via-`class` — we use `prefers-color-scheme` already.
