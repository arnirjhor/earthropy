import { SDGS } from '@repo/sdg';

// SDG colors are exposed as CSS custom properties so the rest of the app can
// reference them via Tailwind utilities like `bg-[var(--sdg-13)]`. The full
// design system spine is Direction A — Field Record (see
// docs/design-patterns.md, entry "2026-05-18 — Visual identity: Field Record
// synthesis"). Hard values for the visual identity are declared here as
// JS-readable tokens; the canonical surface for CSS consumers is theme.css.
export const sdgCssVars: Record<string, string> = Object.fromEntries(
  SDGS.map((s) => [`--sdg-${s.id}`, s.color]),
);

export function sdgCssVarsAsString(): string {
  return Object.entries(sdgCssVars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
}

// Neutrals — warm-paper Field Record palette.
// Light: AAA contrast for body text (`#0F0F0F` on `#F7F6F2` ≈ 17:1) and muted
// (`#4A4A4A` on `#F7F6F2` ≈ 8.6:1). Dark: text on background ≈ 16:1 AAA.
export const colors = {
  light: {
    paper: '#F7F6F2',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E1DFD9',
    text: '#0F0F0F',
    textMuted: '#4A4A4A',
  },
  dark: {
    paper: '#0E0F11',
    surface: '#16181B',
    surfaceElevated: '#1B1E23',
    border: 'rgba(255, 255, 255, 0.14)',
    text: '#F2F1ED',
    textMuted: '#A6A39C',
  },
} as const;

// Type scale — px values; line-heights expressed as unitless ratios.
export const typeScale = {
  display: { size: 56, lineHeight: 1.05 },
  h1: { size: 40, lineHeight: 1.15 },
  h2: { size: 30, lineHeight: 1.2 },
  h3: { size: 22, lineHeight: 1.3 },
  h4: { size: 17, lineHeight: 1.4 },
  body: { size: 16, lineHeight: 1.5 },
  bodySm: { size: 14, lineHeight: 1.5 },
  mono: { size: 13, lineHeight: 1.55 },
  micro: { size: 12, lineHeight: 1.45 },
} as const;

// Spacing scale, in pixels.
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
} as const;

// Radii — kept small. Field Record favours hairline borders over softness.
export const radii = {
  xs: 2,
  sm: 4,
  md: 8,
} as const;

// Motion — spare, 120/180ms is the budget. `prefers-reduced-motion` drops to 0.
export const motion = {
  duration: {
    fast: '120ms',
    base: '180ms',
    slow: '240ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;
