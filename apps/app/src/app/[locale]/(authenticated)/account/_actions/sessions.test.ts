/**
 * Unit tests for sessions Server Actions.
 * All external deps are mocked — no real DB or Next.js context.
 *
 * Covers:
 *  - list current user's sessions
 *  - revoke a specific session by id
 *  - revoke all sessions other than current
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ────────────────────────────────────────────────────
const { mockDbSelect, mockDbDelete, mockRevokeSession, mockRevokeOtherSessions } = vi.hoisted(
  () => ({
    mockDbSelect: vi.fn(),
    mockDbDelete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    mockRevokeSession: vi.fn().mockResolvedValue(undefined),
    mockRevokeOtherSessions: vi.fn().mockResolvedValue(undefined),
  }),
);

// ── Mock @repo/database/client ────────────────────────────────────────────────
vi.mock('@repo/database/client', () => ({
  db: {
    select: mockDbSelect,
    delete: mockDbDelete,
  },
}));

// ── Mock @repo/database/schema ───────────────────────────────────────────────
vi.mock('@repo/database/schema', () => ({
  users: {},
  sessions: {
    id: 'id',
    userId: 'user_id',
    expiresAt: 'expires_at',
    userAgent: 'user_agent',
    ipHash: 'ip_hash',
    createdAt: 'created_at',
  },
}));

// ── Mock drizzle-orm ──────────────────────────────────────────────────────────
vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  gt: vi.fn((col: unknown, val: unknown) => ({ type: 'gt', col, val })),
}));

// ── Mock @repo/auth ───────────────────────────────────────────────────────────
vi.mock('@repo/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    id: 'user-123',
    email: 'test@example.com',
    handle: 'testuser',
    displayName: 'Test User',
    locale: 'en',
    reputation: 0,
  }),
  revokeSession: mockRevokeSession,
  revokeOtherSessions: mockRevokeOtherSessions,
}));

// ── Mock @repo/observability ──────────────────────────────────────────────────
vi.mock('@repo/observability', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Mock next/headers ─────────────────────────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'current-session-id' }),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue(new Map()),
}));

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
const { listSessionsAction, revokeSessionAction, revokeOtherSessionsAction } = await import(
  './sessions.ts'
);

// ── Tests ─────────────────────────────────────────────────────────────────────

const fakeSessions = [
  {
    id: 'current-session-id',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 86400 * 1000),
    userAgent: 'Mozilla/5.0 Firefox/138',
    ipHash: 'abc123',
    createdAt: new Date(Date.now() - 3 * 86400 * 1000),
  },
  {
    id: 'other-session-id',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 86400 * 1000),
    userAgent: 'Safari/iOS 17',
    ipHash: 'def456',
    createdAt: new Date(Date.now() - 11 * 86400 * 1000),
  },
];

describe('listSessionsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(fakeSessions),
        }),
      }),
    });
  });

  it('returns sessions list with current session flagged', async () => {
    const result = await listSessionsAction();
    expect(result.sessions).toHaveLength(2);
    const current = result.sessions.find((s) => s.isCurrent);
    expect(current).toBeDefined();
    expect(current?.id).toBe('current-session-id');
  });

  it('marks other sessions as not current', async () => {
    const result = await listSessionsAction();
    const other = result.sessions.find((s) => s.id === 'other-session-id');
    expect(other?.isCurrent).toBe(false);
  });
});

describe('revokeSessionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls revokeSession with the session id and user id guard', async () => {
    const fd = new FormData();
    fd.set('sessionId', 'other-session-id');
    await revokeSessionAction({ ok: false, errors: {} }, fd);
    expect(mockRevokeSession).toHaveBeenCalledWith('other-session-id', 'user-123');
  });

  it('returns error when sessionId is missing', async () => {
    const fd = new FormData();
    const result = await revokeSessionAction({ ok: false, errors: {} }, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.form).toBeTruthy();
  });
});

describe('revokeOtherSessionsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls revokeOtherSessions with userId and current session id', async () => {
    await revokeOtherSessionsAction();
    expect(mockRevokeOtherSessions).toHaveBeenCalledWith('user-123', 'current-session-id');
  });
});
