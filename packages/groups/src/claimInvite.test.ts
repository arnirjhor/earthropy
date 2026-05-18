/**
 * Tests for claimInvite.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { hashToken, issueToken } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers, groups, tokens, users } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { claimInvite } from './claimInvite.ts';
import { createGroup } from './createGroup.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let ownerUserId = '';
let inviteeUserId = '';

async function insertTestUser(): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: `claim-test-${suffix}@example.com`,
    handle: `clmtst-${suffix}`,
    displayName: `Claim Test ${suffix}`,
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

async function cleanupTokensForUser(userId: string): Promise<void> {
  await db.delete(tokens).where(eq(tokens.userId, userId));
}

beforeEach(async () => {
  ownerUserId = await insertTestUser();
  inviteeUserId = await insertTestUser();
});

afterEach(async () => {
  if (ownerUserId) {
    await cleanupTokensForUser(ownerUserId);
    await cleanupUser(ownerUserId);
  }
  if (inviteeUserId) {
    await cleanupTokensForUser(inviteeUserId);
    await cleanupUser(inviteeUserId);
  }
  ownerUserId = '';
  inviteeUserId = '';
});

describe('claimInvite — happy path', () => {
  it('consumes token and inserts group_members row with correct role', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Claim Invite Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Claim invite test group',
        primarySdgId: 1,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      // Issue a group_invite token for inviteeUserId with payload = groupId:member
      const payload = `${groupId}:member`;
      const { rawToken } = await issueToken(inviteeUserId, 'group_invite', payload, 7 * 24 * 3600);

      const result = await claimInvite(rawToken, inviteeUserId);
      expect(result.groupId).toBe(groupId);
      expect(result.role).toBe('member');

      // Verify group_members row was inserted
      const memberRows = await db
        .select()
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, inviteeUserId)));
      expect(memberRows.length).toBe(1);
      expect(memberRows[0]?.role).toBe('member');

      // Verify token was consumed (deleted)
      const hashed = hashToken(rawToken);
      const tokenRows = await db.select().from(tokens).where(eq(tokens.id, hashed));
      expect(tokenRows.length).toBe(0);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('inserts with moderator role when payload specifies moderator', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Claim Mod Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Mod invite claim test',
        primarySdgId: 2,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      const payload = `${groupId}:moderator`;
      const { rawToken } = await issueToken(inviteeUserId, 'group_invite', payload, 7 * 24 * 3600);

      const result = await claimInvite(rawToken, inviteeUserId);
      expect(result.role).toBe('moderator');

      const memberRows = await db
        .select()
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, inviteeUserId)));
      expect(memberRows[0]?.role).toBe('moderator');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});

describe('claimInvite — invalid / expired tokens', () => {
  it('throws for an invalid token', async () => {
    await expect(claimInvite('invalid-raw-token', inviteeUserId)).rejects.toThrow(
      /invalid or expired/i,
    );
  });

  it('throws when userId does not match the token owner', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Wrong User Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Wrong user test',
        primarySdgId: 3,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      // Token issued for inviteeUserId
      const payload = `${groupId}:member`;
      const { rawToken } = await issueToken(inviteeUserId, 'group_invite', payload, 7 * 24 * 3600);

      // But claimed by ownerUserId (different user)
      await expect(claimInvite(rawToken, ownerUserId)).rejects.toThrow(/invalid or expired/i);
    } finally {
      if (groupId) await cleanupGroup(groupId);
      // Clean up the remaining token
      await cleanupTokensForUser(inviteeUserId);
    }
  });

  it('throws on double-claim (token already consumed)', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Double Claim Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Double claim test',
        primarySdgId: 4,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      const payload = `${groupId}:member`;
      const { rawToken } = await issueToken(inviteeUserId, 'group_invite', payload, 7 * 24 * 3600);

      // First claim succeeds
      await claimInvite(rawToken, inviteeUserId);

      // Second claim fails
      await expect(claimInvite(rawToken, inviteeUserId)).rejects.toThrow(/invalid or expired/i);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});
