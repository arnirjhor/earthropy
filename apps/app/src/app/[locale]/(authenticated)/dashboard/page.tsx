import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { followedSdgs, groupMembers, groupSdgs, groups, postSdgs } from '@repo/database/schema';
import { AtlasCard } from '@repo/design-system/components/AtlasCard';
import { SdgChip } from '@repo/design-system/components/SdgChip';
import { listPostsForFeed } from '@repo/posts';
import { SDGS } from '@repo/sdg';
import type { SdgId } from '@repo/sdg';
import { and, count, eq, inArray } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { followSdgAction, unfollowSdgAction } from './_actions.ts';

// ── Session helper ─────────────────────────────────────────────────────────────

async function getViewer() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── Data helpers ───────────────────────────────────────────────────────────────

async function getUserFollowedSdgIds(userId: string): Promise<number[]> {
  const rows = await db
    .select({ sdgId: followedSdgs.sdgId })
    .from(followedSdgs)
    .where(eq(followedSdgs.userId, userId));
  return rows.map((r) => r.sdgId);
}

interface MemberGroupRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  primarySdgId: SdgId;
}

async function getUserMemberGroups(userId: string, limit = 8): Promise<MemberGroupRow[]> {
  // Two-step: fetch member group ids, then group details + primary SDG
  const memberGroupIdRows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  if (memberGroupIdRows.length === 0) return [];

  const memberGroupIds = memberGroupIdRows.map((r) => r.groupId);

  const rows = await db
    .select({
      id: groups.id,
      slug: groups.slug,
      name: groups.name,
      description: groups.description,
      memberCount: count(groupMembers.userId),
      primarySdgId: groupSdgs.sdgId,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .leftJoin(groupSdgs, and(eq(groupSdgs.groupId, groups.id), eq(groupSdgs.primary, true)))
    .where(inArray(groups.id, memberGroupIds))
    .groupBy(groups.id, groupSdgs.sdgId)
    .orderBy(groups.createdAt)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    memberCount: r.memberCount,
    primarySdgId: (typeof r.primarySdgId === 'number' ? r.primarySdgId : 1) as SdgId,
  }));
}

async function getPostSdgMap(postIds: string[]): Promise<Map<string, SdgId[]>> {
  if (postIds.length === 0) return new Map();
  const rows = await db
    .select({ postId: postSdgs.postId, sdgId: postSdgs.sdgId })
    .from(postSdgs)
    .where(inArray(postSdgs.postId, postIds));
  const map = new Map<string, SdgId[]>();
  for (const r of rows) {
    const arr = map.get(r.postId) ?? [];
    arr.push(r.sdgId as SdgId);
    map.set(r.postId, arr);
  }
  return map;
}

