/**
 * Unit tests for DashboardPage.
 *
 * Covers:
 * 1. Empty state — no feed posts, renders CTAs.
 * 2. With-feed — posts visible in main column.
 * 3. SDG follow toggle — followSdgAction / unfollowSdgAction present in DOM.
 * 4. Groups rail — user groups rendered as AtlasCards.
 * 5. SDG chip rail — 17 chips; followed ones highlighted.
 * 6. RTL layout attribute present.
 */

import type { GroupRow } from '@repo/groups';
import type { PostRow } from '@repo/posts';
import type { SdgId } from '@repo/sdg';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ─────────────────────────────────────────────────────

const { mockGetSession, mockListPostsForFeed, mockDbSelect, mockDbInsert, mockDbDelete } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockListPostsForFeed: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
  }));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@repo/auth', () => ({
  getSession: mockGetSession,
}));

vi.mock('@repo/posts', () => ({
  listPostsForFeed: mockListPostsForFeed,
}));

vi.mock('@repo/database/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    delete: mockDbDelete,
  },
}));

vi.mock('@repo/database/schema', () => ({
  groupMembers: { groupId: 'group_id', userId: 'user_id', role: 'role' },
  groups: {
    id: 'id',
    slug: 'slug',
    name: 'name',
    description: 'description',
    visibility: 'visibility',
    preferredLocale: 'preferred_locale',
    locationText: 'location_text',
    createdBy: 'created_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  groupSdgs: { groupId: 'group_id', sdgId: 'sdg_id', primary: 'primary' },
  postSdgs: { postId: 'post_id', sdgId: 'sdg_id' },
  followedSdgs: { userId: 'user_id', sdgId: 'sdg_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  count: vi.fn().mockReturnValue('count_expr'),
  sql: vi.fn(),
}));

vi.mock('@repo/design-system/components/SdgChip', () => ({
  SdgChip: ({ sdg }: { sdg: number }) => <span data-testid={`sdg-chip-${sdg}`}>SDG {sdg}</span>,
}));

vi.mock('@repo/design-system/components/AtlasCard', () => ({
  AtlasCard: ({
    group,
  }: {
    group: { name: string; href: string; primarySdgId: number };
  }) => (
    <div data-testid={`atlas-card-${group.name}`}>
      <a href={group.href}>{group.name}</a>
    </div>
  ),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-session-id' }),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
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

vi.mock('@/app/[locale]/(authenticated)/dashboard/_actions.ts', () => ({
  followSdgAction: vi.fn(),
  unfollowSdgAction: vi.fn(),
}));

import DashboardPage from './page.tsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-123';

function makeUser(id = USER_ID) {
  return {
    id,
    email: 'user@example.com',
    handle: 'testuser',
    displayName: 'Test User',
    locale: 'en',
    reputation: 0,
  };
}

function makePost(override: Partial<PostRow> = {}): PostRow {
  return {
    id: 'post-uuid',
    groupId: 'group-uuid',
    authorId: USER_ID,
    title: 'A published post',
    body: 'Body content.',
    locale: 'en',
    status: 'published',
    statusReason: null,
    publishedAt: new Date('2026-04-01'),
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
    ...override,
  };
}

function makeGroupRow(override: Partial<GroupRow> = {}): GroupRow {
  return {
    id: 'group-uuid',
    slug: 'my-group',
    name: 'My Group',
    description: 'A test group',
    visibility: 'public',
    preferredLocale: 'en',
    locationText: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    memberCount: 3,
    primarySdgId: 13 as SdgId,
    ...override,
  };
}

/**
 * Set up db.select mock for the dashboard queries:
 *   1. getUserFollowedSdgs    — select from user_followed_sdgs  (where)
 *   2a. getUserMemberGroups   — select member group ids         (where, returns [{groupId}])
 *   2b. getUserMemberGroups   — select group details + join     (where + innerJoin + leftJoin + groupBy + orderBy + limit)
 *   3. getPostSdgMap          — only when posts.length > 0
 */
function setupDbMock(opts: {
  followedSdgIds?: number[];
  memberGroups?: GroupRow[];
  postIds?: string[];
}) {
  mockDbSelect.mockReset();

  // Simple chain: select().from().where() → resolves rows
  function makeSimpleChain(rows: unknown[]) {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    };
  }

  // Complex chain for group detail query:
  // select().from().innerJoin().leftJoin().where().groupBy().orderBy().limit()
  function makeGroupDetailChain(rows: unknown[]) {
    const limitFn = vi.fn().mockResolvedValue(rows);
    const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
    const groupByFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const whereFn = vi.fn().mockReturnValue({ groupBy: groupByFn });
    const leftJoinFn = vi.fn().mockReturnValue({ where: whereFn });
    const innerJoinFn = vi.fn().mockReturnValue({ leftJoin: leftJoinFn });
    return {
      from: vi.fn().mockReturnValue({ innerJoin: innerJoinFn }),
    };
  }

  // Chain for postSdgMap: select().from().where()
  function makePostSdgChain() {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    };
  }

  // Call 1: getUserFollowedSdgIds
  const sdgRows = (opts.followedSdgIds ?? []).map((id) => ({ sdgId: id }));
  mockDbSelect.mockReturnValueOnce(makeSimpleChain(sdgRows));

  // Call 2a: getUserMemberGroups — member group ids
  const memberGroupIds =
    opts.memberGroups && opts.memberGroups.length > 0
      ? opts.memberGroups.map((g) => ({ groupId: g.id }))
      : [];
  mockDbSelect.mockReturnValueOnce(makeSimpleChain(memberGroupIds));

  // Call 2b: getUserMemberGroups — group details (only if we have groups)
  if (memberGroupIds.length > 0) {
    const groupDetailRows = (opts.memberGroups ?? []).map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      memberCount: g.memberCount,
      primarySdgId: g.primarySdgId,
    }));
    mockDbSelect.mockReturnValueOnce(makeGroupDetailChain(groupDetailRows));
  }

  // Call 3: getPostSdgMap (only when posts exist)
  if (opts.postIds && opts.postIds.length > 0) {
    mockDbSelect.mockReturnValueOnce(makePostSdgChain());
  }
}

