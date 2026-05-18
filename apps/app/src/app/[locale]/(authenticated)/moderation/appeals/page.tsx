/**
 * /moderation/appeals — Appeals queue for moderators/anchors.
 *
 * Lists unresolved appeals (resolvedAt IS NULL) for content within
 * the viewer's authority scope.
 *
 * Each row: type, group, author handle, appeal message, age,
 * Uphold / Reject buttons.
 */

import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { appeals, comments, groupMembers, groups, posts, users } from '@repo/database/schema';
import { can } from '@repo/trust';
import { desc, eq, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolveAppealAction } from '../_appeal-actions.ts';

// ── Constants ──────────────────────────────────────────────────────────────────

const PLATFORM_ANCHOR_REP = 2000;

// ── Types ──────────────────────────────────────────────────────────────────────

interface AppealItem {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  userId: string;
  authorHandle: string;
  message: string;
  createdAt: Date;
  groupId: string;
  groupName: string;
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

async function getModeratableGroupIds(
  userId: string,
  reputation: number,
): Promise<string[] | 'all'> {
  if (reputation >= PLATFORM_ANCHOR_REP) return 'all';

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

async function fetchPendingAppeals(groupIds: string[] | 'all'): Promise<AppealItem[]> {
  // Fetch appeals for posts in scope
  const postAppeals = await db
    .select({
      id: appeals.id,
      targetType: appeals.targetType,
      targetId: appeals.targetId,
      userId: appeals.userId,
      authorHandle: users.handle,
      message: appeals.message,
      createdAt: appeals.createdAt,
      groupId: posts.groupId,
      groupName: groups.name,
    })
    .from(appeals)
    .innerJoin(posts, eq(posts.id, appeals.targetId))
    .innerJoin(groups, eq(groups.id, posts.groupId))
    .innerJoin(users, eq(users.id, appeals.userId))
    .where(
      groupIds === 'all'
        ? isNull(appeals.resolvedAt)
        : groupIds.length > 0
          ? isNull(appeals.resolvedAt)
          : isNull(appeals.resolvedAt),
    )
    .orderBy(desc(appeals.createdAt));

  // Filter by group scope when not 'all'
  const postAppealsFiltered =
    groupIds === 'all' ? postAppeals : postAppeals.filter((a) => groupIds.includes(a.groupId));

  // Fetch appeals for comments in scope
  const commentAppeals = await db
    .select({
      id: appeals.id,
      targetType: appeals.targetType,
      targetId: appeals.targetId,
      userId: appeals.userId,
      authorHandle: users.handle,
      message: appeals.message,
      createdAt: appeals.createdAt,
      groupId: posts.groupId,
      groupName: groups.name,
    })
    .from(appeals)
    .innerJoin(comments, eq(comments.id, appeals.targetId))
    .innerJoin(posts, eq(posts.id, comments.postId))
    .innerJoin(groups, eq(groups.id, posts.groupId))
    .innerJoin(users, eq(users.id, appeals.userId))
    .where(isNull(appeals.resolvedAt))
    .orderBy(desc(appeals.createdAt));

  const commentAppealsFiltered =
    groupIds === 'all'
      ? commentAppeals
      : commentAppeals.filter((a) => groupIds.includes(a.groupId));

  const merged = [
    ...postAppealsFiltered.map((a) => ({ ...a, targetType: 'post' as const })),
    ...commentAppealsFiltered.map((a) => ({ ...a, targetType: 'comment' as const })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return merged;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AppealsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/signin`);

  const groupIds = await getModeratableGroupIds(viewer.id, viewer.reputation);
  const hasAuthority = groupIds === 'all' || groupIds.length > 0;
  if (!hasAuthority) redirect(`/${locale}/dashboard`);

  const items = await fetchPendingAppeals(groupIds);

  return (
    <main className="mx-auto max-w-[960px] px-[var(--spacing-6)] py-[var(--spacing-12)]" dir="auto">
      {/* Header */}
      <header className="mb-[var(--spacing-8)]">
        <nav aria-label="Breadcrumb" className="mb-[var(--spacing-3)]">
          <Link
            href={`/${locale}/moderation`}
            className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
          >
            ← Moderation
          </Link>
        </nav>

        <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
          Appeals
        </span>
        <h1 className="m-0 mt-[var(--spacing-1)] text-[length:var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
          Appeal queue
        </h1>
        {items.length > 0 && (
          <p className="m-0 mt-[var(--spacing-2)] text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text-muted)]">
            {items.length} appeal{items.length !== 1 ? 's' : ''} pending resolution
          </p>
        )}
      </header>

      <hr className="border-0 border-t border-[var(--color-border)] mb-[var(--spacing-8)]" />

      {/* Queue */}
      {items.length === 0 ? (
        <div
          data-testid="appeals-empty-state"
          className="bg-[var(--color-surface)] border border-[var(--color-border)] p-[var(--spacing-10)] text-center"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <p className="m-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]">
            No appeals pending review.
          </p>
        </div>
      ) : (
        <section aria-label="Appeals pending resolution">
          <ul className="flex flex-col gap-[var(--spacing-4)] list-none p-0 m-0">
            {items.map((item) => (
              <li key={item.id}>
                <AppealRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

// ── Appeal row ─────────────────────────────────────────────────────────────────

function AppealRow({ item }: { item: AppealItem }) {
  return (
    <article
      data-testid="appeal-item"
      aria-label={`Appeal by @${item.authorHandle} for ${item.targetType} in ${item.groupName}`}
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
            aria-label={`Type: ${item.targetType}`}
          >
            {item.targetType}
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

        {/* Appeal message */}
        <p className="m-0 mb-[var(--spacing-4)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text)]">
          {item.message}
        </p>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-[var(--spacing-3)]">
          {/* Uphold */}
          <form
            action={async (formData: FormData) => {
              'use server';
              const msg = (formData.get('resolutionMessage') as string) ?? '';
              await resolveAppealAction({
                appealId: item.id,
                resolution: 'upheld',
                resolutionMessage: msg || undefined,
              });
            }}
          >
            <input type="hidden" name="resolutionMessage" value="" aria-hidden="true" />
            <button
              type="submit"
              data-testid="btn-uphold"
              aria-label={`Uphold appeal for this ${item.targetType}`}
              className="inline-flex items-center px-[var(--spacing-4)] py-[var(--spacing-2)] bg-[var(--color-text)] text-[var(--color-paper)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider border border-[var(--color-text)] hover:opacity-80 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
              style={{
                borderRadius: 'var(--radius-xs)',
                transitionDuration: 'var(--duration-base)',
              }}
            >
              Uphold
            </button>
          </form>

          {/* Reject appeal */}
          <form
            action={async (formData: FormData) => {
              'use server';
              const msg = (formData.get('resolutionMessage') as string) ?? 'Appeal rejected';
              await resolveAppealAction({
                appealId: item.id,
                resolution: 'rejected',
                resolutionMessage: msg,
              });
            }}
          >
            <input
              type="hidden"
              name="resolutionMessage"
              value="Appeal rejected"
              aria-hidden="true"
            />
            <button
              type="submit"
              data-testid="btn-reject-appeal"
              aria-label={`Reject appeal for this ${item.targetType}`}
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
