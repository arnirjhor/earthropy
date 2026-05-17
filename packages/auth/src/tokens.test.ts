import { db } from '@repo/database/client';
import { tokens, users } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
/**
 * Tests for token primitives (auth.md §4, §11.1).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { TOKEN_TTL, consumeToken, hashToken, issueToken } from './tokens.ts';

beforeAll(() => {
  process.env.AUTH_SECRET ??= 'test-auth-secret-for-vitest-only';
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email: `token-test-${id.slice(0, 8)}@example.com`,
    handle: `token-tst-${id.slice(0, 8)}`,
    displayName: 'Token Test User',
    locale: 'en',
    emailVerifiedAt: new Date(),
  });
  return id;
}

async function cleanUser(userId: string): Promise<void> {
  await db.delete(tokens).where(eq(tokens.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

describe('issueToken', () => {
  it('returns a 43-char base64url rawToken', async () => {
    const userId = await makeUser();
    try {
      const { rawToken } = await issueToken(
        userId,
        'email_verification',
        null,
        TOKEN_TTL.email_verification,
      );
      expect(rawToken).toHaveLength(43);
      // base64url: only A-Z a-z 0-9 - _
      expect(rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
    } finally {
      await cleanUser(userId);
    }
  });

  it('stores the SHA-256 hash of rawToken as tokens.id (never stores raw)', async () => {
    const userId = await makeUser();
    try {
      const { rawToken } = await issueToken(
        userId,
        'email_verification',
        null,
        TOKEN_TTL.email_verification,
      );
      const expectedId = hashToken(rawToken);
      const rows = await db.select().from(tokens).where(eq(tokens.id, expectedId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(expectedId);
      expect(rows[0]?.id).not.toBe(rawToken); // hash != raw
    } finally {
      await cleanUser(userId);
    }
  });

  it('stores payload correctly', async () => {
    const userId = await makeUser();
    try {
      const { rawToken } = await issueToken(
        userId,
        'email_verification',
        'newemail@example.com',
        TOKEN_TTL.email_verification,
      );
      const hashed = hashToken(rawToken);
      const rows = await db.select().from(tokens).where(eq(tokens.id, hashed));
      expect(rows[0]?.payload).toBe('newemail@example.com');
    } finally {
      await cleanUser(userId);
    }
  });
});

describe('consumeToken', () => {
  it('happy path: returns { userId, payload } and deletes the row', async () => {
    const userId = await makeUser();
    try {
      const { rawToken } = await issueToken(
        userId,
        'email_verification',
        'test-payload',
        TOKEN_TTL.email_verification,
      );
      const result = await consumeToken(rawToken, 'email_verification');
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(userId);
      expect(result?.payload).toBe('test-payload');

      // Row should be gone
      const hashed = hashToken(rawToken);
      const rows = await db.select().from(tokens).where(eq(tokens.id, hashed));
      expect(rows).toHaveLength(0);
    } finally {
      await cleanUser(userId);
    }
  });

  it('consuming twice returns null on the second call (single-use)', async () => {
    const userId = await makeUser();
    try {
      const { rawToken } = await issueToken(userId, 'magic_link', null, TOKEN_TTL.magic_link);
      const first = await consumeToken(rawToken, 'magic_link');
      expect(first).not.toBeNull();
      const second = await consumeToken(rawToken, 'magic_link');
      expect(second).toBeNull();
    } finally {
      await cleanUser(userId);
    }
  });

  it('returns null for wrong purpose (row is left intact)', async () => {
    const userId = await makeUser();
    try {
      const { rawToken } = await issueToken(
        userId,
        'email_verification',
        null,
        TOKEN_TTL.email_verification,
      );
      const result = await consumeToken(rawToken, 'password_reset');
      expect(result).toBeNull();

      // Row must still be intact (wrong purpose does not consume)
      const hashed = hashToken(rawToken);
      const rows = await db.select().from(tokens).where(eq(tokens.id, hashed));
      expect(rows).toHaveLength(1);
    } finally {
      await cleanUser(userId);
    }
  });

  it('returns null for an expired token', async () => {
    const userId = await makeUser();
    try {
      // Issue with 1-second TTL — will be expired by the time we consume
      const { rawToken } = await issueToken(userId, 'password_reset', null, -1);
      const result = await consumeToken(rawToken, 'password_reset');
      expect(result).toBeNull();
    } finally {
      await cleanUser(userId);
    }
  });

  it('returns null for a never-issued (invalid) raw token', async () => {
    const result = await consumeToken(
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      'email_verification',
    );
    expect(result).toBeNull();
  });

  it('payload round-trips including null', async () => {
    const userId = await makeUser();
    try {
      const { rawToken } = await issueToken(
        userId,
        'email_verification',
        null,
        TOKEN_TTL.email_verification,
      );
      const result = await consumeToken(rawToken, 'email_verification');
      expect(result?.payload).toBeNull();
    } finally {
      await cleanUser(userId);
    }
  });
});
