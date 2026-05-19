import { listOutcomesBySdg } from '@/app/[locale]/(authenticated)/g/[slug]/outcomes/_actions.ts';
import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { followedSdgs, postSdgs, posts } from '@repo/database/schema';
import { AtlasCard } from '@repo/design-system';
import { listGroups } from '@repo/groups';
import type { SdgId } from '@repo/sdg';
import { getSdgByCode, isSdgCode } from '@repo/sdg';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { followSdgAction, unfollowSdgAction } from './_actions.ts';

// ── Session helper ─────────────────────────────────────────────────────────────

async function getViewer() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── Posts by SDG helper ────────────────────────────────────────────────────────

async function listPostsBySdg(sdgId: number, limit: number) {
  // Step 1: fetch post ids tagged with this SDG
  const taggedRows = await db
    .select({ postId: postSdgs.postId })
    .from(postSdgs)
    .where(eq(postSdgs.sdgId, sdgId));

  if (taggedRows.length === 0) return [];

  const postIds = taggedRows.map((r) => r.postId);

  // Step 2: fetch published posts from those ids, most recent first
  const rows = await db
    .select({
      id: posts.id,
      groupId: posts.groupId,
      authorId: posts.authorId,
      title: posts.title,
      body: posts.body,
      locale: posts.locale,
      status: posts.status,
      statusReason: posts.statusReason,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(and(eq(posts.status, 'published'), inArray(posts.id, postIds)))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);

  return rows;
}

// ── Viewer follow check helper ─────────────────────────────────────────────────

async function getViewerFollowing(userId: string, sdgId: number): Promise<boolean> {
  const rows = await db
    .select({ sdgId: followedSdgs.sdgId })
    .from(followedSdgs)
    .where(and(eq(followedSdgs.userId, userId), eq(followedSdgs.sdgId, sdgId)));
  return rows.length > 0;
}

// ── Relative time helper ───────────────────────────────────────────────────────

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

export default async function SdgHubPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;

  // 404 on unknown SDG code
  if (!isSdgCode(code)) {
    notFound();
  }

  const sdg = getSdgByCode(code);

  // Fetch groups (max 12), posts (max 25), viewer, and outcomes in parallel
  const viewerPromise = getViewer();
  const [groupsResult, sdgPosts, viewer, sdgOutcomes] = await Promise.all([
    listGroups({
      sdgIds: [sdg.id as SdgId],
      visibility: 'public',
      limit: 12,
      offset: 0,
    }),
    listPostsBySdg(sdg.id, 25),
    viewerPromise,
    listOutcomesBySdg(sdg.id),
  ]);

  // Check if viewer follows this SDG
  const isFollowing = viewer ? await getViewerFollowing(viewer.id, sdg.id) : false;

  return (
    <main
      id="main-content"
      dir="auto"
      className="mx-auto max-w-[1200px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
    >
      {/* ── SDG Header card ────────────────────────────────────────────────── */}
      <header
        className="mb-[var(--spacing-10)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
        style={{ borderRadius: 'var(--radius-sm)' }}
      >
        {/* 6px color stripe */}
        <div
          aria-hidden="true"
          data-sdg-stripe
          className="w-full"
          style={{ height: '6px', backgroundColor: `var(--sdg-${sdg.id})` }}
        />

        <div className="p-[var(--spacing-8)]">
          {/* Goal number — Plex Mono display */}
          <span
            data-testid="sdg-goal-number"
            className="font-mono text-[length:var(--text-display)] leading-none text-[var(--color-text-muted)] block mb-[var(--spacing-2)]"
            aria-label={`Goal ${sdg.id}`}
          >
            {sdg.id}
          </span>

          {/* SDG name — h1, Plex Sans display */}
          <h1 className="m-0 text-[length:var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
            {sdg.name}
          </h1>

          {/* Description */}
          <p
            data-testid="sdg-description"
            className="mt-[var(--spacing-3)] mb-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)] max-w-[640px]"
          >
            {sdg.description}
          </p>

          {/* UN indicators link + follow/unfollow row */}
          <div className="mt-[var(--spacing-6)] flex flex-wrap items-center gap-[var(--spacing-4)]">
            <a
              href={sdg.indicatorsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors border-b border-[var(--color-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
            >
              UN Indicators
            </a>

            {/* Follow / Unfollow — authenticated viewers only */}
            {viewer &&
              (isFollowing ? (
                <form
                  action={async () => {
                    'use server';
                    await unfollowSdgAction(sdg.id);
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex items-center px-[var(--spacing-5)] py-[var(--spacing-2)] bg-transparent text-[var(--color-text)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider border border-[var(--color-border)] hover:border-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
                    style={{
                      borderRadius: 'var(--radius-xs)',
                      transitionDuration: 'var(--duration-base)',
                    }}
                  >
                    Unfollow
                  </button>
                </form>
              ) : (
                <form
                  action={async () => {
                    'use server';
                    await followSdgAction(sdg.id);
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex items-center px-[var(--spacing-5)] py-[var(--spacing-2)] bg-[var(--color-text)] text-[var(--color-paper)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
                    style={{
                      borderRadius: 'var(--radius-xs)',
                      transitionDuration: 'var(--duration-base)',
                    }}
                  >
                    Follow
                  </button>
                </form>
              ))}
          </div>
        </div>
      </header>

      {/* ── Groups section ────────────────────────────────────────────────── */}
      <section aria-labelledby="groups-heading" className="mb-[var(--spacing-12)]">
        <div className="flex items-center justify-between mb-[var(--spacing-6)]">
          <h2
            id="groups-heading"
            className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]"
          >
            Groups
          </h2>

          {groupsResult.rows.length > 0 && (
            <Link
              href={`/${locale}/g?sdgs=${sdg.id}`}
              className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors border-b border-[var(--color-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
            >
              See all
            </Link>
          )}
        </div>

        {groupsResult.rows.length === 0 ? (
          <p
            data-testid="groups-empty-state"
            className="text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]"
          >
            No groups yet.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-[var(--spacing-4)] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 m-0 p-0 list-none">
            {groupsResult.rows.map((group) => (
              <li key={group.id} className="m-0 p-0">
                <AtlasCard
                  group={{
                    name: group.name,
                    description: group.description ?? '',
                    primarySdgId: group.primarySdgId,
                    memberCount: group.memberCount,
                    href: `/${locale}/g/${group.slug}`,
                  }}
                  Link={Link}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Posts section ─────────────────────────────────────────────────── */}
      <section aria-labelledby="posts-heading">
        <h2
          id="posts-heading"
          className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)] mb-[var(--spacing-6)]"
        >
          Recent posts
        </h2>

        {sdgPosts.length === 0 ? (
          <p
            data-testid="posts-empty-state"
            className="text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]"
          >
            No published posts yet.
          </p>
        ) : (
          <ul
            className="flex flex-col gap-[var(--spacing-3)] list-none p-0 m-0"
            aria-label="Recent posts tagged with this SDG"
          >
            {sdgPosts.map((post) => {
              const timestamp = post.publishedAt ?? post.createdAt;
              return (
                <li key={post.id} className="m-0 p-0">
                  <article
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden transition-transform hover:border-[var(--color-text)] hover:-translate-y-px motion-reduce:hover:translate-y-0"
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      transitionDuration: 'var(--duration-base)',
                      transitionTimingFunction: 'var(--ease-out)',
                    }}
                  >
                    <Link
                      href={`/${locale}/g/${post.groupId}/p/${post.id}`}
                      className="flex items-baseline justify-between gap-[var(--spacing-4)] px-[var(--spacing-5)] py-[var(--spacing-4)] no-underline text-[var(--color-text)]"
                      aria-label={post.title}
                    >
                      <span className="text-[length:var(--text-body)] leading-[var(--text-body--line-height)] font-medium text-[var(--color-text)] line-clamp-1 min-w-0">
                        {post.title}
                      </span>
                      <time
                        dateTime={timestamp.toISOString()}
                        className="shrink-0 font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
                      >
                        {relativeTime(timestamp)}
                      </time>
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Impact section ────────────────────────────────────────────────── */}
      {sdgOutcomes.length > 0 && (
        <section aria-labelledby="impact-heading" className="mt-[var(--spacing-12)]">
          <h2
            id="impact-heading"
            className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)] mb-[var(--spacing-6)]"
          >
            Reported Impact
          </h2>
          <p className="mb-[var(--spacing-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            Self-reported outcomes from groups working on {sdg.name}. Values are not externally
            verified.
          </p>
          <ul
            className="flex flex-col gap-[var(--spacing-3)] list-none p-0 m-0"
            aria-label="Reported outcomes for this SDG"
          >
            {sdgOutcomes.map((outcome) => (
              <li
                key={`${outcome.groupId}-${outcome.indicatorCode}-${outcome.reportedAt.toISOString()}`}
                className="m-0 p-0"
              >
                <article
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden transition-colors hover:border-[var(--color-text)]"
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    transitionDuration: 'var(--duration-base)',
                  }}
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
                    <p className="mt-[var(--spacing-1)] text-[length:var(--text-body)] text-[var(--color-text)] font-medium">
                      {outcome.indicatorName}
                    </p>
                    <p className="mt-[var(--spacing-1)] font-mono text-[length:var(--text-body-sm)] text-[var(--color-text)]">
                      {outcome.value}{' '}
                      <span className="text-[var(--color-text-muted)]">{outcome.unit}</span>
                    </p>
                    <p className="mt-[var(--spacing-3)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                      {outcome.groupName}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
