import { getSdgByCode, getSdgById, isSdgCode, isSdgId } from '@repo/sdg';
import type { SdgCode, SdgId } from '@repo/sdg';

export interface SdgChipProps {
  /** SDG id (1–17) or url-safe code from `@repo/sdg`. */
  readonly sdg: SdgId | SdgCode;
  /** `sm` is the default chip used inline; `md` is used in grids and feature surfaces. */
  readonly size?: 'sm' | 'md';
  /** When false, only the SDG number renders. Default true. */
  readonly withName?: boolean;
}

// Mono-font color chip pattern borrowed from Direction B (Civic Atlas):
// a 4px leading vertical edge in the SDG's official color, then the SDG
// number in Plex Mono, then (optionally) the short name in Plex Sans. The
// surface is the neutral `--color-surface` — body text never sits on a
// saturated SDG fill (contrast risk against the 17 hues).
export function SdgChip({ sdg, size = 'sm', withName = true }: SdgChipProps) {
  const data = isSdgId(sdg) ? getSdgById(sdg) : isSdgCode(sdg) ? getSdgByCode(sdg) : null;
  if (!data) throw new Error(`SdgChip: unknown sdg "${String(sdg)}"`);

  const padY = size === 'md' ? 'py-1.5' : 'py-1';
  const padX = size === 'md' ? 'px-2.5' : 'px-2';
  const numberSize = size === 'md' ? 'text-[0.8125rem]' : 'text-[0.75rem]';
  const nameSize = size === 'md' ? 'text-[0.875rem]' : 'text-[0.8125rem]';

  return (
    <span
      className={`inline-flex items-center gap-2 ${padY} ${padX} bg-[var(--color-surface)] border border-[var(--color-border)]`}
      style={{
        borderRadius: 'var(--radius-xs)',
        borderInlineStartWidth: '4px',
        borderInlineStartColor: `var(--sdg-${data.id})`,
      }}
    >
      <span
        aria-hidden="true"
        className={`font-mono ${numberSize} tabular-nums text-[var(--color-text)]`}
      >
        {String(data.id).padStart(2, '0')}
      </span>
      {withName ? (
        <span aria-hidden="true" className={`${nameSize} text-[var(--color-text)]`}>
          {data.shortName}
        </span>
      ) : null}
      <span className="sr-only">{`SDG ${data.id}: ${data.name}`}</span>
    </span>
  );
}
