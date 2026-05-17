/**
 * Unit tests for PostDetailPage.
 *
 * Tests:
 * 1. Renders title and body.
 * 2. Shows correct status banner for each moderation status.
 * 3. Visibility rules: pending_ai only visible to author or moderator.
 * 4. pending_review only visible to author or moderator.
 * 5. rejected only visible to author.
 * 6. withdrawn only visible to author or moderator.
 * 7. Withdraw button only shown when viewer is author + status is published.
 * 8. SDG chips are rendered.
 */

import type { PostWithSdgs } from '@repo/posts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ─────────────────────────────────────────────────

const { mockGetPostById, mockGetSession, mockGroupMembers } = vi.hoisted(() => ({
  mockGetPostById: vi.fn(),
  mockGetSession: vi.fn(),
  mockGroupMembers: vi.fn(),
}));

// ── Mock @repo/posts ───────────────────────────────────────────────────────

vi.mock('@repo/posts', () => ({
  getPostById: mockGetPostById,
}));

// ── Mock @repo/auth ────────────────────────────────────────────────────────

vi.mock('@repo/auth', () => ({
  getSession: mockGetSession,
}));

// ── Mock next/headers ──────────────────────────────────────────────────────

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-session-id' }),
  }),
}));

// ── Mock next/navigation ───────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/en/g/test-group/p/post-uuid',
  useSearchParams: () => new URLSearchParams(),
}));

// ── Mock next-intl/server ──────────────────────────────────────────────────

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string, opts?: Record<string, string>) => {
    const map: Record<string, string> = {
      'banner.pendingAi': 'Under AI review',
      'banner.pendingReview': 'Held for human review',
      'banner.rejected': opts?.reason
        ? `Rejected — reason: ${opts.reason}; appeal available`
        : 'Rejected',
      'banner.withdrawn': 'Withdrawn by author',
      withdraw: 'Withdraw',
    };
    return map[key] ?? key;
  }),
}));

// ── Mock @repo/database/client (for moderator check) ──────────────────────

vi.mock('@repo/database/client', () => ({
  db: {
    select: mockGroupMembers,
  },
}));

