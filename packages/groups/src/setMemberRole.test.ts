/**
 * Tests for setMemberRole.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { db } from '@repo/database/client';
import { groupMembers, groups, users } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGroup } from './createGroup.ts';
import { setMemberRole } from './setMemberRole.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let ownerUserId = '';
let memberUserId = '';

async function insertTestUser(): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: `role-test-${suffix}@example.com`,
    handle: `roletst-${suffix}`,
    displayName: `Role Test ${suffix}`,
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

beforeEach(async () => {
  ownerUserId = await insertTestUser();
  memberUserId = await insertTestUser();
});

afterEach(async () => {
  if (ownerUserId) await cleanupUser(ownerUserId);
  if (memberUserId) await cleanupUser(memberUserId);
  ownerUserId = '';
  memberUserId = '';
});

describe('setMemberRole — owner can promote/demote', () => {
  it('owner can promote a member to moderator', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Role Promote Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Role test group',
        primarySdgId: 1,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      // Add memberUserId as plain member
      await db.insert(groupMembers).values({ groupId, userId: memberUserId, role: 'member' });

      await setMemberRole(groupId, memberUserId, 'moderator', ownerUserId);

      const rows = await db
        .select({ role: groupMembers.role })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberUserId)));
      expect(rows[0]?.role).toBe('moderator');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('owner can demote a moderator to member', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Role Demote Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Role demote test',
        primarySdgId: 2,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await db.insert(groupMembers).values({ groupId, userId: memberUserId, role: 'moderator' });

      await setMemberRole(groupId, memberUserId, 'member', ownerUserId);

      const rows = await db
        .select({ role: groupMembers.role })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberUserId)));
      expect(rows[0]?.role).toBe('member');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});

describe('setMemberRole — hierarchy enforcement', () => {
  it('throws when moderator tries to change another member role', async () => {
    let groupId = '';
    const thirdUserId = await insertTestUser();
    try {
      const group = await createGroup({
        name: `Mod Cannot Promote ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Mod permission test',
        primarySdgId: 3,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      // memberUserId is moderator, thirdUserId is member
      await db.insert(groupMembers).values({ groupId, userId: memberUserId, role: 'moderator' });
      await db.insert(groupMembers).values({ groupId, userId: thirdUserId, role: 'member' });

      // Moderator cannot promote another member
      await expect(setMemberRole(groupId, thirdUserId, 'moderator', memberUserId)).rejects.toThrow(
        /not authorized/i,
      );
    } finally {
      if (groupId) await cleanupGroup(groupId);
      await cleanupUser(thirdUserId);
    }
  });

  it('throws when a plain member tries to change roles', async () => {
    let groupId = '';
    const thirdUserId = await insertTestUser();
    try {
      const group = await createGroup({
        name: `Member Cannot Change ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Member permission test',
        primarySdgId: 4,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await db.insert(groupMembers).values({ groupId, userId: memberUserId, role: 'member' });
      await db.insert(groupMembers).values({ groupId, userId: thirdUserId, role: 'member' });

      await expect(setMemberRole(groupId, thirdUserId, 'moderator', memberUserId)).rejects.toThrow(
        /not authorized/i,
      );
    } finally {
      if (groupId) await cleanupGroup(groupId);
      await cleanupUser(thirdUserId);
    }
  });

  it('throws when owner tries to set a user role to owner via setMemberRole', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `No Direct Owner Set ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Direct owner set test',
        primarySdgId: 5,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await db.insert(groupMembers).values({ groupId, userId: memberUserId, role: 'member' });

      // Cannot set role to 'owner' directly — use transferOwnership.
      // The signature rejects 'owner' at compile time; this verifies the
      // runtime guard for defense in depth.
      await expect(
        // @ts-expect-error — runtime guard test; 'owner' rejected by type
        setMemberRole(groupId, memberUserId, 'owner', ownerUserId),
      ).rejects.toThrow(/use transferOwnership/i);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('throws when target user is not a member', async () => {
    let groupId = '';
    const nonMemberId = await insertTestUser();
    try {
      const group = await createGroup({
        name: `Non Member Target ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Non member target test',
        primarySdgId: 6,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await expect(setMemberRole(groupId, nonMemberId, 'member', ownerUserId)).rejects.toThrow(
        /not a member/i,
      );
    } finally {
      if (groupId) await cleanupGroup(groupId);
      await cleanupUser(nonMemberId);
    }
  });
});
