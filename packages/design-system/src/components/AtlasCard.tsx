import type { SdgId } from '@repo/sdg';
import type { ComponentType, ReactNode } from 'react';
import { SdgChip } from './SdgChip.tsx';

interface LinkComponentProps {
  readonly href: string;
  readonly children?: ReactNode;
  readonly className?: string;
}

export interface AtlasCardGroup {
  readonly name: string;
  readonly description: string;
  readonly primarySdgId: SdgId;
  readonly memberCount: number;
  readonly href: string;
}

export interface AtlasCardProps {
  readonly group: AtlasCardGroup;
  /** Localized "{count} MEMBERS" string. Falls back to English-style "{n} MEMBERS". */
  readonly memberCountLabel?: string;
  /** Optional Link component to inject; defaults to a plain `<a>` tag. */
  readonly Link?: ComponentType<LinkComponentProps>;
}

const FallbackAnchor = ({ href, children, className }: LinkComponentProps) => (
  <a href={href} className={className}>
    {children}
  </a>
);

// Atlas-card layout from Direction B: a 6px top stripe in the primary SDG's
// color, then padded content. Hairline border in `--color-border`; no shadow.
// Hover lifts the card by 1px and darkens the border slightly.
export function AtlasCard({ group, memberCountLabel, Link = FallbackAnchor }: AtlasCardProps) {
  const label = memberCountLabel ?? `${group.memberCount} MEMBERS`;

  return (
    <Link href={group.href} className="atlas-card group/atlas block no-underline">
      <article
        className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden text-[var(--color-text)] transition-transform"
        style={{
          borderRadius: 'var(--radius-sm)',
          transitionDuration: 'var(--duration-base)',
          transitionTimingFunction: 'var(--ease-out)',
        }}
      >
        <div
          aria-hidden="true"
          className="w-full"
          style={{ height: '6px', backgroundColor: `var(--sdg-${group.primarySdgId})` }}
        />
        <div className="p-[var(--spacing-6)]">
          <h3 className="m-0 text-[var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]">
            {group.name}
          </h3>
          <p className="mt-[var(--spacing-2)] mb-0 text-[var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text-muted)]">
            {group.description}
          </p>
          <div className="mt-[var(--spacing-6)] flex items-center justify-between gap-[var(--spacing-3)]">
            <SdgChip sdg={group.primarySdgId} size="sm" withName />
            <span className="font-mono text-[var(--text-micro)] leading-[var(--text-micro--line-height)] tracking-wider text-[var(--color-text-muted)]">
              {label}
            </span>
          </div>
        </div>
      </article>
      <style>{`
        .atlas-card:hover article {
          border-color: var(--color-text);
          transform: translateY(-1px);
        }
        @media (prefers-reduced-motion: reduce) {
          .atlas-card:hover article {
            transform: none;
          }
        }
      `}</style>
    </Link>
  );
}
