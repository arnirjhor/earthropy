/**
 * Unit tests for GroupDetailPage.
 *
 * Covers:
 * 1. Public group visible to unauthenticated viewer.
 * 2. Private group 404s for non-members.
 * 3. Private group renders for members.
 * 4. Private group renders for owners.
 * 5. Join button visible for non-member on public group.
 * 6. Leave button visible for member on public group.
 * 7. Manage link visible for owner.
 * 8. Role label visible for moderator.
 * 9. Posts list renders when posts exist.
 * 10. Empty state renders when no posts.
 * 11. Create-post CTA visible to members.
 * 12. Create-post CTA hidden from non-members.
 * 13. Group not found 404s.
 */

import type { GroupWithSdgs } from '@repo/groups';
import type { PostRow } from '@repo/posts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ─────────────────────────────────────────────────────

const { mockGetGroupBySlug, mockListPostsInGroup, mockGetSession, mockDbSelect } = vi.hoisted(
  () => ({
    mockGetGroupBySlug: vi.fn(),
    mockListPostsInGroup: vi.fn(),
    mockGetSession: vi.fn(),
    mockDbSelect: vi.fn(),
  }),
);

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@repo/groups', () => ({
  getGroupBySlug: mockGetGroupBySlug,
}));

vi.mock('@repo/posts', () => ({
  listPostsInGroup: mockListPostsInGroup,
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
  usePathname: () => '/en/g/test-group',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@repo/database/client', () => ({
  db: {
    select: mockDbSelect,
  },
}));

vi.mock('@repo/database/schema', () => ({
  groupMembers: {
    groupId: 'group_id',
    userId: 'user_id',
    role: 'role',
  },
  postSdgs: {
    postId: 'post_id',
    sdgId: 'sdg_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  count: vi.fn().mockReturnValue('count_expr'),
  inArray: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@repo/design-system/components/SdgChip', () => ({
  SdgChip: ({ sdg }: { sdg: number }) => <span data-testid={`sdg-chip-${sdg}`}>SDG {sdg}</span>,
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

vi.mock('@/app/[locale]/(authenticated)/g/_actions.ts', () => ({
  joinGroupAction: vi.fn(),
  leaveGroupAction: vi.fn(),
}));

import GroupDetailPage from './page.tsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

const GROUP_ID = 'group-uuid';
const OWNER_ID = 'owner-user-id';
const MEMBER_ID = 'member-user-id';
const MOD_ID = 'mod-user-id';
const OTHER_ID = 'other-user-id';

type MemberRole = 'owner' | 'moderator' | 'member';

function makeGroup(override: Partial<GroupWithSdgs> = {}): GroupWithSdgs {
  return {
    id: GROUP_ID,
    slug: 'test-group',
    name: 'Test Group',
    description: 'A test group about climate action.',
    visibility: 'public',
    preferredLocale: 'en',
    locationText: null,
    createdBy: OWNER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    sdgs: [
      {
        id: 13 as const,
        code: 'climate-action' as const,
        name: 'Climate Action',
        shortName: 'Climate',
        color: '#3F7E44',
        onColor: '#FFFFFF' as const,
        iconRef: 'sdg-13',
        description: 'Take urgent action to combat climate change.',
        nameKey: 'sdg.13.name',
        descriptionKey: 'sdg.13.description',
        indicatorsUrl: 'https://sdgs.un.org/goals/goal13',
      },
    ],
    ...override,
  };
}

function makePost(override: Partial<PostRow> = {}): PostRow {
  return {
    id: 'post-uuid',
    groupId: GROUP_ID,
    authorId: OWNER_ID,
    title: 'A published post',
    body: 'Post body content.',
    locale: 'en',
    status: 'published',
    statusReason: null,
    publishedAt: new Date('2026-04-01'),
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
    ...override,
  };
}

function makeUser(id: string, handle = 'testuser') {
  return {
    id,
    email: `${handle}@example.com`,
    handle,
    displayName: 'Test User',
    locale: 'en',
    reputation: 0,
  };
}

/**
 * Wire up db.select mock for the three queries the page makes:
 *   1. getViewerMembership  — only when viewer is authenticated
 *   2. getGroupMemberCount
 *   3. getPostSdgMap        — only when posts.length > 0
 *
 * Each call returns { from: fn } → { where: fn } → Promise<rows>.
 */
function setupDbMock(opts: {
  memberRole: MemberRole | null;
  isAuthenticated: boolean;
  memberCount: number;
  postIds?: string[];
}) {
  mockDbSelect.mockReset();

  function makeChain(rows: unknown[]) {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    return { from };
  }

  // Call 1 (only when authenticated): viewer membership
  if (opts.isAuthenticated) {
    const memberRows = opts.memberRole ? [{ role: opts.memberRole }] : [];
    mockDbSelect.mockReturnValueOnce(makeChain(memberRows));
  }

  // Call 2: member count
  mockDbSelect.mockReturnValueOnce(makeChain([{ count: opts.memberCount }]));

  // Call 3 (only when posts exist): postSdgMap — return empty for tests
  if (opts.postIds && opts.postIds.length > 0) {
    mockDbSelect.mockReturnValueOnce(makeChain([]));
  }
}

async function renderPage(
  group: GroupWithSdgs | null,
  posts: PostRow[],
  viewerId: string | null,
  memberRole: MemberRole | null = null,
  memberCount = 1,
) {
  mockGetGroupBySlug.mockResolvedValue(group);
  mockListPostsInGroup.mockResolvedValue(posts);

  const isAuthenticated = viewerId !== null;
  if (isAuthenticated) {
    mockGetSession.mockResolvedValue(makeUser(viewerId));
  } else {
    mockGetSession.mockResolvedValue(null);
  }

  setupDbMock({
    memberRole,
    isAuthenticated,
    memberCount,
    postIds: posts.map((p) => p.id),
  });

  const params = Promise.resolve({ locale: 'en', slug: 'test-group' });
  return render(await GroupDetailPage({ params }));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GroupDetailPage — public group visibility', () => {
  it('renders group name for unauthenticated viewer on public group', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], null);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Group');
  });

  it('renders group name for authenticated non-member on public group', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], OTHER_ID, null);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Group');
  });

  it('renders group description', async () => {
    await renderPage(makeGroup(), [], null);
    expect(screen.getByText('A test group about climate action.')).toBeInTheDocument();
  });

  it('renders SDG chips', async () => {
    await renderPage(makeGroup(), [], null);
    expect(screen.getByTestId('sdg-chip-13')).toBeInTheDocument();
  });
});

