import { db } from '@repo/database/client';
import { sessions } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
/**
 * Tests for session primitives (auth.md §3, §11.1).
 * Each test wraps DB mutations in a rolling-back transaction.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createSession,
  getSession,
  revokeAllForUser,
  revokeOtherSessions,
  revokeSession,
  rotateSession,
  sessionCookie,
} from './sessions.ts';

// Ensure env is set for tests
beforeAll(() => {
  process.env.AUTH_SECRET ??= 'test-auth-secret-for-vitest-only';
  process.env.IP_HASH_SECRET ??= 'test-ip-hash-secret-for-vitest-only';
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

describe('createSession', () => {
  it('writes a row with expected userAgent, ipHash, and expiresAt', async () => {
    let sessionId = '';
    let userId = '';
    try {
      // Insert user directly (not inside rollback tx, since createSession uses its own db connection)
      const { users: usersTable } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(usersTable).values({
        id: userId,
        email: `create-sess-${userId.slice(0, 8)}@example.com`,
        handle: `create-sess-${userId.slice(0, 8)}`,
        displayName: 'Create Session User',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });

      const { id, expiresAt } = await createSession(userId, {
        userAgent: 'Mozilla/5.0 TestAgent',
        ip: '1.2.3.4',
      });
      sessionId = id;

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      const row = rows[0];
      expect(row).toBeDefined();
      expect(row?.userId).toBe(userId);
      expect(row?.userAgent).toBe('Mozilla/5.0 TestAgent');
      expect(row?.ipHash).toBeTruthy();
      expect(row?.ipHash).not.toBe('1.2.3.4'); // never stores raw IP
      expect(row?.expiresAt.getTime()).toBeCloseTo(expiresAt.getTime(), -2);
    } finally {
      if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (userId) {
        const { users: usersTable } = await import('@repo/database/schema');
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    }
  });

  it('truncates userAgent to 255 chars', async () => {
    const longUa = 'A'.repeat(300);
    let sessionId = '';
    let userId = '';
    try {
      userId = crypto.randomUUID();
      const { users } = await import('@repo/database/schema');
      await db.insert(users).values({
        id: userId,
        email: `trunc-ua-${userId.slice(0, 8)}@example.com`,
        handle: `ua-trunc-${userId.slice(0, 8)}`,
        displayName: 'UA Truncate Test',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });
      const { id } = await createSession(userId, { userAgent: longUa });
      sessionId = id;
      const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId));
      expect(rows[0]?.userAgent?.length).toBe(255);
    } finally {
      if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (userId) {
        const { users } = await import('@repo/database/schema');
        await db.delete(users).where(eq(users.id, userId));
      }
    }
  });
});

describe('getSession', () => {
  it('returns SessionUser for a live session', async () => {
    let userId = '';
    let sessionId = '';
    try {
      const { users } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `get-session-${userId.slice(0, 8)}@example.com`,
        handle: `get-sess-${userId.slice(0, 8)}`,
        displayName: 'Get Session User',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });
      const { id } = await createSession(userId);
      sessionId = id;
      const user = await getSession(sessionId);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(userId);
      expect(user?.email).toContain('@example.com');
    } finally {
      if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (userId) {
        const { users } = await import('@repo/database/schema');
        await db.delete(users).where(eq(users.id, userId));
      }
    }
  });

  it('returns null for a non-existent id', async () => {
    const result = await getSession('nonexistent-session-id-xyz');
    expect(result).toBeNull();
  });

  it('returns null for an expired session (expires_at in the past)', async () => {
    let sessionId = '';
    let userId = '';
    try {
      const { users } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `expired-sess-${userId.slice(0, 8)}@example.com`,
        handle: `exp-sess-${userId.slice(0, 8)}`,
        displayName: 'Expired Session User',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });
      sessionId = randomBase64url();
      const pastDate = new Date(Date.now() - 1000);
      await db.insert(sessions).values({
        id: sessionId,
        userId,
        expiresAt: pastDate,
      });
      const result = await getSession(sessionId);
      expect(result).toBeNull();
    } finally {
      if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (userId) {
        const { users } = await import('@repo/database/schema');
        await db.delete(users).where(eq(users.id, userId));
      }
    }
  });

  it('returns null for a disabled user', async () => {
    let sessionId = '';
    let userId = '';
    try {
      const { users } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `disabled-${userId.slice(0, 8)}@example.com`,
        handle: `disabled-${userId.slice(0, 8)}`,
        displayName: 'Disabled User',
        locale: 'en',
        emailVerifiedAt: new Date(),
        disabledAt: new Date(),
      });
      const { id } = await createSession(userId);
      sessionId = id;
      const result = await getSession(sessionId);
      expect(result).toBeNull();
    } finally {
      if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (userId) {
        const { users } = await import('@repo/database/schema');
        await db.delete(users).where(eq(users.id, userId));
      }
    }
  });
});

describe('rotateSession', () => {
  it('returns new id, deletes old; old id invalid, new id returns SessionUser', async () => {
    let userId = '';
    let sessionId = '';
    let newSessionId = '';
    try {
      const { users } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `rotate-${userId.slice(0, 8)}@example.com`,
        handle: `rotate-${userId.slice(0, 8)}`,
        displayName: 'Rotate Session User',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });
      const { id: oldId } = await createSession(userId);
      sessionId = oldId;

      const { id: newId } = await rotateSession(oldId);
      newSessionId = newId;

      expect(newId).not.toBe(oldId);
      expect(await getSession(oldId)).toBeNull();
      const user = await getSession(newId);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(userId);
    } finally {
      if (newSessionId) await db.delete(sessions).where(eq(sessions.id, newSessionId));
      if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (userId) {
        const { users } = await import('@repo/database/schema');
        await db.delete(users).where(eq(users.id, userId));
      }
    }
  });

  it('throws when the old session does not exist', async () => {
    await expect(rotateSession('nonexistent-xyz')).rejects.toThrow(/session not found/);
  });
});

describe('revokeSession', () => {
  it('deletes a single row; getSession returns null afterwards', async () => {
    let userId = '';
    let sessionId = '';
    try {
      const { users } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `revoke1-${userId.slice(0, 8)}@example.com`,
        handle: `revoke1-${userId.slice(0, 8)}`,
        displayName: 'Revoke Test User',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });
      const { id } = await createSession(userId);
      sessionId = id;
      await revokeSession(sessionId);
      expect(await getSession(sessionId)).toBeNull();
      sessionId = ''; // already deleted
    } finally {
      if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (userId) {
        const { users } = await import('@repo/database/schema');
        await db.delete(users).where(eq(users.id, userId));
      }
    }
  });

  it('is idempotent — revoking twice does not throw', async () => {
    let userId = '';
    let sessionId = '';
    try {
      const { users } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `revoke2-${userId.slice(0, 8)}@example.com`,
        handle: `revoke2-${userId.slice(0, 8)}`,
        displayName: 'Revoke Idempotent',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });
      const { id } = await createSession(userId);
      sessionId = id;
      await revokeSession(sessionId);
      await revokeSession(sessionId); // no throw
    } finally {
      if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (userId) {
        const { users } = await import('@repo/database/schema');
        await db.delete(users).where(eq(users.id, userId));
      }
    }
  });
});

describe('revokeSession with userId guard', () => {
  it('only revokes when userId matches', async () => {
    let userId = '';
    let sessionId = '';
    try {
      const { users: usersTable } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(usersTable).values({
        id: userId,
        email: `revoke-guard-${userId.slice(0, 8)}@example.com`,
        handle: `revoke-grd-${userId.slice(0, 8)}`,
        displayName: 'Revoke Guard User',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });
      const { id } = await createSession(userId);
      sessionId = id;
      // Attempt revoke with wrong userId (valid UUID format but not this user) — session should remain
      await revokeSession(sessionId, crypto.randomUUID());
      expect(await getSession(sessionId)).not.toBeNull();
      // Revoke with correct userId — session gone
      await revokeSession(sessionId, userId);
      expect(await getSession(sessionId)).toBeNull();
      sessionId = '';
    } finally {
      if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (userId) {
        const { users: usersTable } = await import('@repo/database/schema');
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    }
  });
});

describe('revokeAllForUser', () => {
  it('deletes all sessions for a user', async () => {
    let userId = '';
    const createdIds: string[] = [];
    try {
      const { users } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `revokeall-${userId.slice(0, 8)}@example.com`,
        handle: `revokeall-${userId.slice(0, 8)}`,
        displayName: 'Revoke All User',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });
      for (let i = 0; i < 3; i++) {
        const { id } = await createSession(userId);
        createdIds.push(id);
      }
      await revokeAllForUser(userId);
      for (const id of createdIds) {
        expect(await getSession(id)).toBeNull();
      }
    } finally {
      for (const id of createdIds) await db.delete(sessions).where(eq(sessions.id, id));
      if (userId) {
        const { users } = await import('@repo/database/schema');
        await db.delete(users).where(eq(users.id, userId));
      }
    }
  });
});

describe('revokeOtherSessions', () => {
  it('keeps current session, deletes the others', async () => {
    let userId = '';
    const allIds: string[] = [];
    try {
      const { users: usersTable } = await import('@repo/database/schema');
      userId = crypto.randomUUID();
      await db.insert(usersTable).values({
        id: userId,
        email: `revoke-others-${userId.slice(0, 8)}@example.com`,
        handle: `rev-others-${userId.slice(0, 8)}`,
        displayName: 'Revoke Others User',
        locale: 'en',
        emailVerifiedAt: new Date(),
      });
      const { id: current } = await createSession(userId);
      const { id: other1 } = await createSession(userId);
      const { id: other2 } = await createSession(userId);
      allIds.push(current, other1, other2);

      await revokeOtherSessions(userId, current);
      expect(await getSession(current)).not.toBeNull();
      expect(await getSession(other1)).toBeNull();
      expect(await getSession(other2)).toBeNull();
    } finally {
      for (const id of allIds) await db.delete(sessions).where(eq(sessions.id, id));
      if (userId) {
        const { users: usersTable } = await import('@repo/database/schema');
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    }
  });
});

describe('sessionCookie', () => {
  it('returns expected attributes in development (Secure=false)', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalForce = process.env.FORCE_SECURE_COOKIES;
    process.env.NODE_ENV = 'development';
    process.env.FORCE_SECURE_COOKIES = undefined;

    const expiresAt = new Date(Date.now() + 3600 * 1000);
    const cookie = sessionCookie('test-id', expiresAt);

    expect(cookie.name).toBe('earthropy_session');
    expect(cookie.value).toBe('test-id');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(false);
    expect(cookie.sameSite).toBe('lax');
    expect(cookie.path).toBe('/');
    expect(cookie.maxAge).toBeGreaterThan(0);
    expect(cookie.maxAge).toBeLessThanOrEqual(3600);

    process.env.NODE_ENV = originalEnv;
    if (originalForce !== undefined) process.env.FORCE_SECURE_COOKIES = originalForce;
  });

  it('sets Secure=true in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const expiresAt = new Date(Date.now() + 3600 * 1000);
    const cookie = sessionCookie('test-id', expiresAt);

    expect(cookie.secure).toBe(true);
    process.env.NODE_ENV = originalEnv;
  });

  it('sets Secure=true when FORCE_SECURE_COOKIES=1', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    process.env.FORCE_SECURE_COOKIES = '1';

    const expiresAt = new Date(Date.now() + 3600 * 1000);
    const cookie = sessionCookie('test-id', expiresAt);

    expect(cookie.secure).toBe(true);
    process.env.NODE_ENV = originalEnv;
    process.env.FORCE_SECURE_COOKIES = undefined;
  });
});

// ── helper ────────────────────────────────────────────────────────────────────

function randomBase64url(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}
