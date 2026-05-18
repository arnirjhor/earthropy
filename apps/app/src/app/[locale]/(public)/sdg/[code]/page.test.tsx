/**
 * Unit tests for SdgHubPage.
 *
 * Covers:
 * 1. Valid code renders SDG name and description.
 * 2. Valid code renders goal number in header.
 * 3. Unknown code → 404.
 * 4. Header stripe has correct SDG color variable.
 * 5. UN indicators link is present.
 * 6. Groups section renders AtlasCards.
 * 7. Groups empty state.
 * 8. See-all groups link → /g?sdgs=<id>.
 * 9. Posts section renders PostCards.
 * 10. Posts empty state.
 * 11. Follow button visible for authenticated viewer who doesn't follow.
 * 12. Unfollow button visible for authenticated viewer who follows.
 * 13. No follow button for unauthenticated viewer.
 */

import type { ListGroupsResult } from '@repo/groups';
import type { PostRow } from '@repo/posts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ─────────────────────────────────────────────────────

const { mockListGroups, mockDbSelect, mockGetSession } = vi.hoisted(() => ({
  mockListGroups: vi.fn(),
  mockDbSelect: vi.fn(),
  mockGetSession: vi.fn(),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@repo/groups', () => ({
  listGroups: mockListGroups,
}));

vi.mock('@repo/auth', () => ({
  getSession: mockGetSession,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-session-id' }),
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/sdg/climate-action',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@repo/database/client', () => ({
  db: {
    select: mockDbSelect,
  },
}));

vi.mock('@repo/database/schema', () => ({
  followedSdgs: {
    userId: 'user_id',
    sdgId: 'sdg_id',
  },
  postSdgs: {
    postId: 'post_id',
    sdgId: 'sdg_id',
  },
  posts: {
    id: 'id',
    groupId: 'group_id',
    authorId: 'author_id',
    title: 'title',
    body: 'body',
    locale: 'locale',
    status: 'status',
    statusReason: 'status_reason',
    publishedAt: 'published_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  count: vi.fn().mockReturnValue('count_expr'),
  inArray: vi.fn(),
  desc: vi.fn().mockReturnValue('desc_expr'),
  sql: vi.fn(),
}));

vi.mock('@repo/design-system', () => ({
  AtlasCard: ({
    group,
  }: {
    group: { name: string; primarySdgId: number; href: string; memberCount: number };
  }) => (
    <article data-testid="atlas-card">
      <a href={group.href}>{group.name}</a>
      <span data-testid="atlas-sdg">{group.primarySdgId}</span>
    </article>
  ),
}));

vi.mock('@repo/design-system/components/SdgChip', () => ({
  SdgChip: ({ sdg }: { sdg: number }) => <span data-testid={`sdg-chip-${sdg}`}>SDG {sdg}</span>,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  setRequestLocale: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...(rest as Record<string, unknown>)}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/[locale]/(public)/sdg/[code]/_actions.ts', () => ({
  followSdgAction: vi.fn(),
  unfollowSdgAction: vi.fn(),
}));

import SdgHubPage from './page.tsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';

function makeGroup(
  override: Partial<{
    id: string;
    slug: string;
    name: string;
    description: string;
    primarySdgId: number;
    memberCount: number;
  }> = {},
) {
  return {
    id: override.id ?? 'group-uuid',
    slug: override.slug ?? 'test-group',
    name: override.name ?? 'Climate Group',
    description: override.description ?? 'A group about climate action.',
    visibility: 'public' as const,
    preferredLocale: 'en',
    locationText: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    primarySdgId: (override.primarySdgId ?? 13) as import('@repo/sdg').SdgId,
    memberCount: override.memberCount ?? 5,
  };
}

function makePost(override: Partial<PostRow> = {}): PostRow {
  return {
    id: 'post-uuid',
    groupId: 'group-uuid',
    authorId: USER_ID,
    title: 'Climate Action Post',
    body: 'Post body.',
    locale: 'en',
    status: 'published',
    statusReason: null,
    publishedAt: new Date('2026-04-01'),
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
    ...override,
  };
}

function makeUser(id: string) {
  return {
    id,
    email: 'user@example.com',
    handle: 'testuser',
    displayName: 'Test User',
    locale: 'en',
    reputation: 0,
  };
}

/**
 * Setup db.select mock for the 2- or 3-step queries in the page:
 * 1. listPostsBySdg step 1: postSdgs tagged rows (by sdgId)
 * 2. listPostsBySdg step 2: posts rows (only if step 1 returns non-empty)
 * 3. getViewerFollowing: followedSdgs rows (only when authenticated)
 */
function setupDbMock(opts: {
  postRows: PostRow[];
  isAuthenticated: boolean;
  isFollowing: boolean;
}) {
  mockDbSelect.mockReset();

  function makeChain(rows: unknown[]) {
    // Use a Promise subclass so the object is awaitable AND chainable.
    class ChainPromise extends Promise<unknown[]> {
      from = vi.fn().mockImplementation(() => new ChainPromise((r) => r(rows)));
      where = vi.fn().mockImplementation(() => new ChainPromise((r) => r(rows)));
      orderBy = vi.fn().mockImplementation(() => new ChainPromise((r) => r(rows)));
      offset = vi.fn().mockImplementation(() => new ChainPromise((r) => r(rows)));
      limit = vi.fn().mockResolvedValue(rows);
    }
    const chain = new ChainPromise((r) => r(rows));
    return { from: vi.fn().mockImplementation(() => chain) };
  }

  // Call 1: postSdgs tagged rows (returns fake postId objects for each post)
  const taggedRows = opts.postRows.map((p) => ({ postId: p.id }));
  mockDbSelect.mockReturnValueOnce(makeChain(taggedRows));

  // Call 2: posts query (only when there are tagged rows)
  if (opts.postRows.length > 0) {
    mockDbSelect.mockReturnValueOnce(makeChain(opts.postRows));
  }

  // Call 3 (only when authenticated): check viewer is following
  if (opts.isAuthenticated) {
    const followRows = opts.isFollowing ? [{ sdgId: 13, userId: USER_ID }] : [];
    mockDbSelect.mockReturnValueOnce(makeChain(followRows));
  }
}

async function renderPage(
  code: string,
  groups: ListGroupsResult,
  posts: PostRow[],
  viewerId: string | null,
  isFollowing = false,
) {
  mockListGroups.mockResolvedValue(groups);

  const isAuthenticated = viewerId !== null;
  if (isAuthenticated) {
    mockGetSession.mockResolvedValue(makeUser(viewerId));
  } else {
    mockGetSession.mockResolvedValue(null);
  }

  setupDbMock({ postRows: posts, isAuthenticated, isFollowing });

  const params = Promise.resolve({ locale: 'en', code });
  return render(await SdgHubPage({ params }));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SdgHubPage — valid SDG code', () => {
  it('renders SDG name in header', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], null);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Climate Action');
  });

  it('renders SDG goal number', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], null);
    expect(screen.getByTestId('sdg-goal-number')).toHaveTextContent('13');
  });

  it('renders SDG description', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], null);
    expect(screen.getByTestId('sdg-description')).toBeInTheDocument();
  });

  it('renders UN indicators link', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], null);
    const link = screen.getByRole('link', { name: /indicators/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('unstats.un.org'));
  });

  it('renders header stripe with correct SDG color var', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], null);
    const stripe = document.querySelector('[data-sdg-stripe]');
    expect(stripe).toBeInTheDocument();
    const style = (stripe as HTMLElement).style.backgroundColor;
    // Inline style set to var(--sdg-13)
    expect(style).toContain('var(--sdg-13)');
  });
});