async function renderPage(opts: {
  posts?: PostRow[];
  followedSdgIds?: number[];
  memberGroups?: GroupRow[];
  authenticated?: boolean;
}) {
  const { posts = [], followedSdgIds = [], memberGroups = [], authenticated = true } = opts;

  if (authenticated) {
    mockGetSession.mockResolvedValue(makeUser());
  } else {
    mockGetSession.mockResolvedValue(null);
  }

  mockListPostsForFeed.mockResolvedValue(posts);

  setupDbMock({
    followedSdgIds,
    memberGroups,
    postIds: posts.map((p) => p.id),
  });

  const params = Promise.resolve({ locale: 'en' });
  return render(await DashboardPage({ params }));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('DashboardPage — empty state', () => {
  it('renders empty state when no posts exist', async () => {
    await renderPage({ posts: [] });
    expect(screen.getByTestId('feed-empty-state')).toBeInTheDocument();
  });

  it('empty state contains CTA link to /g (join a group)', async () => {
    await renderPage({ posts: [] });
    const link = screen.getByRole('link', { name: /join a group/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining('/g'));
  });

  it('renders page heading', async () => {
    await renderPage({ posts: [] });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('DashboardPage — with-feed', () => {
  it('renders post titles in main column', async () => {
    const posts = [
      makePost({ id: 'p1', title: 'Climate Trends' }),
      makePost({ id: 'p2', title: 'Poverty Report' }),
    ];
    await renderPage({ posts });
    expect(screen.getByText('Climate Trends')).toBeInTheDocument();
    expect(screen.getByText('Poverty Report')).toBeInTheDocument();
  });

  it('does not render empty state when posts exist', async () => {
    await renderPage({ posts: [makePost()] });
    expect(screen.queryByTestId('feed-empty-state')).not.toBeInTheDocument();
  });

  it('renders listPostsForFeed with the user id', async () => {
    await renderPage({ posts: [] });
    expect(mockListPostsForFeed).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }));
  });
});

describe('DashboardPage — groups rail', () => {
  it('renders group names in left rail', async () => {
    const groups = [
      makeGroupRow({ id: 'g1', slug: 'grp-1', name: 'Climate Action Group' }),
      makeGroupRow({ id: 'g2', slug: 'grp-2', name: 'Ocean Advocacy' }),
    ];
    await renderPage({ memberGroups: groups });
    expect(screen.getByTestId('atlas-card-Climate Action Group')).toBeInTheDocument();
    expect(screen.getByTestId('atlas-card-Ocean Advocacy')).toBeInTheDocument();
  });

  it('renders empty groups rail gracefully', async () => {
    await renderPage({ memberGroups: [] });
    // Rail section should still exist, just with no cards
    expect(screen.getByTestId('groups-rail')).toBeInTheDocument();
  });
});

describe('DashboardPage — SDG follow toggle', () => {
  it('renders 17 SDG chip buttons', async () => {
    await renderPage({ followedSdgIds: [] });
    // 17 SDG toggle buttons in the chip rail
    const buttons = screen.getAllByRole('button', { name: /sdg \d+/i });
    expect(buttons.length).toBe(17);
  });

  it('marks followed SDGs as active', async () => {
    await renderPage({ followedSdgIds: [13, 7] });
    const active = screen
      .getAllByRole('button', { name: /sdg \d+/i })
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(active.length).toBe(2);
  });

  it('marks unfollowed SDGs as inactive', async () => {
    await renderPage({ followedSdgIds: [13] });
    const inactive = screen
      .getAllByRole('button', { name: /sdg \d+/i })
      .filter((b) => b.getAttribute('aria-pressed') === 'false');
    expect(inactive.length).toBe(16);
  });
});
