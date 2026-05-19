import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers, postSdgs, sdgIndicators } from '@repo/database/schema';
import { SdgChip } from '@repo/design-system/components/SdgChip';
import { getGroupBySlug } from '@repo/groups';
import { listPostsInGroup } from '@repo/posts';
import type { SdgId } from '@repo/sdg';
import { and, count, eq, inArray } from 'drizzle-orm';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { joinGroupAction, leaveGroupAction } from '../_actions.ts';
import { PostCard } from './_post-card.tsx';
import { getGroupProgress, listOutcomes } from './outcomes/_actions.ts';
import { ReportOutcomeForm } from './outcomes/_report-form.tsx';

// ── Session helper ─────────────────────────────────────────────────────────────

async function getViewer() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── Membership helper ──────────────────────────────────────────────────────────

type MemberRole = 'owner' | 'moderator' | 'member';

async function getViewerMembership(groupId: string, userId: string): Promise<MemberRole | null> {
  const rows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  const row = rows[0];
  if (!row) return null;
  return row.role as MemberRole;
}

// ── Member count helper ────────────────────────────────────────────────────────

async function getGroupMemberCount(groupId: string): Promise<number> {
  const rows = await db
    .select({ count: count(groupMembers.userId) })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  return rows[0]?.count ?? 0;
}

// ── Post SDG helper ────────────────────────────────────────────────────────────

async function getPostSdgMap(postIds: string[]): Promise<Map<string, SdgId[]>> {
  if (postIds.length === 0) return new Map();
  const rows = await db
    .select({ postId: postSdgs.postId, sdgId: postSdgs.sdgId })
    .from(postSdgs)
    .where(inArray(postSdgs.postId, postIds));
  const map = new Map<string, SdgId[]>();
  for (const r of rows) {
    const existing = map.get(r.postId) ?? [];
    existing.push(r.sdgId as SdgId);
    map.set(r.postId, existing);
  }
  return map;
}

// ── Date formatting helper ─────────────────────────────────────────────────────

function formatCreatedDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Indicators helper ──────────────────────────────────────────────────────────

