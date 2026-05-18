import { AtlasCard } from '@repo/design-system';
import { listGroups } from '@repo/groups';
import type { SdgId } from '@repo/sdg';
import { isSdgId } from '@repo/sdg';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { SdgFilter } from './_sdg-filter.tsx';
import { VisibilityFilter } from './_visibility-filter.tsx';

const PAGE_SIZE = 24;

type Visibility = 'public' | 'listed' | 'both';

function parseSearchParams(raw: Record<string, string | string[] | undefined>) {
  // sdgIds: comma-separated list of SDG ids, each 1-17
  const sdgsRaw = typeof raw.sdgs === 'string' ? raw.sdgs : '';
  const sdgIds: SdgId[] = sdgsRaw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => isSdgId(n)) as SdgId[];

  // visibility: 'public' | 'listed' | 'both' — default 'public'
  const visibilityRaw = typeof raw.visibility === 'string' ? raw.visibility : '';
  const visibility: Visibility =
    visibilityRaw === 'listed' || visibilityRaw === 'both'
      ? (visibilityRaw as Visibility)
      : 'public';

  // page: 1-based, default 1
  const pageRaw = typeof raw.page === 'string' ? raw.page : '1';
  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  return { sdgIds, visibility, page, offset };
}

function buildUrl(
  locale: string,
  overrides: Partial<{ sdgs: string; visibility: string; page: number }>,
  current: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();

  const sdgs =
    'sdgs' in overrides ? overrides.sdgs : typeof current.sdgs === 'string' ? current.sdgs : '';
  if (sdgs) params.set('sdgs', sdgs);

  const vis =
    'visibility' in overrides
      ? overrides.visibility
      : typeof current.visibility === 'string'
        ? current.visibility
        : '';
  if (vis && vis !== 'public') params.set('visibility', vis);

  const pg = 'page' in overrides ? overrides.page : undefined;
  if (pg && pg > 1) params.set('page', String(pg));

  const qs = params.toString();
  return qs ? `/${locale}/g?${qs}` : `/${locale}/g`;
}

