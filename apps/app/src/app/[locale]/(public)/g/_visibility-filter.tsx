'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface VisibilityFilterProps {
  readonly activeVisibility: 'public' | 'listed' | 'both';
  readonly label: string;
  readonly publicLabel: string;
  readonly listedLabel: string;
  readonly bothLabel: string;
  readonly noscriptBaseHref: string;
}

export function VisibilityFilter({
  activeVisibility,
  label,
  publicLabel,
  listedLabel,
  bothLabel,
  noscriptBaseHref,
}: VisibilityFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = useCallback(
    (value: 'public' | 'listed' | 'both') => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));

      if (value === 'public') {
        current.delete('visibility');
      } else {
        current.set('visibility', value);
      }

      current.delete('page');

      const qs = current.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const options: Array<{ value: 'public' | 'listed' | 'both'; label: string }> = [
    { value: 'public', label: publicLabel },
    { value: 'listed', label: listedLabel },
    { value: 'both', label: bothLabel },
  ];

  return (
    <>
      <fieldset className="border-0 m-0 p-0 flex gap-[var(--spacing-1)]">
        <legend className="sr-only">{label}</legend>
        {options.map((opt) => {
          const isActive = opt.value === activeVisibility;
          return (
            <button
              key={opt.value}
              type="button"
              data-visibility-filter={opt.value}
              aria-pressed={isActive}
              onClick={() => select(opt.value)}
              className={[
                'font-mono text-[var(--text-micro)] uppercase tracking-wider px-[var(--spacing-3)] py-[var(--spacing-1)]',
                'border transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2',
                isActive
                  ? 'bg-[var(--color-text)] text-[var(--color-surface)] border-[var(--color-text)]'
                  : 'bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-text)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </fieldset>

      <noscript>
        <div className="flex gap-[var(--spacing-1)]">
          {options.map((opt) => {
            const isActive = opt.value === activeVisibility;
            const href =
              opt.value === 'public'
                ? noscriptBaseHref
                : `${noscriptBaseHref}?visibility=${opt.value}`;
            return (
              <a
                key={opt.value}
                href={href}
                aria-current={isActive ? 'true' : undefined}
                className={[
                  'font-mono text-[var(--text-micro)] uppercase tracking-wider px-[var(--spacing-3)] py-[var(--spacing-1)] no-underline',
                  'border',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2',
                  isActive
                    ? 'bg-[var(--color-text)] text-[var(--color-surface)] border-[var(--color-text)]'
                    : 'bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)]',
                ].join(' ')}
              >
                {opt.label}
              </a>
            );
          })}
        </div>
      </noscript>
    </>
  );
}
