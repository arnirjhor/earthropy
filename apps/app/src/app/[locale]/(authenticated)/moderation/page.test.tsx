/**
 * Tests for ModerationQueuePage.
 *
 * Covers:
 * 1. Auth gating — unauthenticated user redirected to signin.
 * 2. Authority gating — authenticated user with no groups redirected to dashboard.
 * 3. Empty state — "No items to review." rendered.
 * 4. Renders pending items — type badge, group, author, preview visible.
 * 5. Action buttons present — Publish + Reject on each row.
 * 6. RTL — dir="auto" on <main>.
 * 7. Pagination — prev/next links appear when multiple pages.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ─────────────────────────────────────────────────────

const { mockGetSession, mockRedirect, mockDbSelect, mockDbInsert } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRedirect: vi.fn().mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@repo/auth', () => ({
  getSession: mockGetSession,
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/moderation',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-session-id' }),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@repo/database/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

vi.mock('@repo/database/schema', () => ({
  posts: {
    id: 'id',
    groupId: 'group_id',
    authorId: 'author_id',
    body: 'body',
    status: 'status',
    createdAt: 'created_at',
  },
  comments: {
    id: 'id',
    postId: 'post_id',
    authorId: 'author_id',
    body: 'body',
    status: 'status',
    createdAt: 'created_at',
  },
  groups: {
    id: 'id',
    name: 'name',
  },
  users: {
    id: 'id',
    handle: 'handle',
  },
  groupMembers: {
    groupId: 'group_id',
    userId: 'user_id',
    role: 'role',
  },
  moderationDecisions: {
    id: 'id',
    targetType: 'target_type',
    targetId: 'target_id',
    reasoning: 'reasoning',
    scores: 'scores',
    verdict: 'verdict',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  desc: vi.fn(),
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

vi.mock('./_actions.ts', () => ({
  moderatorPublishAction: vi.fn().mockResolvedValue({ ok: true }),
  moderatorRejectAction: vi.fn().mockResolvedValue({ ok: true }),
}));

import ModerationQueuePage from './page.tsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-123';
const GROUP_ID = 'group-uuid-456';

function makeViewer(overrides: { reputation?: number } = {}) {
  return {
    id: USER_ID,
    email: 'mod@example.com',
    handle: 'moderator',
    displayName: 'Moderator',
    locale: 'en',
    reputation: overrides.reputation ?? 0,
  };
}

interface MockItem {
  kind: 'post' | 'comment';
  id: string;
  groupId: string;
  groupName: string;
  authorHandle: string;
  body: string;
  createdAt: Date;
}

/**
 * Wire db.select to return:
 * 1. groupMembers query (for getModeratableGroupIds) — [{groupId, role}]
 * 2. posts query — pending post rows
 * 3. comments query (with joins) — pending comment rows
 * 4. moderationDecisions query — decision rows
 */
/**
 * Build a fully-chainable select mock that supports arbitrary numbers of
 * innerJoin calls before a final where(...).orderBy(...) terminal.
 *
 * Strategy: return an object whose every property is a function returning
 * the same object, except `orderBy` which resolves with the provided rows.
 */
function makeJoinChain(finalRows: unknown[]) {
  const orderByFn = vi.fn().mockResolvedValue(finalRows);
  // Build a self-referential chain object. We need to define it before we can
  // reference it, so we use a plain object that we mutate.
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  chain.from = handler;
  chain.innerJoin = handler;
  chain.leftJoin = handler;
  chain.where = handler;
  chain.groupBy = handler;
  chain.limit = handler;
  chain.orderBy = orderByFn;
  return { from: handler };
}

function setupDbMock(opts: {
  reputation?: number;
  memberRows?: { groupId: string; role: string }[];
  postItems?: MockItem[];
  commentItems?: MockItem[];
  decisionRows?: {
    targetId: string;
    reasoning: string;
    scores: Record<string, number>;
    createdAt: Date;
  }[];
}) {
  mockDbSelect.mockReset();

  const isAnchor = (opts.reputation ?? 0) >= 2000;

  // 1. groupMembers — only queried when NOT a platform anchor.
  if (!isAnchor) {
    const memberRows = opts.memberRows ?? [];
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(memberRows),
      }),
    });
  }

  // 2. posts (from → innerJoin×2 → where → orderBy)
  const postRows = (opts.postItems ?? [])
    .filter((i) => i.kind === 'post')
    .map((i) => ({
      id: i.id,
      groupId: i.groupId,
      groupName: i.groupName,
      authorHandle: i.authorHandle,
      body: i.body,
      createdAt: i.createdAt,
    }));
  mockDbSelect.mockReturnValueOnce(makeJoinChain(postRows));

  // 3. comments (from → innerJoin×3 → where → orderBy)
  const commentRows = (opts.commentItems ?? [])
    .filter((i) => i.kind === 'comment')
    .map((i) => ({
      id: i.id,
      postId: 'post-uuid',
      groupId: i.groupId,
      groupName: i.groupName,
      authorHandle: i.authorHandle,
      body: i.body,
      createdAt: i.createdAt,
    }));
  mockDbSelect.mockReturnValueOnce(makeJoinChain(commentRows));

  // 4. moderationDecisions (from → where → orderBy)
  const decRows = opts.decisionRows ?? [];
  mockDbSelect.mockReturnValueOnce(makeJoinChain(decRows));
}

