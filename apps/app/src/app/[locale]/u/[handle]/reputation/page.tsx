/**
 * /u/[handle]/reputation — public reputation history page.
 *
 * Lists all reputation_events for the given user, paginated.
 * No session required — anyone can view anyone's reputation history.
 */

import { db } from '@repo/database/client';
import { reputationEvents, users } from '@repo/database/schema';
import { tierOf } from '@repo/trust';
import { count, desc, eq, sql } from 'drizzle-orm';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// ── Helpers ────────────────────────────────────────────────────────────────────

type ReputationEventRow = {
  id: string;
  kind: string;
  delta: number;
  reason: string | null;
  sourceId: string | null;
  createdAt: Date;
};

async function getUserByHandle(handle: string) {
  const rows = await db
    .select({
      id: users.id,
      handle: users.handle,
      displayName: users.displayName,
      reputation: users.reputation,
    })
    .from(users)
    .where(eq(sql`lower(${users.handle})`, handle.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

async function getReputationEvents(
  userId: string,
  offset: number,
  limit: number,
): Promise<{ rows: ReputationEventRow[]; total: number }> {
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: reputationEvents.id,
        kind: reputationEvents.kind,
        delta: reputationEvents.delta,
        reason: reputationEvents.reason,
        sourceId: reputationEvents.sourceId,
        createdAt: reputationEvents.createdAt,
      })
      .from(reputationEvents)
      .where(eq(reputationEvents.userId, userId))
      .orderBy(desc(reputationEvents.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count(reputationEvents.id) })
      .from(reputationEvents)
      .where(eq(reputationEvents.userId, userId)),
  ]);

  return {
    rows: rows as ReputationEventRow[],
    total: countRows[0]?.total ?? 0,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'post_accepted':
      return 'Post accepted';
    case 'post_rejected':
      return 'Post rejected';
    case 'comment_accepted':
      return 'Comment accepted';
    case 'comment_rejected':
      return 'Comment rejected';
    case 'helpful_reaction':
      return 'Helpful reaction';
    case 'moderator_grant':
      return 'Moderator grant';
    case 'appeal_resolved_for_user':
      return 'Appeal resolved';
    case 'admin_adjust':
      return 'Admin adjustment';
    default:
      return kind;
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ReputationHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, handle } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const pageRaw = typeof sp.page === 'string' ? sp.page : '1';
  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const user = await getUserByHandle(handle);
  if (!user) notFound();

  const { rows, total } = await getReputationEvents(user.id, offset, PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const tier = tierOf(user.reputation);

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[720px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
      dir="auto"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mb-[var(--spacing-10)]">
        <Link
          href={`/${locale}/dashboard`}
          className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
        >
          Earthropy
        </Link>

        <div className="mt-[var(--spacing-4)] flex flex-col gap-[var(--spacing-2)] md:flex-row md:items-baseline md:justify-between">
          <div>
            <h1 className="m-0 text-[length:var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
              {user.displayName}
            </h1>
            <p className="m-0 mt-[var(--spacing-1)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
              @{user.handle}
            </p>
          </div>

          {/* Tier badge — Plex Mono small-caps, neutral */}
          <div data-testid="tier-badge" className="self-start md:self-auto">
            <span
              className="inline-block font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] border border-[var(--color-border)] px-[var(--spacing-3)] py-[var(--spacing-1)]"
              style={{ fontVariant: 'small-caps' }}
              aria-label={`Reputation tier: ${tier}`}
            >
              {tier}
            </span>
          </div>
        </div>

        {/* Reputation count */}
        <p className="mt-[var(--spacing-4)] font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)]">
          <span
            className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]"
            data-testid="reputation-count"
          >
            {user.reputation}
          </span>{' '}
          reputation points
        </p>

        <h2 className="mt-[var(--spacing-8)] m-0 font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
          Reputation history
        </h2>
      </header>

      <hr className="mb-[var(--spacing-8)] border-0 border-t border-[var(--color-border)]" />

      {/* ── Event list ─────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <p
          data-testid="reputation-empty"
          className="text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]"
        >
          No reputation events yet.
        </p>
      ) : (
        <ol
          data-testid="reputation-list"
          className="list-none p-0 m-0 flex flex-col gap-0"
          aria-label="Reputation event history"
        >
          {rows.map((event) => {
            const isPositive = event.delta > 0;
            const deltaStr = isPositive ? `+${event.delta}` : String(event.delta);
            return (
              <li
                key={event.id}
                className="flex items-start justify-between gap-[var(--spacing-4)] py-[var(--spacing-4)] border-b border-[var(--color-border)]"
              >
                <div className="flex flex-col gap-[var(--spacing-1)] min-w-0">
                  <span className="text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text)]">
                    {kindLabel(event.kind)}
                  </span>
                  {event.reason && (
                    <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] truncate">
                      {event.reason}
                    </span>
                  )}
                  <time
                    dateTime={event.createdAt.toISOString()}
                    className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
                  >
                    {formatDate(event.createdAt)}
                  </time>
                </div>

                <div className="shrink-0 flex items-center gap-[var(--spacing-3)]">
                  {event.sourceId && (
                    <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                      {event.sourceId.slice(0, 8)}
                    </span>
                  )}
                  <span
                    className="font-mono text-[length:var(--text-mono)] font-medium tabular-nums"
                    style={{
                      color: isPositive ? 'var(--color-text)' : 'var(--color-text-muted)',
                    }}
                    aria-label={`${deltaStr} reputation`}
                  >
                    {deltaStr}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {(hasPrev || hasNext) && (
        <nav
          aria-label={`Page ${page} of ${totalPages}`}
          className="mt-[var(--spacing-12)] flex items-center justify-between gap-[var(--spacing-4)]"
        >
          {hasPrev ? (
            <Link
              data-testid="pagination-prev"
              href={`/${locale}/u/${handle}/reputation?page=${page - 1}`}
              rel="prev"
              className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider border border-[var(--color-border)] px-[var(--spacing-4)] py-[var(--spacing-2)] no-underline text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
            >
              ← Prev
            </Link>
          ) : (
            <span />
          )}

          <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
            {page} / {totalPages}
          </span>

          {hasNext ? (
            <Link
              data-testid="pagination-next"
              href={`/${locale}/u/${handle}/reputation?page=${page + 1}`}
              rel="next"
              className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider border border-[var(--color-border)] px-[var(--spacing-4)] py-[var(--spacing-2)] no-underline text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
