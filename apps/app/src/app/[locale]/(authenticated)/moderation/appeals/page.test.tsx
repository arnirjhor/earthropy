/**
 * Tests for the moderation appeals queue page.
 *
 * Covers:
 * 1. Authority gate — unauthenticated user redirected to signin.
 * 2. Authority gate — non-moderator redirected to dashboard.
 * 3. Empty state — no pending appeals message.
 * 4. Lists pending appeals in authority scope.
 * 5. Platform anchor sees all appeals.
 * 6. Upheld and rejected buttons present for each row.
 * 7. RTL — dir="auto" on main.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ─────────────────────────────────────────────────────

const { mockGetSession, mockRedirect, mockDbSelect, mockResolveAppealAction } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRedirect: vi.fn().mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockDbSelect: vi.fn(),
  mockResolveAppealAction: vi.fn().mockResolvedValue({ ok: true }),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@repo/auth', () => ({
  getSession: mockGetSession,
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/moderation/appeals',
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
  },
}));

vi.mock('@repo/database/schema', () => ({
  posts: { id: 'id', groupId: 'group_id', authorId: 'author_id' },
  comments: { id: 'id', postId: 'post_id', authorId: 'author_id' },
  groups: { id: 'id', name: 'name' },
  users: { id: 'id', handle: 'handle' },
  groupMembers: { groupId: 'group_id', userId: 'user_id', role: 'role' },
  appeals: {
    id: 'id',
    targetType: 'target_type',
    targetId: 'target_id',
    userId: 'user_id',
    message: 'message',
    resolution: 'resolution',
    resolvedAt: 'resolved_at',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  desc: vi.fn(),
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

vi.mock('../_appeal-actions.ts', () => ({
  resolveAppealAction: mockResolveAppealAction,
}));

// ── Import component after mocks ───────────────────────────────────────────────

import AppealsPage from './page.tsx';

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

interface AppealRow {
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

function makeJoinChain(finalRows: unknown[]) {
  const orderByFn = vi.fn().mockResolvedValue(finalRows);
  const limitFn = vi.fn().mockResolvedValue(finalRows);
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  chain.from = handler;
  chain.innerJoin = handler;
  chain.leftJoin = handler;
  chain.where = handler;
  chain.groupBy = handler;
  chain.limit = limitFn;
  chain.orderBy = orderByFn;
  return { from: handler };
}

function setupDbMock(opts: {
  reputation?: number;
  memberRows?: { groupId: string; role: string }[];
  appealRows?: AppealRow[];
}) {
  mockDbSelect.mockReset();

  const isAnchor = (opts.reputation ?? 0) >= 2000;

  if (!isAnchor) {
    const memberRows = opts.memberRows ?? [];
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(memberRows),
      }),
    });
  }

  // The page makes two appeals queries: one for post targets, one for comment targets.
  // Post appeals query (innerJoin posts → groups → users)
  const postAppealRows = (opts.appealRows ?? [])
    .filter((a) => a.targetType === 'post')
    .map((a) => ({
      id: a.id,
      targetType: a.targetType,
      targetId: a.targetId,
      userId: a.userId,
      authorHandle: a.authorHandle,
      message: a.message,
      createdAt: a.createdAt,
      groupId: a.groupId,
      groupName: a.groupName,
    }));
  mockDbSelect.mockReturnValueOnce(makeJoinChain(postAppealRows));

  // Comment appeals query (innerJoin comments → posts → groups → users)
  const commentAppealRows = (opts.appealRows ?? [])
    .filter((a) => a.targetType === 'comment')
    .map((a) => ({
      id: a.id,
      targetType: a.targetType,
      targetId: a.targetId,
      userId: a.userId,
      authorHandle: a.authorHandle,
      message: a.message,
      createdAt: a.createdAt,
      groupId: a.groupId,
      groupName: a.groupName,
    }));
  mockDbSelect.mockReturnValueOnce(makeJoinChain(commentAppealRows));
}

async function renderPage(opts: {
  authenticated?: boolean;
  reputation?: number;
  memberRows?: { groupId: string; role: string }[];
  appealRows?: AppealRow[];
}) {
  const { authenticated = true, reputation = 0, memberRows = [], appealRows = [] } = opts;

  if (authenticated) {
    mockGetSession.mockResolvedValue(makeViewer({ reputation }));
  } else {
    mockGetSession.mockResolvedValue(null);
  }

  setupDbMock({ reputation, memberRows, appealRows });

  const params = Promise.resolve({ locale: 'en' });
  return render(await AppealsPage({ params }));
}

function makeAppealRow(override: Partial<AppealRow> = {}): AppealRow {
  return {
    id: 'appeal-uuid',
    targetType: 'post',
    targetId: 'post-uuid',
    userId: 'author-uuid',
    authorHandle: 'alice',
    message: 'This was unfair.',
    createdAt: new Date('2026-05-01T10:00:00Z'),
    groupId: GROUP_ID,
    groupName: 'Climate Group',
    ...override,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AppealsPage — auth gating', () => {
  it('redirects unauthenticated user to signin', async () => {
    await expect(renderPage({ authenticated: false })).rejects.toThrow('REDIRECT:/en/signin');
  });

  it('redirects user with no moderation groups to dashboard', async () => {
    await expect(
      renderPage({ authenticated: true, reputation: 0, memberRows: [] }),
    ).rejects.toThrow('REDIRECT:/en/dashboard');
  });

  it('does not redirect platform anchor (rep >= 2000)', async () => {
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

describe('AppealsPage — empty state', () => {
  it('renders empty state when no pending appeals', async () => {
    await renderPage({ authenticated: true, reputation: 2000 });
    expect(screen.getByTestId('appeals-empty-state')).toBeInTheDocument();
  });
});

describe('AppealsPage — lists pending appeals', () => {
  it('renders an appeal row', async () => {
    const appeal = makeAppealRow({ authorHandle: 'alice', groupName: 'Climate Group' });
    await renderPage({
      authenticated: true,
      reputation: 2000,
      appealRows: [appeal],
    });

    expect(screen.getByTestId('appeal-item')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('Climate Group')).toBeInTheDocument();
    expect(screen.getByText('This was unfair.')).toBeInTheDocument();
  });

  it('shows the appeal message', async () => {
    const appeal = makeAppealRow({ message: 'My content was correct.' });
    await renderPage({ authenticated: true, reputation: 2000, appealRows: [appeal] });
    expect(screen.getByText('My content was correct.')).toBeInTheDocument();
  });

  it('renders multiple appeals', async () => {
    const appeals = [
      makeAppealRow({ id: 'a1', authorHandle: 'alice' }),
      makeAppealRow({ id: 'a2', authorHandle: 'bob', targetId: 'post-uuid-2' }),
    ];
    await renderPage({ authenticated: true, reputation: 2000, appealRows: appeals });
    expect(screen.getAllByTestId('appeal-item').length).toBe(2);
  });
});

describe('AppealsPage — action buttons', () => {
  it('renders Uphold and Reject buttons for each appeal', async () => {
    const appeal = makeAppealRow();
    await renderPage({ authenticated: true, reputation: 2000, appealRows: [appeal] });

    expect(screen.getByTestId('btn-uphold')).toBeInTheDocument();
    expect(screen.getByTestId('btn-reject-appeal')).toBeInTheDocument();
  });
});

describe('AppealsPage — RTL', () => {
  it('renders main element with dir="auto"', async () => {
    await renderPage({ authenticated: true, reputation: 2000 });
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('dir', 'auto');
  });
});
