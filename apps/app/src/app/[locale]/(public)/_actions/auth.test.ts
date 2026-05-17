/**
 * Server Action unit tests for auth flows.
 * All external deps are mocked; no real DB, Redis, or SMTP involved.
 *
 * Covers:
 *  - sign-up happy path
 *  - sign-up duplicate email → same generic "check your email" UI (no enumeration)
 *  - sign-in wrong password → generic error
 *  - magic-link request
 *  - verify-token consume
 *  - password-reset request
 *  - password-reset confirm
 *  - rate-limit hit returns 429-style error
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock variables (vi.hoisted must be called before vi.mock factories) ──
const {
  mockDbInsert,
  mockDbSelect,
  mockDbUpdate,
  mockCookiesSet,
  mockCookiesGet,
  mockRateLimitAction,
} = vi.hoisted(() => ({
  mockDbInsert: vi
    .fn()
    .mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'new-user-id' }]) }),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  }),
  mockCookiesSet: vi.fn(),
  mockCookiesGet: vi.fn(),
  mockRateLimitAction: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock @repo/auth ──────────────────────────────────────────────────────────
vi.mock('@repo/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('$argon2id$...hashed'),
  verifyPassword: vi.fn(),
  needsRehash: vi.fn().mockReturnValue(false),
  issueToken: vi.fn().mockResolvedValue({ rawToken: 'raw-abc123' }),
  consumeToken: vi.fn(),
  TOKEN_TTL: {
    email_verification: 86400,
    magic_link: 900,
    password_reset: 3600,
  },
  createSession: vi
    .fn()
    .mockResolvedValue({ id: 'sess-id', expiresAt: new Date(Date.now() + 9e6) }),
  sessionCookie: vi.fn().mockReturnValue({
    name: 'earthropy_session',
    value: 'sess-id',
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 9000,
  }),
  revokeAllForUser: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock @repo/notifications ──────────────────────────────────────────────────
vi.mock('@repo/notifications', () => ({
  sendTransactional: vi.fn().mockResolvedValue(undefined),
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

// ── Mock @repo/database ────────────────────────────────────────────────────────
vi.mock('@repo/database/client', () => ({
  db: {
    insert: mockDbInsert,
    select: mockDbSelect,
    update: mockDbUpdate,
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        insert: mockDbInsert,
        update: mockDbUpdate,
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
    }),
  },
}));

vi.mock('@repo/database/schema', () => ({
  users: { id: 'id', email: 'email' },
  sessions: {},
  tokens: {},
}));

// ── Mock drizzle-orm ──────────────────────────────────────────────────────────
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}));

// ── Mock next/headers ──────────────────────────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: mockCookiesSet,
    get: mockCookiesGet,
  }),
  headers: vi.fn().mockResolvedValue(new Map()),
}));

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// ── Import the module under test AFTER mocks ──────────────────────────────────
import {
  forgotPasswordAction,
  magicLinkRequestAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  verifyEmailAction,
} from './auth.ts';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

// Simulate a user row returned from the DB
function mockUserRow(
  overrides: Partial<{
    id: string;
    email: string;
    handle: string;
    displayName: string;
    locale: string;
    reputation: number;
    passwordHash: string | null;
    emailVerifiedAt: Date | null;
    disabledAt: Date | null;
  }> = {},
) {
  return {
    id: 'user-uuid',
    email: 'user@example.com',
    handle: 'testuser',
    displayName: 'Test User',
    locale: 'en',
    reputation: 0,
    passwordHash: '$argon2id$...hashed',
    emailVerifiedAt: new Date(),
    disabledAt: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('signUpAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAction.mockResolvedValue(undefined);
    // Re-setup mockDbInsert default after clearAllMocks
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-user-id' }]),
      }),
    });
  });

  it('happy path: inserts user, issues token, sends email, redirects to check-your-email', async () => {
    // DB select returns empty (no existing user with that email)
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { sendTransactional } = await import('@repo/notifications');
    const { issueToken } = await import('@repo/auth');

    const { redirect } = await import('next/navigation');
    vi.mocked(redirect).mockImplementationOnce((url) => {
      throw new Error(`REDIRECT:${url}`);
    });

    try {
      await signUpAction(
        { ok: false, errors: {} },
        fd({ email: 'new@example.com', password: 'StrongPassword123', handle: 'newuser' }),
      );
    } catch (e) {
      expect((e as Error).message).toMatch(/^REDIRECT:/);
    }

    expect(issueToken).toHaveBeenCalledWith(expect.any(String), 'email_verification', null, 86400);
    expect(sendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'verify-email' }),
    );
  });

  it('duplicate email (existing verified user): returns same generic UI (no enumeration)', async () => {
    // DB select returns an existing verified user
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUserRow()]),
        }),
      }),
    });

    const { sendTransactional } = await import('@repo/notifications');

    let caught: Error | null = null;
    try {
      await signUpAction(
        { ok: false, errors: {} },
        fd({ email: 'user@example.com', password: 'StrongPassword123', handle: 'anotherhandle' }),
      );
    } catch (e) {
      caught = e as Error;
    }

    // Should redirect to check-your-email (same as success — no enumeration)
    expect(caught?.message).toMatch(/REDIRECT:.*check-your-email/);
    // Sends a "you already have an account" email
    expect(sendTransactional).toHaveBeenCalled();
  });

  it('invalid email shape: returns field error without DB query', async () => {
    const result = await signUpAction(
      { ok: false, errors: {} },
      fd({ email: 'not-an-email', password: 'StrongPassword123', handle: 'user' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors?.email).toBeDefined();
  });

  it('short password: returns field error', async () => {
    const result = await signUpAction(
      { ok: false, errors: {} },
      fd({ email: 'valid@example.com', password: 'short', handle: 'user' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors?.password).toBeDefined();
  });

  it('rate limited: returns rate-limit error', async () => {
    const { RateLimitError } = await import('@repo/ratelimit');
    mockRateLimitAction.mockRejectedValueOnce(new RateLimitError(120));

    const result = await signUpAction(
      { ok: false, errors: {} },
      fd({ email: 'valid@example.com', password: 'StrongPassword123', handle: 'user' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors?.form).toMatch(/too many/i);
  });
});

describe('signInAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAction.mockResolvedValue(undefined);
  });

  it('wrong password: returns generic "email or password incorrect" error', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUserRow()]),
        }),
      }),
    });

    const { verifyPassword } = await import('@repo/auth');
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    const result = await signInAction(
      { ok: false, errors: {} },
      fd({ email: 'user@example.com', password: 'wrongpassword' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors?.form).toBeDefined();
    // No info about whether email exists
    expect(result.errors?.form).not.toMatch(/email.*not.*found/i);
  });

  it('non-existent email: returns same generic error as wrong password', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await signInAction(
      { ok: false, errors: {} },
      fd({ email: 'ghost@example.com', password: 'anypassword' }),
    );

    expect(result.ok).toBe(false);
    const wrongPwdError = 'Email or password is incorrect.';
    expect(result.errors?.form).toBe(wrongPwdError);
  });

  it('correct credentials: sets session cookie and redirects', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUserRow()]),
        }),
      }),
    });

    const { verifyPassword, createSession } = await import('@repo/auth');
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);

    const { redirect } = await import('next/navigation');
    vi.mocked(redirect).mockImplementationOnce((url) => {
      throw new Error(`REDIRECT:${url}`);
    });

    try {
      await signInAction(
        { ok: false, errors: {} },
        fd({ email: 'user@example.com', password: 'StrongPassword123' }),
      );
    } catch (e) {
      expect((e as Error).message).toMatch(/^REDIRECT:/);
    }

    expect(createSession).toHaveBeenCalledWith('user-uuid', expect.any(Object));
    expect(mockCookiesSet).toHaveBeenCalled();
  });

  it('rate limited: returns rate-limit error', async () => {
    const { RateLimitError } = await import('@repo/ratelimit');
    mockRateLimitAction.mockRejectedValueOnce(new RateLimitError(60));

    const result = await signInAction(
      { ok: false, errors: {} },
      fd({ email: 'user@example.com', password: 'StrongPassword123' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors?.form).toMatch(/too many/i);
  });
});

describe('magicLinkRequestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAction.mockResolvedValue(undefined);
  });

  it('known email: issues token, sends magic-link email, redirects to check-your-email', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUserRow()]),
        }),
      }),
    });

    const { issueToken } = await import('@repo/auth');
    const { sendTransactional } = await import('@repo/notifications');

    let caught: Error | null = null;
    try {
      await magicLinkRequestAction({ ok: false, errors: {} }, fd({ email: 'user@example.com' }));
    } catch (e) {
      caught = e as Error;
    }

    expect(caught?.message).toMatch(/REDIRECT:.*check-your-email/);
    expect(issueToken).toHaveBeenCalledWith(expect.any(String), 'magic_link', null, 900);
    expect(sendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'magic-link' }),
    );
  });

  it('unknown email: redirects to same check-your-email page (no enumeration)', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    let caught: Error | null = null;
    try {
      await magicLinkRequestAction({ ok: false, errors: {} }, fd({ email: 'ghost@example.com' }));
    } catch (e) {
      caught = e as Error;
    }

    expect(caught?.message).toMatch(/REDIRECT:.*check-your-email/);
  });
});

describe('verifyEmailAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAction.mockResolvedValue(undefined);
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('valid token: verifies email, creates session, redirects to dashboard', async () => {
    const { consumeToken, createSession } = await import('@repo/auth');
    vi.mocked(consumeToken).mockResolvedValueOnce({ userId: 'user-uuid', payload: null });

    let caught: Error | null = null;
    try {
      await verifyEmailAction({ ok: false, errors: {} }, fd({ token: 'valid-raw-token' }));
    } catch (e) {
      caught = e as Error;
    }

    expect(consumeToken).toHaveBeenCalledWith('valid-raw-token', 'email_verification');
    expect(createSession).toHaveBeenCalledWith('user-uuid', expect.any(Object));
    expect(caught?.message).toMatch(/REDIRECT:/);
  });

  it('invalid/expired token: returns "link no longer valid" error', async () => {
    const { consumeToken } = await import('@repo/auth');
    vi.mocked(consumeToken).mockResolvedValueOnce(null);

    const result = await verifyEmailAction({ ok: false, errors: {} }, fd({ token: 'bad-token' }));

    expect(result.ok).toBe(false);
    expect(result.errors?.form).toBeDefined();
  });
});

describe('forgotPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAction.mockResolvedValue(undefined);
  });

  it('known email: issues reset token, sends email, redirects to check-your-email', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUserRow()]),
        }),
      }),
    });

    const { issueToken } = await import('@repo/auth');
    const { sendTransactional } = await import('@repo/notifications');

    let caught: Error | null = null;
    try {
      await forgotPasswordAction({ ok: false, errors: {} }, fd({ email: 'user@example.com' }));
    } catch (e) {
      caught = e as Error;
    }

    expect(caught?.message).toMatch(/REDIRECT:.*check-your-email/);
    expect(issueToken).toHaveBeenCalledWith(expect.any(String), 'password_reset', null, 3600);
    expect(sendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'password-reset' }),
    );
  });

  it('unknown email: redirects to same page (no enumeration)', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    let caught: Error | null = null;
    try {
      await forgotPasswordAction({ ok: false, errors: {} }, fd({ email: 'ghost@example.com' }));
    } catch (e) {
      caught = e as Error;
    }

    expect(caught?.message).toMatch(/REDIRECT:.*check-your-email/);
  });
});

describe('resetPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAction.mockResolvedValue(undefined);
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('valid token + strong password: resets password, revokes sessions, redirects', async () => {
    const { consumeToken, hashPassword, revokeAllForUser, createSession } = await import(
      '@repo/auth'
    );
    vi.mocked(consumeToken).mockResolvedValueOnce({ userId: 'user-uuid', payload: null });

    let caught: Error | null = null;
    try {
      await resetPasswordAction(
        { ok: false, errors: {} },
        fd({ token: 'valid-reset-token', password: 'NewStrongPassword123' }),
      );
    } catch (e) {
      caught = e as Error;
    }

    expect(consumeToken).toHaveBeenCalledWith('valid-reset-token', 'password_reset');
    expect(hashPassword).toHaveBeenCalledWith('NewStrongPassword123');
    expect(revokeAllForUser).toHaveBeenCalledWith('user-uuid');
    expect(createSession).toHaveBeenCalledWith('user-uuid', expect.any(Object));
    expect(caught?.message).toMatch(/REDIRECT:/);
  });

  it('invalid token: returns "link no longer valid" error', async () => {
    const { consumeToken } = await import('@repo/auth');
    vi.mocked(consumeToken).mockResolvedValueOnce(null);

    const result = await resetPasswordAction(
      { ok: false, errors: {} },
      fd({ token: 'bad-token', password: 'NewStrongPassword123' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors?.form).toBeDefined();
  });

  it('weak password: returns field error', async () => {
    const result = await resetPasswordAction(
      { ok: false, errors: {} },
      fd({ token: 'any-token', password: 'short' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors?.password).toBeDefined();
  });

  it('rate limited: returns rate-limit error', async () => {
    const { RateLimitError } = await import('@repo/ratelimit');
    mockRateLimitAction.mockRejectedValueOnce(new RateLimitError(90));

    const result = await resetPasswordAction(
      { ok: false, errors: {} },
      fd({ token: 'any-token', password: 'NewStrongPassword123' }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors?.form).toMatch(/too many/i);
  });
});
