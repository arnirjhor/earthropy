import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers, postSdgs } from '@repo/database/schema';
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
    </main>
  );
}
