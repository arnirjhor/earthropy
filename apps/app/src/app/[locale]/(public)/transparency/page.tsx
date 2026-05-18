/**
 * /transparency — Public moderation accountability surface.
 *
 * Promised in docs/moderation-policy.md §Transparency promise.
 * Shows aggregate stats for the last 30 days: decisions by verdict,
 * top categories per verdict, appeal volume + median resolution time,
 * and counts per AI provider.
 *
 * Server-rendered, no client JS required, no chart library.
 */
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getTransparencyStats } from './_queries.ts';
import type { CategoryRow, Verdict, VerdictCount } from './_queries.ts';

// ── Verdict metadata ───────────────────────────────────────────────────────────

const VERDICT_LABELS: Record<Verdict, string> = {
  auto_publish: 'Auto-publish',
  hold_for_review: 'Hold for review',
  auto_reject: 'Auto-reject',
  human_publish: 'Human publish',
  human_reject: 'Human reject',
};

// Accessible color token pairs: [bar bg, text label] — all AAA-contrast on surface
const VERDICT_COLORS: Record<Verdict, string> = {
  auto_publish: 'var(--color-success, #166534)',
  hold_for_review: 'var(--color-warning, #854d0e)',
  auto_reject: 'var(--color-danger, #991b1b)',
  human_publish: 'var(--color-info, #1e40af)',
  human_reject: 'var(--color-text-muted)',
};

const VERDICT_ORDER: Verdict[] = [
  'auto_publish',
  'hold_for_review',
  'auto_reject',
  'human_publish',
  'human_reject',
];

// ── Helper components ──────────────────────────────────────────────────────────

/**
 * A small horizontal bar visualization (no JS, no chart lib).
 * Width is proportional to count / max.
 */
function CountBar({ count, max, color }: { count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="h-[8px] rounded-[2px]"
      style={{
        width: `${pct}%`,
        minWidth: pct > 0 ? '4px' : '0',
        backgroundColor: color,
        transition: 'width 0s',
      }}
    />
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 mb-[var(--spacing-4)] text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]">
      {children}
    </h2>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular-nums text-[var(--color-text)]">{children}</span>;
}

// ── Section: verdict counts ────────────────────────────────────────────────────