describe('SdgHubPage — unknown code → 404', () => {
  it('throws NEXT_NOT_FOUND for unknown SDG code', async () => {
    const params = Promise.resolve({ locale: 'en', code: 'not-a-real-sdg' });
    await expect(SdgHubPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('throws NEXT_NOT_FOUND for empty code', async () => {
    const params = Promise.resolve({ locale: 'en', code: '' });
    await expect(SdgHubPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('SdgHubPage — groups section', () => {
  it('renders AtlasCards for each group', async () => {
    const groups = {
      rows: [
        makeGroup({ name: 'Group A' }),
        makeGroup({ id: 'g2', slug: 'group-b', name: 'Group B' }),
      ],
      total: 2,
    };
    await renderPage('climate-action', groups, [], null);
    const cards = screen.getAllByTestId('atlas-card');
    expect(cards).toHaveLength(2);
  });

  it('renders see-all link pointing to /g?sdgs=<id>', async () => {
    const groups = {
      rows: [makeGroup()],
      total: 1,
    };
    await renderPage('climate-action', groups, [], null);
    const link = screen.getByRole('link', { name: /see all/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/g?sdgs=13'));
  });

  it('renders groups empty state when no groups', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], null);
    expect(screen.getByTestId('groups-empty-state')).toBeInTheDocument();
  });
});

describe('SdgHubPage — posts section', () => {
  it('renders post titles', async () => {
    const posts = [
      makePost({ id: 'p1', title: 'First Post' }),
      makePost({ id: 'p2', title: 'Second Post' }),
    ];
    await renderPage('climate-action', { rows: [], total: 0 }, posts, null);
    expect(screen.getByText('First Post')).toBeInTheDocument();
    expect(screen.getByText('Second Post')).toBeInTheDocument();
  });

  it('renders posts empty state when no posts', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], null);
    expect(screen.getByTestId('posts-empty-state')).toBeInTheDocument();
  });
});

describe('SdgHubPage — follow/unfollow toggle', () => {
  it('shows Follow button for authenticated user who does not follow', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], USER_ID, false);
    expect(screen.getByRole('button', { name: /follow/i })).toBeInTheDocument();
  });

  it('shows Unfollow button for authenticated user who follows', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], USER_ID, true);
    expect(screen.getByRole('button', { name: /unfollow/i })).toBeInTheDocument();
  });

  it('does not show Follow/Unfollow for unauthenticated viewer', async () => {
    await renderPage('climate-action', { rows: [], total: 0 }, [], null);
    expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unfollow/i })).not.toBeInTheDocument();
  });
});
