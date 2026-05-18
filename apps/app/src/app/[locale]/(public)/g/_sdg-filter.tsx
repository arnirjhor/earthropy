'use client';

import { SdgChip } from '@repo/design-system';
import type { SdgId } from '@repo/sdg';
import { SDGS } from '@repo/sdg';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface SdgFilterProps {
  readonly activeSdgIds: SdgId[];
  readonly filterLabel: string;
  readonly noscriptBaseHref: string;
}

export function SdgFilter({ activeSdgIds, filterLabel, noscriptBaseHref }: SdgFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggle = useCallback(
    (sdgId: SdgId) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));

      const activeSet = new Set(activeSdgIds);
      if (activeSet.has(sdgId)) {
        activeSet.delete(sdgId);
      } else {
        activeSet.add(sdgId);
      }

      if (activeSet.size === 0) {
        current.delete('sdgs');
      } else {
        current.set(
          'sdgs',
          Array.from(activeSet)
            .sort((a, b) => a - b)
            .join(','),
        );
      }

      // Reset to page 1 when filter changes
      current.delete('page');

      const qs = current.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [activeSdgIds, pathname, router, searchParams],
  );

  const activeSet = new Set(activeSdgIds);

  return (
    <>
      <fieldset className="border-0 m-0 p-0 flex flex-wrap gap-[var(--spacing-2)]">
        <legend className="sr-only">{filterLabel}</legend>
        {SDGS.map((sdg) => {
          const isActive = activeSet.has(sdg.id as SdgId);
          return (
            <button
              key={sdg.id}
              type="button"
              data-sdg-filter={sdg.id}
              aria-pressed={isActive}
              onClick={() => toggle(sdg.id as SdgId)}
              className={[
                'block cursor-pointer border-0 bg-transparent p-0 text-start',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2',
                isActive ? 'opacity-100' : 'opacity-60 hover:opacity-90 transition-opacity',
              ].join(' ')}
            >
              <SdgChip sdg={sdg.id as SdgId} size="sm" withName />
            </button>
          );
        })}
      </fieldset>

      <noscript>
        <div className="flex flex-wrap gap-[var(--spacing-2)]">
          {SDGS.map((sdg) => {
            const isActive = activeSet.has(sdg.id as SdgId);
            const nextSet = new Set(activeSdgIds);
            if (isActive) {
              nextSet.delete(sdg.id as SdgId);
            } else {
              nextSet.add(sdg.id as SdgId);
            }
            const sdgsParam =
              nextSet.size > 0
                ? Array.from(nextSet)
                    .sort((a, b) => a - b)
                    .join(',')
                : '';
            const href = sdgsParam ? `${noscriptBaseHref}?sdgs=${sdgsParam}` : noscriptBaseHref;
            return (
              <a
                key={sdg.id}
                href={href}
                aria-label={`Filter by SDG ${sdg.id}${isActive ? ' (active)' : ''}`}
                className={[
                  'block no-underline',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2',
                  isActive ? 'opacity-100' : 'opacity-60',
                ].join(' ')}
              >
                <SdgChip sdg={sdg.id as SdgId} size="sm" withName />
              </a>
            );
          })}
        </div>
      </noscript>
    </>
  );
}
