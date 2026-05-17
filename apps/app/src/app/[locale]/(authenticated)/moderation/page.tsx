/**
 * /moderation — Moderator queue.
 *
 * Shows posts + comments with status='pending_review' for groups where the
 * viewer has moderation authority. Platform anchors (reputation ≥ 2000) see
 * all pending items.
 *
 * Each row: type, group, author handle, 200-char preview, latest AI decision
 * reasoning + scores, age, Publish / Reject buttons.
 *
 * Pagination: 50 rows per page via ?page=N.
 */
import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import {
  comments,
  groupMembers,
  groups,
  moderationDecisions,
  posts,
  users,
} from '@repo/database/schema';
import type { ModerationScores } from '@repo/database/schema';
import { can } from '@repo/trust';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { moderatorPublishAction, moderatorRejectAction } from './_actions.ts';

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const PLATFORM_ANCHOR_REP = 2000;

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueueItem {
  kind: 'post' | 'comment';
  id: string;
  groupId: string;
  groupName: string;
  authorHandle: string;
  preview: string;
  createdAt: Date;
  latestDecision: {
    reasoning: string | null;
    scores: ModerationScores;
  } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getViewer() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function getModeratableGroupIds(
  userId: string,
  reputation: number,
): Promise<string[] | 'all'> {
  // Platform anchors can see everything.
  if (reputation >= PLATFORM_ANCHOR_REP) return 'all';

  // Otherwise: groups where user is owner or moderator.
  const rows = await db
    .select({ groupId: groupMembers.groupId, role: groupMembers.role })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const modGroupIds = rows
    .filter((r) =>
      can('group.moderate', reputation, {
        groupRole: r.role as 'owner' | 'moderator' | 'member',
      }),
    )
    .map((r) => r.groupId);

  return modGroupIds;
}

async function fetchQueueItems(
  groupIds: string[] | 'all',
  page: number,
): Promise<{ items: QueueItem[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE;

  // ── Fetch pending posts ───────────────────────────────────────────────────

  const postQuery = db
    .select({
      id: posts.id,
      groupId: posts.groupId,
      groupName: groups.name,
      authorHandle: users.handle,
      body: posts.body,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(groups, eq(groups.id, posts.groupId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      groupIds === 'all'
        ? eq(posts.status, 'pending_review')
        : and(
            eq(posts.status, 'pending_review'),
            inArray(posts.groupId, groupIds.length > 0 ? groupIds : ['__none__']),
          ),
    )
    .orderBy(desc(posts.createdAt));

  const pendingPosts = await postQuery;

  // ── Fetch pending comments ────────────────────────────────────────────────

  const commentQuery = db
    .select({
      id: comments.id,
      postId: comments.postId,
      groupId: posts.groupId,
      groupName: groups.name,
      authorHandle: users.handle,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .innerJoin(groups, eq(groups.id, posts.groupId))
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(
      groupIds === 'all'
        ? eq(comments.status, 'pending_review')
        : and(
            eq(comments.status, 'pending_review'),
            inArray(posts.groupId, groupIds.length > 0 ? groupIds : ['__none__']),
          ),
    )
    .orderBy(desc(comments.createdAt));

  const pendingComments = await commentQuery;

  // ── Merge and sort by createdAt desc ─────────────────────────────────────

  type RawItem =
    | {
        kind: 'post';
        id: string;
        groupId: string;
        groupName: string;
        authorHandle: string;
        body: string;
        createdAt: Date;
      }
    | {
        kind: 'comment';
        id: string;
        groupId: string;
        groupName: string;
        authorHandle: string;
        body: string;
        createdAt: Date;
      };

  const merged: RawItem[] = [
    ...pendingPosts.map((p) => ({ kind: 'post' as const, ...p })),
    ...pendingComments.map((c) => ({ kind: 'comment' as const, ...c })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = merged.length;
  const paged = merged.slice(offset, offset + PAGE_SIZE);

  // ── Fetch latest AI moderation_decision for each paged item ──────────────

  // We query per targetType+targetId pair.
  const targetIds = paged.map((item) => item.id);

  const decisionMap = new Map<string, { reasoning: string | null; scores: ModerationScores }>();

  if (targetIds.length > 0) {
    const decisionRows = await db
      .select({
        targetId: moderationDecisions.targetId,
        reasoning: moderationDecisions.reasoning,
        scores: moderationDecisions.scores,
        createdAt: moderationDecisions.createdAt,
      })
      .from(moderationDecisions)
      .where(inArray(moderationDecisions.targetId, targetIds))
      .orderBy(desc(moderationDecisions.createdAt));

    // Keep only the latest per targetId.
    for (const row of decisionRows) {
      if (!decisionMap.has(row.targetId)) {
        decisionMap.set(row.targetId, {
          reasoning: row.reasoning,
          scores: (row.scores as ModerationScores) ?? {},
        });
      }
    }
  }

  const items: QueueItem[] = paged.map((item) => ({
    kind: item.kind,
    id: item.id,
    groupId: item.groupId,
    groupName: item.groupName,
    authorHandle: item.authorHandle,
    preview: item.body.slice(0, 200),
    createdAt: item.createdAt,
    latestDecision: decisionMap.get(item.id) ?? null,
  }));

  return { items, total };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ModerationQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/signin`);

  // Auth gate: must have moderation authority over at least one group, or be a platform anchor.
  const groupIds = await getModeratableGroupIds(viewer.id, viewer.reputation);
  const hasAuthority = groupIds === 'all' || groupIds.length > 0;
  if (!hasAuthority) redirect(`/${locale}/dashboard`);

  // Pagination.
  const pageRaw = typeof sp.page === 'string' ? sp.page : '1';
  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);

  const { items, total } = await fetchQueueItems(groupIds, page);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <main className="mx-auto max-w-[960px] px-[var(--spacing-6)] py-[var(--spacing-12)]" dir="auto">
      {/* Header */}
      <header className="mb-[var(--spacing-8)]">
        <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
          Moderation
        </span>
        <h1 className="m-0 mt-[var(--spacing-1)] text-[length:var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
          Review queue
        </h1>
        {total > 0 && (
          <p className="m-0 mt-[var(--spacing-2)] text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text-muted)]">
            {total} item{total !== 1 ? 's' : ''} pending review
          </p>
        )}
      </header>

      <hr className="border-0 border-t border-[var(--color-border)] mb-[var(--spacing-8)]" />

      {/* Queue */}
      {items.length === 0 ? (
        <div
          data-testid="queue-empty-state"
          className="bg-[var(--color-surface)] border border-[var(--color-border)] p-[var(--spacing-10)] text-center"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <p className="m-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]">
            No items to review.
          </p>
        </div>
      ) : (
        <section aria-label="Items pending review">
          <ul className="flex flex-col gap-[var(--spacing-4)] list-none p-0 m-0">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <QueueRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <nav
          aria-label={`Page ${page} of ${totalPages}`}
          className="mt-[var(--spacing-10)] flex items-center justify-between gap-[var(--spacing-4)]"
        >
          {hasPrev ? (
            <Link
              data-testid="pagination-prev"
              href={`/${locale}/moderation?page=${page - 1}`}
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
              href={`/${locale}/moderation?page=${page + 1}`}
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

// ── Queue row ─────────────────────────────────────────────────────────────────

function QueueRow({ item }: { item: QueueItem }) {
  const scoreEntries = item.latestDecision ? Object.entries(item.latestDecision.scores) : [];

  return (
    <article
      data-testid="queue-item"
      aria-label={`${item.kind === 'post' ? 'Post' : 'Comment'} by @${item.authorHandle} in ${item.groupName}`}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      <div className="p-[var(--spacing-5)]">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-[var(--spacing-3)] mb-[var(--spacing-3)]">
          {/* Type badge */}
          <span
            className="inline-flex items-center px-[var(--spacing-2)] py-0.5 font-mono text-[length:var(--text-micro)] uppercase tracking-wider border"
            style={{ borderRadius: 'var(--radius-xs)' }}
            aria-label={`Type: ${item.kind}`}
          >
            {item.kind}
          </span>

          {/* Group name */}
          <span
            className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
            aria-label={`Group: ${item.groupName}`}
          >
            {item.groupName}
          </span>

          {/* Author handle */}
          <span
            className="text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text-muted)]"
            aria-label={`Author: @${item.authorHandle}`}
          >
            @{item.authorHandle}
          </span>

          {/* Age */}
          <time
            dateTime={item.createdAt.toISOString()}
            className="ms-auto font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {relativeTime(item.createdAt)}
          </time>
        </div>

        {/* Content preview */}
        <p className="m-0 mb-[var(--spacing-4)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text)]">
          {item.preview}
          {item.preview.length >= 200 ? '…' : ''}
        </p>

        {/* AI decision reasoning + scores */}
        {item.latestDecision && (
          <details className="mb-[var(--spacing-4)]">
            <summary className="cursor-pointer font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] select-none">
              AI analysis
            </summary>
            <div
              className="mt-[var(--spacing-3)] p-[var(--spacing-3)] bg-[var(--color-paper)] border border-[var(--color-border)]"
              style={{ borderRadius: 'var(--radius-xs)' }}
            >
              {item.latestDecision.reasoning && (
                <p className="m-0 mb-[var(--spacing-3)] text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text)]">
                  {item.latestDecision.reasoning}
                </p>
              )}
              {scoreEntries.length > 0 && (
                <table className="w-full border-collapse" aria-label="AI moderation scores">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="text-start font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-1)] border-b border-[var(--color-border)]"
                      >
                        Category
                      </th>
                      <th
                        scope="col"
                        className="text-end font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-1)] border-b border-[var(--color-border)]"
                      >
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreEntries.map(([key, score]) => (
                      <tr key={key}>
                        <td className="py-[var(--spacing-1)] text-[length:var(--text-body-sm)] text-[var(--color-text)]">
                          {key}
                        </td>
                        <td className="py-[var(--spacing-1)] text-end font-mono text-[length:var(--text-body-sm)] tabular-nums text-[var(--color-text)]">
                          {typeof score === 'number' ? score.toFixed(3) : String(score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </details>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-[var(--spacing-3)]">
          {/* Publish */}
          <form
            action={async () => {
              'use server';
              await moderatorPublishAction(item.kind, item.id);
            }}
          >
            <button
              type="submit"
              data-testid="btn-publish"
              aria-label={`Publish this ${item.kind}`}
              className="inline-flex items-center px-[var(--spacing-4)] py-[var(--spacing-2)] bg-[var(--color-text)] text-[var(--color-paper)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider border border-[var(--color-text)] hover:opacity-80 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
              style={{
                borderRadius: 'var(--radius-xs)',
                transitionDuration: 'var(--duration-base)',
              }}
            >
              Publish
            </button>
          </form>

          {/* Reject */}
          <form
            action={async (formData: FormData) => {
              'use server';
              const reason = (formData.get('reason') as string) ?? 'Rejected by moderator';
              await moderatorRejectAction(item.kind, item.id, reason);
            }}
          >
            <input type="hidden" name="reason" value="Rejected by moderator" aria-hidden="true" />
            <button
              type="submit"
              data-testid="btn-reject"
              aria-label={`Reject this ${item.kind}`}
              className="inline-flex items-center px-[var(--spacing-4)] py-[var(--spacing-2)] bg-transparent text-[var(--color-text)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider border border-[var(--color-border)] hover:border-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
              style={{
                borderRadius: 'var(--radius-xs)',
                transitionDuration: 'var(--duration-base)',
              }}
            >
              Reject
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
