/**
 * Tests for /u/[handle]/reputation page.
 *
 * Covers:
 *  1. Empty state — user found, no events.
 *  2. With-events — list renders, delta signs shown correctly.
 *  3. Pagination — prev/next links render correctly.
 *  4. Tier badge — correct tier text for given reputation.
 *  5. notFound() when user does not exist.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@repo/database/client', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('@repo/database/schema', () => ({
  users: {
    id: 'id',
    handle: 'handle',
    displayName: 'display_name',
    reputation: 'reputation',
  },
  reputationEvents: {
    id: 'id',
    userId: 'user_id',
    kind: 'kind',
    delta: 'delta',
    reason: 'reason',
    sourceId: 'source_id',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  count: vi.fn().mockReturnValue('count_expr'),
  sql: vi.fn((strings: TemplateStringsArray) => ({ __sql: strings.join('') })),
  and: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
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

vi.mock('@repo/trust', () => ({
  tierOf: (rep: number) => {
    if (rep >= 500) return 'anchor';
    if (rep >= 100) return 'trusted';
    if (rep >= 10) return 'member';
    return 'newcomer';
  },
}));

import { notFound } from 'next/navigation';
import ReputationHistoryPage from './page.tsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TEST_USER = {
  id: 'user-uuid-1',
  handle: 'alice',
  displayName: 'Alice',
  reputation: 15,
};

function makeEvent(
  overrides: Partial<{
    id: string;
    kind: string;
    delta: number;
    reason: string | null;
    sourceId: string | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    kind: overrides.kind ?? 'post_accepted',
    delta: overrides.delta ?? 5,
    reason: overrides.reason ?? null,
    sourceId: overrides.sourceId ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
  };
}

/**
 * Sets up db.select mock for the page's queries in order:
 *  1. getUserByHandle: .from().where().limit(1) → user row
 *  2. getReputationEvents events: .from().where().orderBy().limit().offset() → event rows
 *  3. getReputationEvents count: .from().where() → [{total: N}]
 */
function setupDbMock(opts: {
  user?: typeof TEST_USER | null;
  events?: ReturnType<typeof makeEvent>[];
  total?: number;
}) {
  mockDbSelect.mockReset();

  const user = opts.user !== undefined ? opts.user : TEST_USER;
  const events = opts.events ?? [];
  const total = opts.total ?? events.length;

  // 1. getUserByHandle: select().from().where().limit()
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(user ? [user] : []),
      }),
    }),
  });

  // 2. events query: select().from().where().orderBy().limit().offset()
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(events),
          }),
        }),
      }),
    }),
  });

  // 3. count query: select().from().where()
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ total }]),
    }),
  });
}

async function renderPage(
  opts: {
    handle?: string;
    page?: string;
    user?: typeof TEST_USER | null;
    events?: ReturnType<typeof makeEvent>[];
    total?: number;
  } = {},
) {
  setupDbMock({ user: opts.user, events: opts.events, total: opts.total });
  try {
    const result = await ReputationHistoryPage({
      params: Promise.resolve({ locale: 'en', handle: opts.handle ?? 'alice' }),
      searchParams: Promise.resolve(opts.page ? { page: opts.page } : {}),
    });
    return render(result);
  } catch (err) {
    // notFound() throws NEXT_NOT_FOUND — swallow for test assertions
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') return null;
    throw err;
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ReputationHistoryPage — empty state', () => {
  it('renders empty state when no events', async () => {
    await renderPage({ events: [] });
    expect(screen.getByTestId('reputation-empty')).toBeInTheDocument();
  });

  it('does not render event list when empty', async () => {
    await renderPage({ events: [] });
    expect(screen.queryByTestId('reputation-list')).not.toBeInTheDocument();
  });

  it('renders user display name', async () => {
    await renderPage({ events: [] });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alice');
  });

  it('renders reputation count', async () => {
    await renderPage({ events: [] });
    expect(screen.getByTestId('reputation-count')).toHaveTextContent('15');
  });
});

