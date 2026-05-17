/**
 * Unit tests for account management Server Actions.
 * All external deps are mocked — no real DB or Next.js context.
 *
 * Covers:
 *  - request account-deletion sets users.disabled_at
 *  - user is signed out (cookie cleared, revokeAllForUser called)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables ────────────────────────────────────────────────────
const { mockDbUpdate, mockRevokeAllForUser, mockCookiesDelete } = vi.hoisted(() => ({
  mockDbUpdate: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  }),
  mockRevokeAllForUser: vi.fn().mockResolvedValue(undefined),
  mockCookiesDelete: vi.fn(),
}));

// ── Mock @repo/database/client ────────────────────────────────────────────────
vi.mock('@repo/database/client', () => ({
  db: {
    update: mockDbUpdate,
  },
}));

// ── Mock @repo/database/schema ───────────────────────────────────────────────
vi.mock('@repo/database/schema', () => ({
  users: { id: 'id', disabledAt: 'disabled_at', updatedAt: 'updated_at' },
  sessions: {},
}));

// ── Mock drizzle-orm ──────────────────────────────────────────────────────────
vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
}));

// ── Mock @repo/auth ───────────────────────────────────────────────────────────
vi.mock('@repo/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    id: 'user-123',
    email: 'user@example.com',
    handle: 'testuser',
    displayName: 'Test User',
    locale: 'en',
    reputation: 0,
  }),
  revokeAllForUser: mockRevokeAllForUser,
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
    delete: mockCookiesDelete,
  }),
  headers: vi.fn().mockResolvedValue(new Map()),
}));

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
const { deleteAccountAction } = await import('./account.ts');

// ── Tests ─────────────────────────────────────────────────────────────────────

const initialState = { ok: false, errors: {} };

describe('deleteAccountAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    mockRevokeAllForUser.mockResolvedValue(undefined);
    mockCookiesDelete.mockReturnValue(undefined);
  });

  it('sets disabled_at on the user row', async () => {
    const fd = new FormData();
    fd.set('email', 'user@example.com');
    await deleteAccountAction(initialState, fd);
    expect(mockDbUpdate).toHaveBeenCalled();
    const setCall = mockDbUpdate.mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalled();
    const setArg = setCall.mock.calls[0][0];
    expect(setArg).toHaveProperty('disabledAt');
  });

  it('calls revokeAllForUser with the user id', async () => {
    const fd = new FormData();
    fd.set('email', 'user@example.com');
    await deleteAccountAction(initialState, fd);
    expect(mockRevokeAllForUser).toHaveBeenCalledWith('user-123');
  });

  it('clears the session cookie', async () => {
    const fd = new FormData();
    fd.set('email', 'user@example.com');
    await deleteAccountAction(initialState, fd);
    expect(mockCookiesDelete).toHaveBeenCalledWith('earthropy_session');
  });

  it('returns error when email confirmation does not match', async () => {
    const fd = new FormData();
    fd.set('email', 'wrong@example.com');
    const result = await deleteAccountAction(initialState, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.email).toBeTruthy();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('returns error when email field is empty', async () => {
    const fd = new FormData();
    fd.set('email', '');
    const result = await deleteAccountAction(initialState, fd);
    expect(result.ok).toBe(false);
    expect(result.errors.email).toBeTruthy();
  });
});
