/**
 * Unit tests for profile Server Actions.
 * All external deps are mocked — no real DB, Redis, or Next.js context.
 *
 * Covers:
 *  - update display name
 *  - change handle (succeed)
 *  - change handle again within 30 days (rate-limit reject)
 *  - change locale
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ────────────────────────────────────────────────────
const { mockDbSelect, mockDbUpdate, mockRateLimitAction } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  }),
  mockRateLimitAction: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock @repo/database/client ────────────────────────────────────────────────
vi.mock('@repo/database/client', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
}));

// ── Mock @repo/database/schema ───────────────────────────────────────────────
vi.mock('@repo/database/schema', () => ({
  users: {
    id: 'id',
    handle: 'handle',
    displayName: 'display_name',
    locale: 'locale',
    updatedAt: 'updated_at',
  },
  sessions: {},
}));

// ── Mock drizzle-orm ──────────────────────────────────────────────────────────
vi.mock('drizzle-orm', () => ({
  sql: vi.fn((parts: TemplateStringsArray, ...values: unknown[]) => ({
    type: 'sql',
    parts,
    values,
  })),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

// ── Mock @repo/ratelimit ──────────────────────────────────────────────────────
vi.mock('@repo/ratelimit', () => ({
  rateLimitAction: mockRateLimitAction,
  RateLimitError: class RateLimitError extends Error {
    retryAfterSec: number;
    constructor(retryAfterSec: number) {
      super(`Rate limit exceeded. Retry after ${retryAfterSec}s.`);
      this.name = 'RateLimitError';
      this.retryAfterSec = retryAfterSec;
    }
  },
}));

// ── Mock @repo/observability ──────────────────────────────────────────────────
vi.mock('@repo/observability', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Mock next/headers ─────────────────────────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-session-id' }),
  }),
  headers: vi.fn().mockResolvedValue(new Map()),
}));

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
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
}));

// ── Import after mocks ────────────────────────────────────────────────────────
const { updateDisplayNameAction, updateHandleAction, updateLocaleAction } = await import(
  './profile.ts'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const initialState = { ok: false, errors: {} };

describe('updateDisplayNameAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'user-123' }]) }),
      }),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('returns ok when display name is valid', async () => {
    const fd = makeFormData({ displayName: 'Alice New Name' });
    const result = await updateDisplayNameAction(initialState, fd);
    expect(result.ok).toBe(true);
  });

  it('returns field error when display name is empty', async () => {
    const fd = makeFormData({ displayName: '' });
    const result = await updateDisplayNameAction(initialState, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.displayName).toBeTruthy();
  });

  it('returns field error when display name exceeds 80 chars', async () => {
    const fd = makeFormData({ displayName: 'A'.repeat(81) });
    const result = await updateDisplayNameAction(initialState, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.displayName).toBeTruthy();
  });
});

describe('updateHandleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAction.mockResolvedValue(undefined);
    // By default no conflicting handle in DB
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('succeeds when handle is unique and rate limit not hit', async () => {
    const fd = makeFormData({ handle: 'newhandle' });
    const result = await updateHandleAction(initialState, fd);
    expect(result.ok).toBe(true);
  });

  it('returns field error for handle with invalid characters', async () => {
    const fd = makeFormData({ handle: 'invalid handle!' });
    const result = await updateHandleAction(initialState, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.handle).toBeTruthy();
  });

  it('returns field error for handle that is too short', async () => {
    const fd = makeFormData({ handle: 'ab' });
    const result = await updateHandleAction(initialState, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.handle).toBeTruthy();
  });

  it('returns field error when handle is already taken', async () => {
    // Another user has this handle
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'other-user' }]) }),
      }),
    });
    const fd = makeFormData({ handle: 'takenhandle' });
    const result = await updateHandleAction(initialState, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.handle).toMatch(/taken/i);
  });

  it('returns rate-limit error when handle changed within 30 days', async () => {
    const { RateLimitError: RLError } = await import('@repo/ratelimit');
    mockRateLimitAction.mockRejectedValue(new RLError(2592000));
    const fd = makeFormData({ handle: 'newhandle' });
    const result = await updateHandleAction(initialState, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.handle ?? result.errors.form).toBeTruthy();
  });
});

describe('updateLocaleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('updates locale in DB and calls redirect when locale is valid', async () => {
    const { redirect } = await import('next/navigation');
    const fd = makeFormData({ locale: 'fr' });
    // redirect() mock just returns undefined so the action completes without throwing
    await updateLocaleAction(initialState, fd);
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/fr/account');
  });

  it('returns field error for an unrecognised locale', async () => {
    const fd = makeFormData({ locale: 'xx' });
    const result = await updateLocaleAction(initialState, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.locale).toBeTruthy();
  });
});