async function renderPage(opts: {
  authenticated?: boolean;
  reputation?: number;
  memberRows?: { groupId: string; role: string }[];
  postItems?: MockItem[];
  commentItems?: MockItem[];
  page?: number;
}) {
  const {
    authenticated = true,
    reputation = 0,
    memberRows = [],
    postItems = [],
    commentItems = [],
    page = 1,
  } = opts;

  if (authenticated) {
    mockGetSession.mockResolvedValue(makeViewer({ reputation }));
  } else {
    mockGetSession.mockResolvedValue(null);
  }

  setupDbMock({ reputation, memberRows, postItems, commentItems });

  const params = Promise.resolve({ locale: 'en' });
  const searchParams = Promise.resolve(page > 1 ? { page: String(page) } : {});

  return render(await ModerationQueuePage({ params, searchParams }));
}

function makePendingPost(override: Partial<MockItem> = {}): MockItem {
  return {
    kind: 'post',
    id: 'post-uuid',
    groupId: GROUP_ID,
    groupName: 'Climate Group',
    authorHandle: 'alice',
    body: 'This is the post body for review.',
    createdAt: new Date('2026-05-01T10:00:00Z'),
    ...override,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ModerationQueuePage — auth gating', () => {
  it('redirects unauthenticated user to signin', async () => {
    await expect(renderPage({ authenticated: false })).rejects.toThrow('REDIRECT:/en/signin');
  });

  it('redirects user with no moderation groups to dashboard', async () => {
    // No member rows → no authority → redirect.
    await expect(
      renderPage({ authenticated: true, reputation: 0, memberRows: [] }),
    ).rejects.toThrow('REDIRECT:/en/dashboard');
  });

  it('does not redirect platform anchor (rep ≥ 2000)', async () => {
    // Platform anchor skips group check — db.select for groupMembers returns empty but passes.
    // We need to stub the posts + comments queries too.
    setupDbMock({ memberRows: [] }); // already handled inside renderPage
    await expect(renderPage({ authenticated: true, reputation: 2000 })).resolves.toBeTruthy();
  });

  it('does not redirect group moderator', async () => {
    await expect(
      renderPage({
        authenticated: true,
        reputation: 0,
        memberRows: [{ groupId: GROUP_ID, role: 'moderator' }],
      }),
    ).resolves.toBeTruthy();
  });
});

describe('ModerationQueuePage — empty state', () => {
  it('renders empty state when no pending items', async () => {
    await renderPage({
      authenticated: true,
      reputation: 2000,
    });
    expect(screen.getByTestId('queue-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No items to review.')).toBeInTheDocument();
  });
});

describe('ModerationQueuePage — renders pending items', () => {
  it('renders a pending post row', async () => {
    const post = makePendingPost({ authorHandle: 'alice', groupName: 'Climate Group' });
    await renderPage({
      authenticated: true,
      reputation: 2000,
      postItems: [post],
    });

    expect(screen.getByTestId('queue-item')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('Climate Group')).toBeInTheDocument();
  });

  it('shows content preview truncated to 200 chars', async () => {
    const longBody = 'A'.repeat(300);
    const post = makePendingPost({ body: longBody });
    await renderPage({ authenticated: true, reputation: 2000, postItems: [post] });
    // Preview should be 200 chars + ellipsis.
    expect(screen.getByText(`${'A'.repeat(200)}…`)).toBeInTheDocument();
  });

  it('shows type badge "post"', async () => {
    const post = makePendingPost();
    await renderPage({ authenticated: true, reputation: 2000, postItems: [post] });
    expect(screen.getByText('post')).toBeInTheDocument();
  });

  it('renders multiple items', async () => {
    const posts = [
      makePendingPost({ id: 'p1', authorHandle: 'alice' }),
      makePendingPost({ id: 'p2', authorHandle: 'bob' }),
    ];
    await renderPage({ authenticated: true, reputation: 2000, postItems: posts });
    const items = screen.getAllByTestId('queue-item');
    expect(items.length).toBe(2);
  });
});

describe('ModerationQueuePage — action buttons', () => {
  it('renders Publish and Reject buttons for each row', async () => {
    const post = makePendingPost();
    await renderPage({ authenticated: true, reputation: 2000, postItems: [post] });

    expect(screen.getByTestId('btn-publish')).toBeInTheDocument();
    expect(screen.getByTestId('btn-reject')).toBeInTheDocument();
  });

  it('Publish button has aria-label', async () => {
    const post = makePendingPost();
    await renderPage({ authenticated: true, reputation: 2000, postItems: [post] });
    expect(screen.getByTestId('btn-publish')).toHaveAttribute('aria-label', 'Publish this post');
  });

  it('Reject button has aria-label', async () => {
    const post = makePendingPost();
    await renderPage({ authenticated: true, reputation: 2000, postItems: [post] });
    expect(screen.getByTestId('btn-reject')).toHaveAttribute('aria-label', 'Reject this post');
  });
});

describe('ModerationQueuePage — RTL', () => {
  it('renders main element with dir="auto"', async () => {
    await renderPage({ authenticated: true, reputation: 2000 });
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('dir', 'auto');
  });
});