describe('GroupDetailPage — private group visibility', () => {
  it('404s for unauthenticated viewer on private group', async () => {
    mockGetGroupBySlug.mockResolvedValue(makeGroup({ visibility: 'private' }));
    mockListPostsInGroup.mockResolvedValue([]);
    mockGetSession.mockResolvedValue(null);
    setupDbMock({ memberRole: null, isAuthenticated: false, memberCount: 0 });

    const params = Promise.resolve({ locale: 'en', slug: 'test-group' });
    await expect(GroupDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('404s for non-member on private group', async () => {
    mockGetGroupBySlug.mockResolvedValue(makeGroup({ visibility: 'private' }));
    mockListPostsInGroup.mockResolvedValue([]);
    mockGetSession.mockResolvedValue(makeUser(OTHER_ID));
    setupDbMock({ memberRole: null, isAuthenticated: true, memberCount: 2 });

    const params = Promise.resolve({ locale: 'en', slug: 'test-group' });
    await expect(GroupDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders for member on private group', async () => {
    await renderPage(makeGroup({ visibility: 'private' }), [], MEMBER_ID, 'member', 2);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Group');
  });

  it('renders for owner on private group', async () => {
    await renderPage(makeGroup({ visibility: 'private' }), [], OWNER_ID, 'owner', 1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Group');
  });
});

describe('GroupDetailPage — group not found', () => {
  it('404s when group does not exist', async () => {
    mockGetGroupBySlug.mockResolvedValue(null);
    mockListPostsInGroup.mockResolvedValue([]);
    mockGetSession.mockResolvedValue(null);

    // No db calls needed — group not found before membership check
    const params = Promise.resolve({ locale: 'en', slug: 'does-not-exist' });
    await expect(GroupDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('GroupDetailPage — join/leave buttons', () => {
  it('renders Join button for non-member on public group', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], OTHER_ID, null);
    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
  });

  it('renders Leave button for member', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], MEMBER_ID, 'member');
    expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument();
  });

  it('does not render Join or Leave button for owner', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], OWNER_ID, 'owner');
    expect(screen.queryByRole('button', { name: /join/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /leave/i })).not.toBeInTheDocument();
  });

  it('does not render Join button for moderator (already a member)', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], MOD_ID, 'moderator');
    expect(screen.queryByRole('button', { name: /join/i })).not.toBeInTheDocument();
  });

  it('renders no Join button for unauthenticated viewer', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], null);
    // Unauthenticated viewer sees no Join button (no session)
    expect(screen.queryByRole('button', { name: /join/i })).not.toBeInTheDocument();
  });
});