export default async function GroupBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations('GroupBrowse');

  const { sdgIds, visibility, page, offset } = parseSearchParams(sp);

  // Build query — if visibility='both', omit the filter (returns public+listed+private;
  // v0.1 approach: 'both' means no visibility filter on the query).
  const visibilityParam: 'public' | 'listed' | undefined =
    visibility === 'both' ? undefined : visibility;

  const { rows, total } = await listGroups({
    sdgIds: sdgIds.length > 0 ? sdgIds : undefined,
    visibility: visibilityParam,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const hasActiveFilter = sdgIds.length > 0;

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1200px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
    >
      {/* Page header */}
      <header className="flex flex-col gap-[var(--spacing-2)] md:flex-row md:items-baseline md:justify-between mb-[var(--spacing-8)]">
        <div className="flex flex-col gap-[var(--spacing-1)]">
          <span className="font-mono text-[var(--text-micro)] leading-[var(--text-micro--line-height)] uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('caption')}
          </span>
          <h1 className="m-0 text-[var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
            {t('heading')}
          </h1>
        </div>
        <Link
          href={`/${locale}/g/new`}
          className="self-start font-mono text-[var(--text-micro)] uppercase tracking-wider border border-[var(--color-border)] px-[var(--spacing-4)] py-[var(--spacing-2)] no-underline text-[var(--color-text)] hover:border-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
        >
          + {t('empty.createGroup')}
        </Link>
      </header>

      {/* Filters row */}
      <section
        aria-label="Filters"
        className="flex flex-col gap-[var(--spacing-4)] mb-[var(--spacing-8)]"
      >
        <div className="flex flex-wrap items-center gap-[var(--spacing-4)]">
          <span className="font-mono text-[var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">
            {t('visibilityLabel')}
          </span>
          <VisibilityFilter
            activeVisibility={visibility}
            label={t('visibilityLabel')}
            publicLabel={t('visibilityPublic')}
            listedLabel={t('visibilityListed')}
            bothLabel={t('visibilityBoth')}
            noscriptBaseHref={`/${locale}/g`}
          />
        </div>

        <div className="flex flex-wrap items-start gap-[var(--spacing-4)]">
          <span className="font-mono text-[var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] shrink-0 pt-[7px]">
            {t('filterLabel')}
          </span>
          <SdgFilter
            activeSdgIds={sdgIds}
            filterLabel={t('filterLabel')}
            noscriptBaseHref={`/${locale}/g`}
          />
        </div>
      </section>

      <hr className="border-0 border-t border-[var(--color-border)] mb-[var(--spacing-8)]" />

      {/* Group grid or empty state */}
      {rows.length === 0 ? (
        <section
          data-testid="group-browse-empty"
          className="flex flex-col items-center gap-[var(--spacing-4)] py-[var(--spacing-16)] text-center"
          aria-label={t('empty.heading')}
        >
          <h2 className="m-0 text-[var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]">
            {t('empty.heading')}
          </h2>
          <p className="m-0 max-w-[40ch] text-[var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]">
            {hasActiveFilter ? t('empty.descriptionFiltered') : t('empty.descriptionAll')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-[var(--spacing-3)] mt-[var(--spacing-2)]">
            {hasActiveFilter && (
              <Link
                href={`/${locale}/g`}
                className="font-mono text-[var(--text-micro)] uppercase tracking-wider border border-[var(--color-border)] px-[var(--spacing-4)] py-[var(--spacing-2)] no-underline text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
              >
                {t('empty.clearFilter')}
              </Link>
            )}
            <Link
              href={`/${locale}/g/new`}
              className="font-mono text-[var(--text-micro)] uppercase tracking-wider border border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-surface)] px-[var(--spacing-4)] py-[var(--spacing-2)] no-underline hover:opacity-80 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
            >
              + {t('empty.createGroup')}
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section aria-label={t('heading')}>
            <ul className="grid grid-cols-1 gap-[var(--spacing-4)] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 m-0 p-0 list-none">
              {rows.map((group) => (
                <li key={group.id} className="m-0 p-0">
                  <AtlasCard
                    group={{
                      name: group.name,
                      description: group.description,
                      primarySdgId: group.primarySdgId,
                      memberCount: group.memberCount,
                      href: `/${locale}/g/${group.slug}`,
                    }}
                    Link={Link}
                  />
                </li>
              ))}
            </ul>
          </section>

          {/* Pagination */}
          {(hasPrev || hasNext) && (
            <nav
              aria-label={t('pagination.pageOf', { page, total: totalPages })}
              className="mt-[var(--spacing-12)] flex items-center justify-between gap-[var(--spacing-4)]"
            >
              {hasPrev ? (
                <Link
                  data-testid="pagination-prev"
                  href={buildUrl(locale, { page: page - 1 }, sp)}
                  className="font-mono text-[var(--text-micro)] uppercase tracking-wider border border-[var(--color-border)] px-[var(--spacing-4)] py-[var(--spacing-2)] no-underline text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
                  rel="prev"
                >
                  ← {t('pagination.prev')}
                </Link>
              ) : (
                <span />
              )}

              <span className="font-mono text-[var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                {t('pagination.pageOf', { page, total: totalPages })}
              </span>

              {hasNext ? (
                <Link
                  data-testid="pagination-next"
                  href={buildUrl(locale, { page: page + 1 }, sp)}
                  className="font-mono text-[var(--text-micro)] uppercase tracking-wider border border-[var(--color-border)] px-[var(--spacing-4)] py-[var(--spacing-2)] no-underline text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
                  rel="next"
                >
                  {t('pagination.next')} →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}

          {/* Pagination — no-JS prev/next when there are no rows but we're on page > 1 */}
        </>
      )}

      {/* Show prev even when empty, if on page > 1 (user navigated forward to empty page) */}
      {rows.length === 0 && hasPrev && (
        <div className="mt-[var(--spacing-8)] flex justify-center">
          <Link
            data-testid="pagination-prev"
            href={buildUrl(locale, { page: page - 1 }, sp)}
            className="font-mono text-[var(--text-micro)] uppercase tracking-wider border border-[var(--color-border)] px-[var(--spacing-4)] py-[var(--spacing-2)] no-underline text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
            rel="prev"
          >
            ← {t('pagination.prev')}
          </Link>
        </div>
      )}
    </main>
  );
}
