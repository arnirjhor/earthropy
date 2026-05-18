/**
 * Tests for inviteToGroup.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { db } from '@repo/database/client';
import { groupMembers, groups, tokens, users } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGroup } from './createGroup.ts';
import { inviteToGroup } from './inviteToGroup.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let ownerUserId = '';
let inviteeUserId = '';

async function insertTestUser(email?: string, handle?: string): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: email ?? `invite-test-${suffix}@example.com`,
    handle: handle ?? `invtst-${suffix}`,
    displayName: `Invite Test ${suffix}`,
    locale: 'en',
    emailVerifiedAt: new Date(),
  });
  return id;
}

async function cleanupGroup(id: string): Promise<void> {
  await db.delete(groups).where(eq(groups.id, id));
}

async function cleanupUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

async function cleanupTokens(userId: string): Promise<void> {
  await db.delete(tokens).where(eq(tokens.userId, userId));
}

beforeEach(async () => {
  ownerUserId = await insertTestUser();
  inviteeUserId = await insertTestUser();
});

afterEach(async () => {
  if (ownerUserId) {
    await cleanupTokens(ownerUserId);
    await cleanupUser(ownerUserId);
  }
  if (inviteeUserId) {
    await cleanupTokens(inviteeUserId);
    await cleanupUser(inviteeUserId);
  }
  ownerUserId = '';
  inviteeUserId = '';
});

describe('inviteToGroup — happy path', () => {
  it('issues a token with purpose=group_invite when inviting an existing user by email', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Invite Test Group ${crypto.randomUUID().slice(0, 6)}`,
        description: 'A group for invite tests',
        primarySdgId: 1,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      // Mock sendTransactional to avoid real SMTP during tests
      vi.mock('@repo/notifications', () => ({
        sendTransactional: vi.fn().mockResolvedValue(undefined),
      }));

      const inviteeEmailRow = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, inviteeUserId));
      const inviteeEmail = inviteeEmailRow[0]?.email ?? '';

      const result = await inviteToGroup({
        groupId,
        inviterId: ownerUserId,
        email: inviteeEmail,
        role: 'member',
      });

      expect(result.rawToken).toBeTruthy();
      expect(result.rawToken.length).toBeGreaterThan(10);

      // Check token was stored in DB
      const tokenRows = await db
        .select()
        .from(tokens)
        .where(and(eq(tokens.userId, inviteeUserId), eq(tokens.purpose, 'group_invite')));
      expect(tokenRows.length).toBeGreaterThan(0);
      const tokenRow = tokenRows[0];
      expect(tokenRow?.purpose).toBe('group_invite');
      expect(tokenRow?.payload).toContain(groupId);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('returns rawToken when invitee is a moderator-role invite', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Mod Invite Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Mod invite test',
        primarySdgId: 2,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      vi.mock('@repo/notifications', () => ({
        sendTransactional: vi.fn().mockResolvedValue(undefined),
      }));

      const inviteeEmailRow2 = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, inviteeUserId));
      const inviteeEmail2 = inviteeEmailRow2[0]?.email ?? '';

      const result = await inviteToGroup({
        groupId,
        inviterId: ownerUserId,
        email: inviteeEmail2,
        role: 'moderator',
      });

      expect(result.rawToken).toBeTruthy();
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});

describe('inviteToGroup — authorization', () => {
  it('throws when actor is not a member of the group', async () => {
    let groupId = '';
    const outsiderId = await insertTestUser();
    try {
      const group = await createGroup({
        name: `Auth Invite Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Auth invite test',
        primarySdgId: 3,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      const outsiderInviteeRow = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, inviteeUserId));
      const outsiderInviteeEmail = outsiderInviteeRow[0]?.email ?? '';

      await expect(
        inviteToGroup({
          groupId,
          inviterId: outsiderId,
          email: outsiderInviteeEmail,
          role: 'member',
        }),
      ).rejects.toThrow(/not authorized/i);
    } finally {
      if (groupId) await cleanupGroup(groupId);
      await cleanupUser(outsiderId);
    }
  });

  it('throws when plain member tries to invite', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Member Invite Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Member invite test',
        primarySdgId: 4,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      // Add inviteeUserId as plain member
      await db.insert(groupMembers).values({
        groupId,
        userId: inviteeUserId,
        role: 'member',
      });

      const thirdUserId = await insertTestUser();
      const thirdUserEmailRow = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, thirdUserId));
      const thirdUserEmail = thirdUserEmailRow[0]?.email ?? '';

      try {
        await expect(
          inviteToGroup({
            groupId,
            inviterId: inviteeUserId,
            email: thirdUserEmail,
            role: 'member',
          }),
        ).rejects.toThrow(/not authorized/i);
      } finally {
        await cleanupUser(thirdUserId);
      }
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});

describe('inviteToGroup — user not found', () => {
  it('throws when email does not match any user', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Unknown Email Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Unknown email test',
        primarySdgId: 5,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await expect(
        inviteToGroup({
          groupId,
          inviterId: ownerUserId,
          email: 'nobody@example.invalid',
          role: 'member',
        }),
      ).rejects.toThrow(/user not found/i);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});