function VerdictCountsSection({ verdictCounts }: { verdictCounts: VerdictCount[] }) {
  const countMap = new Map(verdictCounts.map((r) => [r.verdict, r.count]));
  const maxCount = Math.max(...verdictCounts.map((r) => r.count), 1);

  return (
    <section
      data-testid="section-last-30-days"
      aria-labelledby="heading-last-30-days"
      className="mb-[var(--spacing-10)]"
    >
      <SectionHeading>
        <span id="heading-last-30-days">Last 30 days</span>
      </SectionHeading>

      <table
        data-testid="verdict-counts-table"
        className="w-full border-collapse"
        aria-label="Moderation decisions by verdict, last 30 days"
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="text-start font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] border-b border-[var(--color-border)]"
            >
              Verdict
            </th>
            <th
              scope="col"
              className="text-end font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] border-b border-[var(--color-border)] w-[80px]"
            >
              Count
            </th>
          </tr>
        </thead>
        <tbody>
          {VERDICT_ORDER.map((verdict) => {
            const cnt = countMap.get(verdict) ?? 0;
            const color = VERDICT_COLORS[verdict];
            return (
              <tr key={verdict}>
                <td className="py-[var(--spacing-3)] pe-[var(--spacing-6)]">
                  <div className="flex flex-col gap-[var(--spacing-1)]">
                    <span className="text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text)]">
                      {VERDICT_LABELS[verdict]}
                    </span>
                    <CountBar count={cnt} max={maxCount} color={color} />
                  </div>
                </td>
                <td
                  data-testid={`verdict-count-${verdict}`}
                  className="py-[var(--spacing-3)] text-end"
                >
                  <Mono>{cnt.toLocaleString()}</Mono>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ── Section: categories ────────────────────────────────────────────────────────

function CategorySection({ rows }: { rows: CategoryRow[] }) {
  // Group by verdict
  const byVerdict = new Map<Verdict, CategoryRow[]>();
  for (const row of rows) {
    const existing = byVerdict.get(row.verdict) ?? [];
    existing.push(row);
    byVerdict.set(row.verdict, existing);
  }

  const verdicts = VERDICT_ORDER.filter((v) => byVerdict.has(v));

  return (
    <section
      data-testid="section-by-category"
      aria-labelledby="heading-by-category"
      className="mb-[var(--spacing-10)]"
    >
      <SectionHeading>
        <span id="heading-by-category">By category</span>
      </SectionHeading>

      {verdicts.length === 0 ? (
        <p className="m-0 text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          No category data available.
        </p>
      ) : (
        <div className="flex flex-col gap-[var(--spacing-6)]">
          {verdicts.map((verdict) => {
            const categoryRows = byVerdict.get(verdict) ?? [];
            const maxCnt = Math.max(...categoryRows.map((r) => r.count), 1);
            const color = VERDICT_COLORS[verdict];
            return (
              <div key={verdict}>
                <p className="m-0 mb-[var(--spacing-2)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                  {VERDICT_LABELS[verdict]}
                </p>
                <ul className="list-none p-0 m-0 flex flex-col gap-[var(--spacing-2)]">
                  {categoryRows.map((row) => (
                    <li key={row.category} className="flex items-center gap-[var(--spacing-4)]">
                      <span className="w-[140px] shrink-0 text-[length:var(--text-body-sm)] text-[var(--color-text)]">
                        {row.category}
                      </span>
                      <div className="flex-1 flex items-center gap-[var(--spacing-3)]">
                        <div className="flex-1 bg-[var(--color-border)] h-[8px] rounded-[2px] overflow-hidden">
                          <div
                            role="presentation"
                            aria-hidden="true"
                            className="h-full rounded-[2px]"
                            style={{
                              width: `${Math.round((row.count / maxCnt) * 100)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <Mono>{row.count.toLocaleString()}</Mono>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Section: appeals ───────────────────────────────────────────────────────────

function AppealsSection({
  pending,
  resolved,
  medianDaysToResolution,
}: {
  pending: number;
  resolved: number;
  medianDaysToResolution: number | null;
}) {
  return (
    <section
      data-testid="section-appeals"
      aria-labelledby="heading-appeals"
      className="mb-[var(--spacing-10)]"
    >
      <SectionHeading>
        <span id="heading-appeals">Appeals</span>
      </SectionHeading>

      <dl className="grid grid-cols-1 gap-[var(--spacing-4)] sm:grid-cols-3">
        <div className="flex flex-col gap-[var(--spacing-1)] p-[var(--spacing-4)] border border-[var(--color-border)]">
          <dt className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
            Pending
          </dt>
          <dd
            data-testid="appeals-pending"
            className="m-0 font-mono text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] tabular-nums text-[var(--color-text)]"
          >
            {pending.toLocaleString()}
          </dd>
        </div>

        <div className="flex flex-col gap-[var(--spacing-1)] p-[var(--spacing-4)] border border-[var(--color-border)]">
          <dt className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
            Resolved
          </dt>
          <dd
            data-testid="appeals-resolved"
            className="m-0 font-mono text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] tabular-nums text-[var(--color-text)]"
          >
            {resolved.toLocaleString()}
          </dd>
        </div>

        <div className="flex flex-col gap-[var(--spacing-1)] p-[var(--spacing-4)] border border-[var(--color-border)]">
          <dt className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
            Median days to resolution
          </dt>
          <dd
            data-testid="appeals-median"
            className="m-0 font-mono text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] tabular-nums text-[var(--color-text)]"
          >
            {medianDaysToResolution !== null ? medianDaysToResolution.toFixed(1) : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ── Section: providers ─────────────────────────────────────────────────────────

function ProvidersSection({ providers }: { providers: { provider: string; count: number }[] }) {
  const maxCount = Math.max(...providers.map((p) => p.count), 1);

  return (
    <section
      data-testid="section-providers"
      aria-labelledby="heading-providers"
      className="mb-[var(--spacing-10)]"
    >
      <SectionHeading>
        <span id="heading-providers">Providers</span>
      </SectionHeading>

      <table className="w-full border-collapse" aria-label="Moderation decisions by provider">
        <thead>
          <tr>
            <th
              scope="col"
              className="text-start font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] border-b border-[var(--color-border)]"
            >
              Provider
            </th>
            <th
              scope="col"
              className="text-end font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] border-b border-[var(--color-border)] w-[80px]"
            >
              Count
            </th>
          </tr>
        </thead>
        <tbody>
          {providers.map(({ provider, count }) => (
            <tr key={provider}>
              <td className="py-[var(--spacing-3)] pe-[var(--spacing-6)]">
                <div className="flex flex-col gap-[var(--spacing-1)]">
                  <span className="text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text)]">
                    {provider}
                  </span>
                  <CountBar count={count} max={maxCount} color="var(--color-text-muted)" />
                </div>
              </td>
              <td
                data-testid={`provider-count-${provider}`}
                className="py-[var(--spacing-3)] text-end"
              >
                <Mono>{count.toLocaleString()}</Mono>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function TransparencyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const stats = await getTransparencyStats();

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[960px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
      dir="auto"
    >
      {/* Page header */}
      <header className="mb-[var(--spacing-8)]">
        <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
          Moderation
        </span>
        <h1 className="m-0 mt-[var(--spacing-1)] text-[length:var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
          Transparency
        </h1>
        <p className="m-0 mt-[var(--spacing-3)] text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text-muted)]">
          Aggregate moderation stats for the last {stats.windowDays} days.{' '}
          <Link
            href="/docs/moderation-policy.md"
            className="text-[var(--color-text)] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
          >
            Read our moderation policy
          </Link>
          .
        </p>
      </header>

      <hr className="border-0 border-t border-[var(--color-border)] mb-[var(--spacing-10)]" />

      {/* Empty state */}
      {!stats.hasDecisions ? (
        <div data-testid="transparency-empty" className="py-[var(--spacing-16)] text-center">
          <p className="m-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]">
            No decisions in the last 30 days.
          </p>
        </div>
      ) : (
        <>
          <VerdictCountsSection verdictCounts={stats.verdictCounts} />
          <hr className="border-0 border-t border-[var(--color-border)] mb-[var(--spacing-10)]" />
          <CategorySection rows={stats.topCategoriesByVerdict} />
          <hr className="border-0 border-t border-[var(--color-border)] mb-[var(--spacing-10)]" />
          <AppealsSection
            pending={stats.appeals.pending}
            resolved={stats.appeals.resolved}
            medianDaysToResolution={stats.appeals.medianDaysToResolution}
          />
          <hr className="border-0 border-t border-[var(--color-border)] mb-[var(--spacing-10)]" />
          <ProvidersSection providers={stats.providers} />
        </>
      )}
    </main>
  );
}