describe('ReputationHistoryPage — with events', () => {
  it('renders event list when events exist', async () => {
    await renderPage({ events: [makeEvent(), makeEvent()] });
    expect(screen.getByTestId('reputation-list')).toBeInTheDocument();
  });

  it('shows positive delta with + prefix', async () => {
    await renderPage({ events: [makeEvent({ delta: 5 })] });
    expect(screen.getByLabelText('+5 reputation')).toBeInTheDocument();
  });

  it('shows negative delta without + prefix', async () => {
    await renderPage({ events: [makeEvent({ kind: 'post_rejected', delta: -3 })] });
    expect(screen.getByLabelText('-3 reputation')).toBeInTheDocument();
  });

  it('renders kind label for post_accepted', async () => {
    await renderPage({ events: [makeEvent({ kind: 'post_accepted' })] });
    expect(screen.getByText('Post accepted')).toBeInTheDocument();
  });

  it('renders kind label for comment_rejected', async () => {
    await renderPage({ events: [makeEvent({ kind: 'comment_rejected', delta: -1 })] });
    expect(screen.getByText('Comment rejected')).toBeInTheDocument();
  });
});

describe('ReputationHistoryPage — tier badge', () => {
  it('shows newcomer tier for reputation 0', async () => {
    setupDbMock({ user: { ...TEST_USER, reputation: 0 }, events: [] });
    const result = await ReputationHistoryPage({
      params: Promise.resolve({ locale: 'en', handle: 'alice' }),
      searchParams: Promise.resolve({}),
    });
    render(result);
    expect(screen.getByTestId('tier-badge')).toHaveTextContent('newcomer');
  });

  it('shows member tier for reputation 15', async () => {
    await renderPage({ events: [] });
    expect(screen.getByTestId('tier-badge')).toHaveTextContent('member');
  });

  it('shows trusted tier for reputation 100', async () => {
    setupDbMock({ user: { ...TEST_USER, reputation: 100 }, events: [] });
    const result = await ReputationHistoryPage({
      params: Promise.resolve({ locale: 'en', handle: 'alice' }),
      searchParams: Promise.resolve({}),
    });
    render(result);
    expect(screen.getByTestId('tier-badge')).toHaveTextContent('trusted');
  });

  it('shows anchor tier for reputation 500', async () => {
    setupDbMock({ user: { ...TEST_USER, reputation: 500 }, events: [] });
    const result = await ReputationHistoryPage({
      params: Promise.resolve({ locale: 'en', handle: 'alice' }),
      searchParams: Promise.resolve({}),
    });
    render(result);
    expect(screen.getByTestId('tier-badge')).toHaveTextContent('anchor');
  });
});

describe('ReputationHistoryPage — not found', () => {
  it('calls notFound() when user does not exist', async () => {
    await renderPage({ user: null });
    expect(notFound).toHaveBeenCalledOnce();
  });
});

describe('ReputationHistoryPage — pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders next link when there are more results', async () => {
    const events = Array.from({ length: 25 }, (_, i) => makeEvent({ id: `ev-${i}` }));
    await renderPage({ events, total: 30 });
    expect(screen.getByTestId('pagination-next')).toBeInTheDocument();
  });

  it('does not render prev link on page 1', async () => {
    await renderPage({ events: [makeEvent()], total: 1 });
    expect(screen.queryByTestId('pagination-prev')).not.toBeInTheDocument();
  });

  it('renders prev link on page 2', async () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEvent({ id: `ev-${i}` }));
    await renderPage({ events, total: 30, page: '2' });
    expect(screen.getByTestId('pagination-prev')).toBeInTheDocument();
  });

  it('prev link points to page 1 when on page 2', async () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEvent({ id: `ev-${i}` }));
    await renderPage({ events, total: 30, page: '2' });
    const prev = screen.getByTestId('pagination-prev');
    expect(prev).toHaveAttribute('href', expect.stringContaining('page=1'));
  });
});
