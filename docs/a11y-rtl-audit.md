# RTL Audit — D-RTL-1

## Scope

All `.tsx` files in `apps/app/src/` and `packages/design-system/src/components/`, plus `apps/app/src/app/globals.css`.

Pattern searched:
- `ml-`, `mr-`, `pl-`, `pr-` (physical margin/padding)
- `text-left`, `text-right` (physical text alignment)
- `left-`, `right-` (physical positioning)
- `rounded-l`, `rounded-r`, `border-l`, `border-r` (physical border/radius)
- `margin-left`, `margin-right`, `padding-left`, `padding-right`, `left:`, `right:` in CSS

## Issues found and fixes applied

### `apps/app/src/app/[locale]/(authenticated)/account/_sessions.tsx`

| Line | Before | After |
|------|--------|-------|
| 44 | `ml-[var(--spacing-2)]` | `ms-[var(--spacing-2)]` |

The "current device" label badge was indented with margin-left. Replaced with `ms-` (margin-inline-start) so it indents from the text start in both LTR and RTL.

### `apps/app/src/app/[locale]/(authenticated)/account/_notifications.tsx`

| Line | Before | After |
|------|--------|-------|
| 95 | `text-left pr-[var(--spacing-6)]` | `text-start pe-[var(--spacing-6)]` |
| 116 | `pr-[var(--spacing-6)]` | `pe-[var(--spacing-6)]` |

The notification table header and first data column had physical left/right padding. Replaced with `text-start` and `pe-` (padding-inline-end).

### `packages/design-system/src/components/ui/sheet.tsx`

| Line | Before | After |
|------|--------|-------|
| 65 | `absolute right-4 top-4` | `absolute end-4 top-4` |
| 75 | `sm:text-left` | `sm:text-start` |

The Sheet close button was pinned to `right-4`. In RTL the close button should sit at the inline-end of the sheet, which is the left side. Using `end-4` (inset-inline-end) handles this automatically. The SheetHeader text alignment was also physical.

Note: the `left` and `right` side variants in `sheetVariants` (lines 42–44) are intentional semantic names — they describe which physical edge the sheet slides from, which is a caller-specified preference. The `border-r`/`border-l` there are physically correct for those edges and left unchanged.

### `packages/design-system/src/components/ui/dialog.tsx`

| Line | Before | After |
|------|--------|-------|
| 46 | `absolute right-4 top-4` | `absolute end-4 top-4` |
| 56 | `sm:text-left` | `sm:text-start` |

The Dialog close button and header text alignment had the same issue as Sheet. Same fix applied.

Note: `left-[50%] translate-x-[-50%]` on the dialog content (line 40) is a standard horizontal-centering trick and is intentionally left unchanged — it centers the modal regardless of writing direction.

### `apps/app/src/app/globals.css`

```css
html[dir="rtl"] {
  text-align: right;
}
```

This is correct as a base RTL override and was left unchanged.

## What was confirmed clean

- No directional icons (ChevronLeft, ChevronRight, ArrowLeft, ArrowRight) found anywhere — no flip fixes needed.
- `apps/app/src/app/[locale]/(authenticated)/layout.tsx` uses `end-4` (already correct).
- `apps/app/src/app/[locale]/(authenticated)/dashboard/page.tsx` uses `rtl:lg:flex-row-reverse` (already correct).
- All other TSX files had no physical directional Tailwind classes.

## Testing RTL manually

1. Start the app dev server: `pnpm --filter @earthropy/app dev`
2. Navigate to `http://localhost:3000/ar` (Arabic locale).
3. Verify `<html dir="rtl">` is set (check DevTools Elements panel).
4. Check each of these pages:
   - `/ar` — home/landing
   - `/ar/signin` — sign-in form
   - `/ar/signup` — sign-up form
   - `/ar/dashboard` — authenticated dashboard (two-column layout should reverse)
   - `/ar/account` — settings page with sessions list and notifications table
   - Any page with a Dialog or Sheet open (close button should appear on the left in RTL)
5. For each page: confirm no text overflow, no layout breaks, close buttons on the correct side, table text aligned to the right (Arabic reading direction).
