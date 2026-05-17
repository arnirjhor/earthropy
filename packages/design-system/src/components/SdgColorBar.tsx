import { SDGS } from '@repo/sdg';
import type { ComponentType, ReactNode } from 'react';

interface LinkComponentProps {
  readonly href: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly 'aria-label'?: string;
}

export interface SdgColorBarProps {
  /**
   * Optional Link component to inject — typically Next.js's `next/link`. The
   * design-system package is framework-agnostic and cannot depend on Next
   * directly; consumers wire `Link` in from their app. Falls back to an `<a>`.
   */
  readonly Link?: ComponentType<LinkComponentProps>;
}

const FallbackAnchor = ({ href, children, className, ...rest }: LinkComponentProps) => (
  <a href={href} className={className} aria-label={rest['aria-label']}>
    {children}
  </a>
);

// Slim 4px persistent 17-cell SDG navigator, borrowed from Direction C (Press
// Sheet). Each cell links to /sdg/<code>. On hover the cell grows to 8px tall
// (CSS transition, 120ms). Under `dir="rtl"` the cells reverse via flex
// row-reverse so SDG 1 sits on the right — Arabic readers expect "first"
// there. The colors are the canonical UN palette, sourced from
// packages/sdg/src/sdgs.ts via the SDGS export.
export function SdgColorBar({ Link = FallbackAnchor }: SdgColorBarProps = {}) {
  return (
    <nav aria-label="SDG navigator" className="sdg-color-bar group/sdg-bar relative w-full">
      <ul className="sdg-color-bar__list flex w-full m-0 p-0 list-none">
        {SDGS.map((sdg) => (
          <li
            key={sdg.id}
            className="sdg-color-bar__cell flex-1 m-0 p-0 leading-none"
            style={{ backgroundColor: `var(--sdg-${sdg.id})` }}
          >
            <Link
              href={`/sdg/${sdg.code}`}
              aria-label={`Sustainable Development Goal ${sdg.id}: ${sdg.name}`}
              className="block h-full w-full"
            >
              <span aria-hidden="true" className="block h-full w-full" />
            </Link>
          </li>
        ))}
      </ul>
      <style>{`
        .sdg-color-bar__list {
          height: 4px;
          transition: height var(--duration-fast, 120ms) var(--ease-out, ease-out);
        }
        .sdg-color-bar:hover .sdg-color-bar__list,
        .sdg-color-bar:focus-within .sdg-color-bar__list {
          height: 8px;
        }
        html[dir='rtl'] .sdg-color-bar__list {
          flex-direction: row-reverse;
        }
      `}</style>
    </nav>
  );
}