async function getIndicatorsForGroupSdgs(sdgIds: number[]) {
  if (sdgIds.length === 0) return [];
  return db
    .select({
      id: sdgIndicators.id,
      code: sdgIndicators.code,
      name: sdgIndicators.name,
      unit: sdgIndicators.unit,
      description: sdgIndicators.description,
    })
    .from(sdgIndicators)
    .where(inArray(sdgIndicators.sdgId, sdgIds));
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const [group, viewer] = await Promise.all([getGroupBySlug(slug), getViewer()]);
  if (!group) notFound();

  // Determine viewer membership
  const memberRole = viewer ? await getViewerMembership(group.id, viewer.id) : null;
  const isMember = memberRole !== null;

  // Visibility enforcement: private groups only for members
  if (group.visibility === 'private' && !isMember) {
    notFound();
  }

  // Fetch posts + member count in parallel
  const [posts, memberCount] = await Promise.all([
    listPostsInGroup({ groupId: group.id, status: 'published', limit: 24 }),
    getGroupMemberCount(group.id),
  ]);

  // Batch-fetch SDGs for all posts
  const postSdgMap = await getPostSdgMap(posts.map((p) => p.id));

  // Fetch outcomes + progress + indicators in parallel
  const groupSdgIds = group.sdgs.map((s) => s.id);
  const [outcomeList, progressRows, groupIndicators] = await Promise.all([
    listOutcomes(group.id),
    getGroupProgress(group.id),
    getIndicatorsForGroupSdgs(groupSdgIds),
  ]);

  // Derive primary SDG for the 6px stripe
  const primarySdg = group.sdgs[0];
  const primarySdgId = primarySdg?.id ?? (1 as SdgId);

  // Role-derived booleans
  const isOwnerOrMod = memberRole === 'owner' || memberRole === 'moderator';
  const canJoin = viewer !== null && !isMember;
  const canLeave = isMember && memberRole !== 'owner';

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1200px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
    >
      {/* ── Group header card ─────────────────────────────────────────────── */}
      <header
        className="mb-[var(--spacing-10)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
        style={{ borderRadius: 'var(--radius-sm)' }}
      >
        {/* 6px primary-SDG top stripe — mirrors AtlasCard */}
        <div
          aria-hidden="true"
          data-group-sdg-stripe
          className="w-full"
          style={{ height: '6px', backgroundColor: `var(--sdg-${primarySdgId})` }}
        />

        <div className="p-[var(--spacing-8)]">
          {/* Breadcrumb */}
          <Link
            href={`/${locale}/dashboard`}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
          >
            Earthropy
          </Link>

          {/* Group name */}
          <h1
            data-group-name
            className="mt-[var(--spacing-4)] text-[length:var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]"
          >
            {group.name}
          </h1>

          {/* SDG chip row */}
          {group.sdgs.length > 0 && (
            <ul
              aria-label="SDGs this group focuses on"
              className="mt-[var(--spacing-4)] flex flex-wrap gap-[var(--spacing-2)] list-none p-0 m-0"
            >
              {group.sdgs.map((sdg) => (
                <li key={sdg.id} className="contents">
                  <SdgChip sdg={sdg.id} size="sm" />
                </li>
              ))}
            </ul>
          )}

          {/* Description */}
          {group.description && (
            <p className="mt-[var(--spacing-4)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)] max-w-[640px]">
              {group.description}
            </p>
          )}

          {/* Meta row: member count + created date */}
          <p className="mt-[var(--spacing-5)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
            <span data-testid="group-member-count">{memberCount}</span>
            {' MEMBERS · CREATED '}
            {formatCreatedDate(group.createdAt)}
          </p>

          {/* Action row: Join / Leave / Manage */}
          <div className="mt-[var(--spacing-6)] flex flex-wrap items-center gap-[var(--spacing-3)]">
            {canJoin && (
              <form
                action={async () => {
                  await joinGroupAction(group.id, group.slug, locale);
                }}
              >
                <button
                  type="submit"
                  aria-label={`Join ${group.name}`}
                  className="inline-flex items-center px-[var(--spacing-5)] py-[var(--spacing-2)] bg-[var(--color-text)] text-[var(--color-paper)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
                  style={{
                    borderRadius: 'var(--radius-xs)',
                    transitionDuration: 'var(--duration-base)',
                  }}
                >
                  Join
                </button>
              </form>
            )}

            {canLeave && (
              <form
                action={async () => {
                  await leaveGroupAction(group.id, group.slug, locale);
                }}
              >
                <button
                  type="submit"
                  aria-label={`Leave ${group.name}`}
                  className="inline-flex items-center px-[var(--spacing-5)] py-[var(--spacing-2)] bg-transparent text-[var(--color-text)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider border border-[var(--color-border)] hover:border-[var(--color-text)] transition-colors"
                  style={{
                    borderRadius: 'var(--radius-xs)',
                    transitionDuration: 'var(--duration-base)',
                  }}
                >
                  Leave
                </button>
              </form>
            )}

            {isOwnerOrMod && (
              <>
                <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                  {memberRole === 'owner' ? 'Owner' : 'Moderator'}
                </span>
                <Link
                  href={`/${locale}/g/${slug}/members`}
                  className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors border-b border-[var(--color-border)]"
                >
                  Members
                </Link>
                <Link
                  href={`/${locale}/g/${slug}/settings`}
                  className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors border-b border-[var(--color-border)]"
                >
                  Manage
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Posts section ─────────────────────────────────────────────────── */}
      <section aria-labelledby="posts-heading">
        <div className="flex items-center justify-between mb-[var(--spacing-6)]">
          <h2
            id="posts-heading"
            className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]"
          >
            Posts
          </h2>

          {/* Create post CTA — members only */}
          {isMember && (
            <Link
              href={`/${locale}/g/${slug}/post/new`}
              className="inline-flex items-center px-[var(--spacing-4)] py-[var(--spacing-2)] bg-[var(--color-text)] text-[var(--color-paper)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider no-underline hover:bg-transparent hover:text-[var(--color-text)] border border-[var(--color-text)] transition-colors"
              style={{
                borderRadius: 'var(--radius-xs)',
                transitionDuration: 'var(--duration-base)',
              }}
            >
              Create post
            </Link>
          )}
        </div>

        {posts.length === 0 ? (
          <p
            data-testid="posts-empty-state"
            className="text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]"
          >
            No published posts yet.
          </p>
        ) : (
          <ul
            className="grid grid-cols-1 gap-[var(--spacing-4)] sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0"
            aria-label="Published posts"
          >
            {posts.map((post) => (
              <li key={post.id} className="contents">
                <PostCard
                  post={post}
                  postSdgIds={postSdgMap.get(post.id) ?? []}
                  locale={locale}
                  groupSlug={slug}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Outcomes section ──────────────────────────────────────────────── */}
      <section aria-labelledby="outcomes-heading" className="mt-[var(--spacing-12)]">
        <div className="flex items-center justify-between mb-[var(--spacing-6)]">
          <h2
            id="outcomes-heading"
            className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]"
          >
            Outcomes
          </h2>
        </div>

        {/* Summary / progress table */}
        {progressRows.length > 0 && (
          <div className="mb-[var(--spacing-8)] overflow-x-auto">
            <table className="w-full border-collapse text-[length:var(--text-body-sm)]">
              <caption className="sr-only">Group outcome summary by indicator</caption>
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th
                    scope="col"
                    className="text-left font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] pr-[var(--spacing-4)]"
                  >
                    Indicator
                  </th>
                  <th
                    scope="col"
                    className="text-left font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] pr-[var(--spacing-4)]"
                  >
                    Latest value
                  </th>
                  <th
                    scope="col"
                    className="text-left font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)] pr-[var(--spacing-4)]"
                  >
                    Unit
                  </th>
                  <th
                    scope="col"
                    className="text-left font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] pb-[var(--spacing-2)]"
                  >
                    Reports
                  </th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map((row) => (
                  <tr
                    key={row.indicatorId}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="py-[var(--spacing-3)] pr-[var(--spacing-4)] text-[var(--color-text)]">
                      <span className="font-mono text-[length:var(--text-micro)] text-[var(--color-text-muted)] mr-[var(--spacing-2)]">
                        {row.indicatorCode}
                      </span>
                      {row.indicatorName}
                    </td>
                    <td className="py-[var(--spacing-3)] pr-[var(--spacing-4)] font-mono text-[var(--color-text)]">
                      {row.latestValue}
                    </td>
                    <td className="py-[var(--spacing-3)] pr-[var(--spacing-4)] text-[var(--color-text-muted)]">
                      {row.unit}
                    </td>
                    <td className="py-[var(--spacing-3)] font-mono text-[var(--color-text-muted)]">
                      {row.reportCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report outcome form — members only */}
        {isMember && groupIndicators.length > 0 && (
          <details
            className="mb-[var(--spacing-8)] border border-[var(--color-border)]"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <summary
              className="px-[var(--spacing-5)] py-[var(--spacing-3)] cursor-pointer font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors select-none list-none"
              style={{ transitionDuration: 'var(--duration-base)' }}
            >
              Report outcome
            </summary>
            <div className="px-[var(--spacing-5)] pb-[var(--spacing-5)] pt-[var(--spacing-4)] border-t border-[var(--color-border)]">
              <ReportOutcomeForm
                groupId={group.id}
                indicators={groupIndicators}
                locale={locale}
                groupSlug={slug}
              />
            </div>
          </details>
        )}

        {/* Outcome history list */}
        {outcomeList.length === 0 ? (
          <p
            data-testid="outcomes-empty-state"
            className="text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]"
          >
            No outcomes reported yet.
          </p>
        ) : (
          <ul
            className="flex flex-col gap-[var(--spacing-3)] list-none p-0 m-0"
            aria-label="Reported outcomes"
          >
            {outcomeList.map((outcome) => (
              <li key={outcome.id} className="m-0 p-0">
                <article
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <div className="px-[var(--spacing-5)] py-[var(--spacing-4)]">
                    <div className="flex items-baseline justify-between gap-[var(--spacing-4)] flex-wrap">
                      <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                        {outcome.indicatorCode}
                      </span>
                      <time
                        dateTime={outcome.reportedAt.toISOString()}
                        className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
                      >
                        {outcome.reportedAt.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                    </div>
                    <p className="mt-[var(--spacing-1)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text)] font-medium">
                      {outcome.indicatorName}
                    </p>
                    <p className="mt-[var(--spacing-1)] font-mono text-[length:var(--text-body-sm)] text-[var(--color-text)]">
                      {outcome.value}{' '}
                      <span className="text-[var(--color-text-muted)]">{outcome.unit}</span>
                    </p>
                    <p className="mt-[var(--spacing-2)] text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text-muted)]">
                      {outcome.description}
                    </p>
                    {outcome.evidenceUrl && (
                      <a
                        href={outcome.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-[var(--spacing-2)] inline-block font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors border-b border-[var(--color-border)]"
                      >
                        Evidence
                      </a>
                    )}
                    <p className="mt-[var(--spacing-3)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                      Reported by @{outcome.reporterHandle}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