// ── Relative time ──────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('Auth');

  const viewer = await getViewer();

  // Parallel initial data fetches
  const [followedSdgIds, memberGroups] = await Promise.all([
    viewer ? getUserFollowedSdgIds(viewer.id) : Promise.resolve<number[]>([]),
    viewer ? getUserMemberGroups(viewer.id) : Promise.resolve<MemberGroupRow[]>([]),
  ]);

  // Feed: OR union of group-posts + followed-SDG-posts
  const feedPosts = viewer
    ? await listPostsForFeed({
        userId: viewer.id,
        sdgIds: followedSdgIds.length > 0 ? followedSdgIds : undefined,
        limit: 25,
      })
    : [];

  const postSdgMap = await getPostSdgMap(feedPosts.map((p) => p.id));

  const followedSdgSet = new Set(followedSdgIds);

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1200px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
      dir="auto"
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-[var(--spacing-2)] md:flex-row md:items-baseline md:justify-between mb-[var(--spacing-8)]">
        <h1 className="m-0 text-[length:var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
          {t('dashboard.welcome', { name: viewer?.displayName ?? t('dashboard.defaultName') })}
        </h1>
        <nav aria-label="Account">
          <Link
            href={`/${locale}/signout`}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            style={{ transitionDuration: 'var(--duration-base)' }}
          >
            {t('dashboard.signOut')}
          </Link>
        </nav>
      </header>

      <hr className="mb-[var(--spacing-10)] border-0 border-t border-[var(--color-border)]" />

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-[var(--spacing-10)] lg:flex-row lg:gap-[var(--spacing-8)] rtl:lg:flex-row-reverse">
        {/* ── Left rail ─────────────────────────────────────────────────── */}
        <aside
          className="w-full lg:w-[280px] shrink-0 flex flex-col gap-[var(--spacing-8)]"
          aria-label="Sidebar"
        >
          {/* Your groups */}
          <section aria-labelledby="groups-rail-heading" data-testid="groups-rail">
            <h2
              id="groups-rail-heading"
              className="m-0 mb-[var(--spacing-4)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
              style={{ fontVariant: 'small-caps' }}
            >
              Your groups
            </h2>

            {memberGroups.length === 0 ? (
              <p className="text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text-muted)]">
                You haven&apos;t joined any groups yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-[var(--spacing-3)] list-none p-0 m-0">
                {memberGroups.map((g) => (
                  <li key={g.id} className="contents">
                    <AtlasCard
                      group={{
                        name: g.name,
                        description: g.description,
                        primarySdgId: g.primarySdgId,
                        memberCount: g.memberCount,
                        href: `/${locale}/g/${g.slug}`,
                      }}
                      Link={({ href, children, className }) => (
                        <Link href={href} className={className}>
                          {children}
                        </Link>
                      )}
                    />
                  </li>
                ))}
              </ul>
            )}

            {memberGroups.length > 0 && (
              <Link
                href={`/${locale}/g`}
                className="mt-[var(--spacing-3)] inline-block font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                style={{ transitionDuration: 'var(--duration-base)' }}
              >
                See all &rarr;
              </Link>
            )}
          </section>

          {/* SDGs you follow */}
          <section aria-labelledby="sdg-rail-heading" data-testid="sdg-rail">
            <h2
              id="sdg-rail-heading"
              className="m-0 mb-[var(--spacing-4)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
              style={{ fontVariant: 'small-caps' }}
            >
              SDGs you follow
            </h2>

            <ul
              className="grid grid-cols-3 gap-[var(--spacing-2)] list-none p-0 m-0"
              aria-label="Sustainable Development Goals — toggle to follow"
            >
              {SDGS.map((sdg) => {
                const isFollowed = followedSdgSet.has(sdg.id);
                return (
                  <li key={sdg.id} className="contents">
                    <form
                      action={async () => {
                        'use server';
                        if (isFollowed) {
                          await unfollowSdgAction(sdg.id);
                        } else {
                          await followSdgAction(sdg.id);
                        }
                      }}
                    >
                      <button
                        type="submit"
                        aria-pressed={isFollowed}
                        aria-label={`SDG ${sdg.id}: ${sdg.name}${isFollowed ? ' (following)' : ''}`}
                        className="w-full cursor-pointer border transition-colors"
                        style={{
                          borderRadius: 'var(--radius-xs)',
                          transitionDuration: 'var(--duration-base)',
                          borderColor: isFollowed ? `var(--sdg-${sdg.id})` : 'var(--color-border)',
                          backgroundColor: isFollowed
                            ? `color-mix(in srgb, var(--sdg-${sdg.id}) 12%, transparent)`
                            : 'transparent',
                          padding: 'var(--spacing-2)',
                        }}
                      >
                        <SdgChip sdg={sdg.id} size="sm" withName={false} />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>

        {/* ── Main feed column ──────────────────────────────────────────── */}
        <section
          aria-labelledby="feed-heading"
          data-testid="feed-section"
          className="flex-1 min-w-0"
        >
          <h2
            id="feed-heading"
            className="m-0 mb-[var(--spacing-6)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
            style={{ fontVariant: 'small-caps' }}
          >
            Your feed
          </h2>

          {feedPosts.length === 0 ? (
            <div
              data-testid="feed-empty-state"
              className="bg-[var(--color-surface)] border border-[var(--color-border)] p-[var(--spacing-8)] flex flex-col gap-[var(--spacing-4)]"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <p className="m-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]">
                Your feed is empty. Join groups or follow SDGs to see posts here.
              </p>
              <div className="flex flex-wrap gap-[var(--spacing-3)]">
                <Link
                  href={`/${locale}/g`}
                  className="inline-flex items-center px-[var(--spacing-5)] py-[var(--spacing-2)] bg-[var(--color-text)] text-[var(--color-paper)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider no-underline hover:bg-transparent hover:text-[var(--color-text)] border border-[var(--color-text)] transition-colors"
                  style={{
                    borderRadius: 'var(--radius-xs)',
                    transitionDuration: 'var(--duration-base)',
                  }}
                >
                  Join a group
                </Link>
                <Link
                  href={`/${locale}/dashboard#sdg-rail-heading`}
                  className="inline-flex items-center px-[var(--spacing-5)] py-[var(--spacing-2)] bg-transparent text-[var(--color-text)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider no-underline border border-[var(--color-border)] hover:border-[var(--color-text)] transition-colors"
                  style={{
                    borderRadius: 'var(--radius-xs)',
                    transitionDuration: 'var(--duration-base)',
                  }}
                >
                  Follow some SDGs
                </Link>
              </div>
            </div>
          ) : (
            <ul
              className="flex flex-col gap-[var(--spacing-4)] list-none p-0 m-0"
              aria-label="Your feed"
            >
              {feedPosts.map((post) => {
                const postSdgIds = postSdgMap.get(post.id) ?? [];
                const timestamp = post.publishedAt ?? post.createdAt;
                const href = `/${locale}/g/${post.groupId}/p/${post.id}`;

                return (
                  <li key={post.id}>
                    <article
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden transition-transform hover:border-[var(--color-text)] hover:-translate-y-px motion-reduce:hover:translate-y-0"
                      style={{
                        borderRadius: 'var(--radius-sm)',
                        transitionDuration: 'var(--duration-base)',
                        transitionTimingFunction: 'var(--ease-out)',
                      }}
                    >
                      <Link
                        href={href}
                        className="block p-[var(--spacing-5)] no-underline text-[var(--color-text)]"
                        aria-label={post.title}
                      >
                        <h3 className="m-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] font-medium text-[var(--color-text)] line-clamp-2">
                          {post.title}
                        </h3>

                        {postSdgIds.length > 0 && (
                          <ul
                            aria-label="SDGs addressed by this post"
                            className="mt-[var(--spacing-3)] flex flex-wrap gap-[var(--spacing-2)] list-none p-0 m-0"
                          >
                            {postSdgIds.map((sdgId) => (
                              <li key={sdgId} className="contents">
                                <SdgChip sdg={sdgId} size="sm" />
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-[var(--spacing-3)] flex items-center gap-[var(--spacing-3)]">
                          <time
                            dateTime={timestamp.toISOString()}
                            className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
                          >
                            {relativeTime(timestamp)}
                          </time>
                        </div>
                      </Link>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
