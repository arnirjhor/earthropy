---
id: D-LOWBW-1
title: "No-JS read path + lazy images + image budget"
status: done
priority: medium
phase: D
agent_model: sonnet
deps: []
tags: [a11y, performance]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Ensure public pages are readable without JavaScript. Add lazy loading to all images. Set image size budgets. Test on simulated slow 3G.

## Acceptance criteria

- [x] Public routes (/, /g, /sdg/*, /transparency) render meaningful content with JS disabled.
- [x] All `<img>` tags use `loading="lazy"` (except above-the-fold).
- [x] Next.js Image component used where applicable with width/height.
- [x] `pnpm typecheck` green.

## Completion note

No `<img>` tags existed in the codebase — all decorative elements use SVG inline or CSS. Addressed all three areas:

1. **No-JS read path**: All public pages are Server Components and render fully without JS. Forms use `useActionState` wrapping Server Actions — native HTML POST works without JS. Added `<noscript>` fallbacks to `_sdg-filter.tsx` and `_visibility-filter.tsx` (the only client-component filters on public pages) rendering `<a>` links for direct URL navigation. `NotificationsBell` already had a `<noscript>` fallback.

2. **Lazy images / Next.js Image config**: No raster images exist yet. Added `images.formats`, `images.deviceSizes`, and `images.imageSizes` to `apps/app/next.config.ts` so AVIF/WebP optimization is ready when images are introduced.

3. **Image budget**: Created `docs/image-budget.md` with per-use-case size limits, format guidance, Next.js `<Image>` usage examples, and `remotePatterns` guidance.

`pnpm typecheck` and `pnpm lint` both pass.