vi.mock('@repo/database/schema', () => ({
  groupMembers: {
    groupId: 'group_id',
    userId: 'user_id',
    role: 'role',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// ── Mock markdown lib ──────────────────────────────────────────────────────

vi.mock('@/lib/markdown.tsx', () => ({
  MarkdownBody: ({ md }: { md: string }) => <div data-testid="markdown-body">{md}</div>,
}));

// ── Mock SdgChip ───────────────────────────────────────────────────────────

vi.mock('@repo/design-system/components/SdgChip', () => ({
  SdgChip: ({ sdg }: { sdg: number }) => <span data-testid={`sdg-chip-${sdg}`}>SDG {sdg}</span>,
}));

// ── Mock p/_actions ────────────────────────────────────────────────────────

vi.mock('@/app/[locale]/(authenticated)/p/_actions.ts', () => ({
  withdrawPostAction: vi.fn(),
}));

// ── Mock _thread (CommentThread server component) ──────────────────────────

vi.mock('@/app/[locale]/(authenticated)/g/[slug]/p/[id]/_thread.tsx', () => ({
  CommentThread: () => <section data-testid="comment-thread" />,
}));

import PostDetailPage from './page.tsx';

// ── Helpers ────────────────────────────────────────────────────────────────

const AUTHOR_ID = 'author-user-id';
const OTHER_ID = 'other-user-id';
const MOD_ID = 'mod-user-id';
const GROUP_ID = 'test-group-id';

function makePost(override: Partial<PostWithSdgs> = {}): PostWithSdgs {
  return {
    id: 'post-uuid',
    groupId: GROUP_ID,
    authorId: AUTHOR_ID,
    title: 'Test Post Title',
    body: '## Hello\n\nWorld.',
    locale: 'en',
    status: 'published',
    statusReason: null,
    publishedAt: new Date('2026-05-18'),
    createdAt: new Date('2026-05-18'),
    updatedAt: new Date('2026-05-18'),
    sdgIds: [13, 7],
    ...override,
  };
}

function setupMocks(
  post: PostWithSdgs | null,
  viewerUserId: string | null,
  viewerRole: 'member' | 'moderator' | null = null,
) {
  mockGetPostById.mockResolvedValue(post);
  if (viewerUserId) {
    mockGetSession.mockResolvedValue({
      id: viewerUserId,
      email: 'test@example.com',
      handle: 'testuser',
      displayName: 'Test User',
      locale: 'en',
      reputation: 0,
    });
  } else {
    mockGetSession.mockResolvedValue(null);
  }

  // Mock the group members lookup for moderator check
  const from = vi.fn().mockReturnThis();
  const where = vi
    .fn()
    .mockResolvedValue(
      viewerRole === 'moderator'
        ? [{ role: 'moderator' }]
        : viewerRole === 'member'
          ? [{ role: 'member' }]
          : [],
    );
  mockGroupMembers.mockReturnValue({ from });
  from.mockReturnValue({ where });
}

async function renderPage(
  post: PostWithSdgs | null,
  viewerUserId: string | null = AUTHOR_ID,
  viewerRole: 'member' | 'moderator' | null = null,
) {
  setupMocks(post, viewerUserId, viewerRole);
  const params = Promise.resolve({
    locale: 'en',
    slug: 'test-group',
    id: 'post-uuid',
  });
  return render(await PostDetailPage({ params }));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PostDetailPage', () => {
  it('renders the post title and body', async () => {
    await renderPage(makePost());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Post Title');
    expect(screen.getByTestId('markdown-body')).toBeInTheDocument();
  });

  it('renders SDG chips for each sdgId', async () => {
    await renderPage(makePost({ sdgIds: [13, 7] }));
    expect(screen.getByTestId('sdg-chip-13')).toBeInTheDocument();
    expect(screen.getByTestId('sdg-chip-7')).toBeInTheDocument();
  });

  it('does not show status banner for published posts', async () => {
    await renderPage(makePost({ status: 'published' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows pending_ai banner for pending_ai posts (author view)', async () => {
    await renderPage(makePost({ status: 'pending_ai' }));
    expect(screen.getByRole('status')).toHaveTextContent('Under AI review');
  });

  it('shows pending_review banner for pending_review posts (author view)', async () => {
    await renderPage(makePost({ status: 'pending_review' }));
    expect(screen.getByRole('status')).toHaveTextContent('Held for human review');
  });

  it('shows rejected banner with reason for rejected posts (author view)', async () => {
    await renderPage(
      makePost({ status: 'rejected', statusReason: 'violates community guidelines' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Rejected');
  });

  it('shows withdrawn banner for withdrawn posts (author view)', async () => {
    await renderPage(makePost({ status: 'withdrawn' }));
    expect(screen.getByRole('status')).toHaveTextContent('Withdrawn by author');
  });

  it('shows Withdraw button when viewer is author and status is published', async () => {
    await renderPage(makePost({ status: 'published', authorId: AUTHOR_ID }), AUTHOR_ID);
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument();
  });

  it('does not show Withdraw button when viewer is not author', async () => {
    await renderPage(makePost({ status: 'published', authorId: AUTHOR_ID }), OTHER_ID);
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument();
  });

  it('does not show Withdraw button when status is not published', async () => {
    await renderPage(makePost({ status: 'pending_ai', authorId: AUTHOR_ID }), AUTHOR_ID);
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument();
  });

  // ── Visibility rules ───────────────────────────────────────────────────

  it('pending_ai post: visible to author', async () => {
    await renderPage(makePost({ status: 'pending_ai', authorId: AUTHOR_ID }), AUTHOR_ID);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('pending_ai post: visible to moderator', async () => {
    await renderPage(makePost({ status: 'pending_ai', authorId: AUTHOR_ID }), MOD_ID, 'moderator');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('pending_ai post: throws/404 for non-author non-moderator', async () => {
    setupMocks(makePost({ status: 'pending_ai', authorId: AUTHOR_ID }), OTHER_ID, 'member');
    const params = Promise.resolve({ locale: 'en', slug: 'test-group', id: 'post-uuid' });
    await expect(PostDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('rejected post: visible to author', async () => {
    await renderPage(makePost({ status: 'rejected', authorId: AUTHOR_ID }), AUTHOR_ID);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('rejected post: throws/404 for non-author', async () => {
    setupMocks(makePost({ status: 'rejected', authorId: AUTHOR_ID }), OTHER_ID, 'member');
    const params = Promise.resolve({ locale: 'en', slug: 'test-group', id: 'post-uuid' });
    await expect(PostDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('withdrawn post: visible to author', async () => {
    await renderPage(makePost({ status: 'withdrawn', authorId: AUTHOR_ID }), AUTHOR_ID);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('withdrawn post: visible to moderator', async () => {
    await renderPage(makePost({ status: 'withdrawn', authorId: AUTHOR_ID }), MOD_ID, 'moderator');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('withdrawn post: throws/404 for non-author non-moderator', async () => {
    setupMocks(makePost({ status: 'withdrawn', authorId: AUTHOR_ID }), OTHER_ID, 'member');
    const params = Promise.resolve({ locale: 'en', slug: 'test-group', id: 'post-uuid' });
    await expect(PostDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('returns 404 if post is not found', async () => {
    setupMocks(null, AUTHOR_ID);
    const params = Promise.resolve({ locale: 'en', slug: 'test-group', id: 'does-not-exist' });
    await expect(PostDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
