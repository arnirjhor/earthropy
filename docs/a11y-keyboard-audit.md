# Keyboard Navigation Audit — D-KEYBOARD-1

## Scope

All interactive components under `packages/design-system/src/components/` and `apps/app/src/` were audited for keyboard accessibility.

## What was tested

- Focus ring visibility on all interactive elements (buttons, links, inputs, selects, textareas)
- `focus-visible:` vs `focus:` correctness (ring should not show on mouse click)
- Skip-to-content link presence
- `id="main-content"` anchor on all `<main>` elements
- Escape key closes custom dropdowns
- Tab order (no `tabIndex > 0` found — none present in codebase)
- ARIA roles/labels on custom tab interfaces, dialogs, and filter controls
- No `<div onClick>` patterns found — all click handlers are on semantic elements

## Issues found and fixes applied

### 1. Skip-to-content link missing
**Files:** `apps/app/src/app/layout.tsx`, all 23 `page.tsx` files with `<main>`

Added a visually-hidden skip link at the top of `<body>` that becomes visible on focus. Added `id="main-content"` to every `<main>` element across all pages.

### 2. Focus ring using `focus:` instead of `focus-visible:`
Textareas and selects were using `focus:outline-none focus:ring-2` which shows the ring on mouse click. Fixed to `focus-visible:`.

**Files fixed:**
- `apps/app/src/app/[locale]/(authenticated)/_appeal-form.tsx` — textarea
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/p/[id]/_reply.tsx` — textarea
- `apps/app/src/app/[locale]/(authenticated)/account/_form.tsx` — locale select
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/members/page.tsx` — invite email input and role select

### 3. Buttons missing focus-visible styles entirely
Multiple custom buttons had hover styles but no keyboard focus indicator.

**Files fixed:**
- `apps/app/src/app/[locale]/(authenticated)/_appeal-form.tsx` — trigger, submit, cancel buttons
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/p/[id]/_reply.tsx` — reply trigger, submit, cancel buttons
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/p/[id]/_withdraw-button.tsx` — withdraw button
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/p/[id]/_withdraw-comment-button.tsx` — withdraw button
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/members/page.tsx` — Send invite, Promote, Demote, Make owner, Remove buttons
- `apps/app/src/app/[locale]/(authenticated)/_shell/NotificationsBell.tsx` — "Mark all read", individual "read" buttons, "View all" link
- `apps/app/src/app/[locale]/(authenticated)/g/[slug]/post/new/_form.tsx` — Write/Preview tab buttons

### 4. NotificationsBell dropdown did not close on Escape
**File:** `apps/app/src/app/[locale]/(authenticated)/_shell/NotificationsBell.tsx`

Added `keydown` listener for `Escape` alongside the existing `mousedown` outside-click handler. Both listeners are cleaned up on dropdown close.

### 5. AtlasCard link missing focus ring
**File:** `packages/design-system/src/components/AtlasCard.tsx`

The card's wrapping `<Link>` had no focus-visible style. Added `focus-visible:outline` classes.

### 6. SdgColorBar links missing focus ring
**File:** `packages/design-system/src/components/SdgColorBar.tsx`

Each SDG cell link (4px tall) lacked an individual focus indicator. Added `focus-visible:outline` to each link. The bar's `focus-within` expansion still works alongside this.

### 7. Profile form success messages — wrong ARIA element
**File:** `apps/app/src/app/[locale]/(authenticated)/account/_form.tsx`

Linter (Biome `useSemanticElements`) flagged `<p role="status">` — changed to semantic `<output>` element which has implicit `status` role and `aria-live="polite"`.

## Components confirmed already correct

- `packages/design-system/src/components/ui/button.tsx` — has `focus-visible:ring-2` in base CVA class
- `packages/design-system/src/components/ui/input.tsx` — has `focus-visible:ring-2`
- `packages/design-system/src/components/ui/dialog.tsx` — Radix `DialogPrimitive` handles Escape natively; close button has `focus:ring-2`
- `packages/design-system/src/components/ui/tabs.tsx` — Radix `TabsPrimitive` handles arrow keys, `focus-visible:ring-2` in base class
- `packages/design-system/src/components/SdgMultiSelect.tsx` — uses native `<input type="checkbox">` and `<input type="radio">`, both natively focusable
- `apps/app/src/app/[locale]/(public)/g/_sdg-filter.tsx` — had `focus-visible:outline` correctly
- `apps/app/src/app/[locale]/(public)/g/_visibility-filter.tsx` — had `focus-visible:outline` correctly
- All moderation page buttons (publish/reject/uphold) — had `focus-visible:outline` correctly
- All pagination links — had `focus-visible:outline` correctly
- Auth forms (sign-in, sign-up, forgot-password, reset-password) — use `Button` and `Input` from design-system, both correct

## Remaining known issues

- `SdgColorBar` links are 4px (or 8px when focused) tall — the focus ring is visible but the click/tap target is small. This is a structural design decision (the bar is meant to be slim); a larger target would require a design change.
- No focus-trap testing was done without a browser. Radix Dialog implements a focus trap natively. The NotificationsBell `<dialog>` element does not trap focus (it uses the native `open` attribute rendering, not modal). This is acceptable for a non-modal dropdown; users can tab out freely.