describe('GroupDetailPage — owner/moderator controls', () => {
  it('shows Manage link for owner', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], OWNER_ID, 'owner');
    const manageLink = screen.getByRole('link', { name: /manage/i });
    expect(manageLink).toBeInTheDocument();
    expect(manageLink).toHaveAttribute('href', expect.stringContaining('/settings'));
  });

  it('shows Manage link for moderator', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], MOD_ID, 'moderator');
    const manageLink = screen.getByRole('link', { name: /manage/i });
    expect(manageLink).toBeInTheDocument();
  });

  it('does not show Manage link for regular member', async () => {
    await renderPage(makeGroup({ visibility: 'public' }), [], MEMBER_ID, 'member');
    expect(screen.queryByRole('link', { name: /manage/i })).not.toBeInTheDocument();
  });
});

describe('GroupDetailPage — posts list', () => {
  it('renders post titles when posts exist', async () => {
    const posts = [
      makePost({ id: 'p1', title: 'First Post' }),
      makePost({ id: 'p2', title: 'Second Post' }),
    ];
    await renderPage(makeGroup(), posts, OTHER_ID, null);
    expect(screen.getByText('First Post')).toBeInTheDocument();
    expect(screen.getByText('Second Post')).toBeInTheDocument();
  });

  it('renders post links to /g/<slug>/p/<id>', async () => {
    const post = makePost({ id: 'post-abc' });
    await renderPage(makeGroup(), [post], OTHER_ID, null);
    const link = screen.getByRole('link', { name: /a published post/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/g/test-group/p/post-abc'));
  });

  it('renders empty state when no posts', async () => {
    await renderPage(makeGroup(), [], OTHER_ID, null);
    expect(screen.getByTestId('posts-empty-state')).toBeInTheDocument();
  });

  it('calls listPostsInGroup with correct params', async () => {
    mockGetGroupBySlug.mockResolvedValue(makeGroup());
    mockListPostsInGroup.mockResolvedValue([]);
    mockGetSession.mockResolvedValue(null);
    setupDbMock({ memberRole: null, isAuthenticated: false, memberCount: 1 });

    const params = Promise.resolve({ locale: 'en', slug: 'test-group' });
    await GroupDetailPage({ params });

    expect(mockListPostsInGroup).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: GROUP_ID, status: 'published', limit: 24 }),
    );
  });
});

describe('GroupDetailPage — create post CTA', () => {
  it('shows Create post CTA for members', async () => {
    await renderPage(makeGroup(), [], MEMBER_ID, 'member');
    expect(screen.getByRole('link', { name: /create post/i })).toBeInTheDocument();
  });

  it('shows Create post CTA for owner', async () => {
    await renderPage(makeGroup(), [], OWNER_ID, 'owner');
    expect(screen.getByRole('link', { name: /create post/i })).toBeInTheDocument();
  });

  it('hides Create post CTA for non-member', async () => {
    await renderPage(makeGroup(), [], OTHER_ID, null);
    expect(screen.queryByRole('link', { name: /create post/i })).not.toBeInTheDocument();
  });

  it('hides Create post CTA for unauthenticated viewer', async () => {
    await renderPage(makeGroup(), [], null);
    expect(screen.queryByRole('link', { name: /create post/i })).not.toBeInTheDocument();
  });
});

describe('GroupDetailPage — header meta', () => {
  it('renders member count in mono micro line', async () => {
    await renderPage(makeGroup(), [], OTHER_ID, null, 7);
    // Should show member count somewhere
    expect(screen.getByTestId('group-member-count')).toHaveTextContent(/7/);
  });

  it('renders SDG-colored top stripe with primary SDG id', async () => {
    await renderPage(makeGroup(), [], null);
    // The stripe should exist with aria-hidden
    const stripe = document.querySelector('[data-group-sdg-stripe]');
    expect(stripe).toBeInTheDocument();
  });
});
