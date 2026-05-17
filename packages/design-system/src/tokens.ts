import { SDGS } from '@repo/sdg';

// SDG colors are exposed as CSS custom properties so the rest of the app can
// reference them via Tailwind utilities like `bg-[var(--sdg-13)]`. The full
// design system (typography pair, color scales, motion treatment) is decided
// in a Plan-mode design pass — see docs/design-patterns.md.
export const sdgCssVars: Record<string, string> = Object.fromEntries(
  SDGS.map((s) => [`--sdg-${s.id}`, s.color]),
);

export function sdgCssVarsAsString(): string {
  return Object.entries(sdgCssVars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
}
