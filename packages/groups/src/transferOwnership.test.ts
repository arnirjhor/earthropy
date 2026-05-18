/**
 * Tests for transferOwnership.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { db } from '@repo/database/client';
import { groupMembers, groups, users } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGroup } from './createGroup.ts';
import { transferOwnership } from './transferOwnership.ts';

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
    email: `transfer-test-${suffix}@example.com`,
    handle: `xfrtst-${suffix}`,
    displayName: `Transfer Test ${suffix}`,
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

describe('transferOwnership — happy path', () => {
  it('atomically sets new owner and demotes old owner to member', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Transfer Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Transfer ownership test',
        primarySdgId: 1,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      // Add memberUserId as a plain member first
      await db.insert(groupMembers).values({ groupId, userId: memberUserId, role: 'member' });

      await transferOwnership(groupId, memberUserId, ownerUserId);

      // New owner should be memberUserId
      const newOwnerRows = await db
        .select({ role: groupMembers.role })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberUserId)));
      expect(newOwnerRows[0]?.role).toBe('owner');

      // Old owner should be demoted to member
      const oldOwnerRows = await db
        .select({ role: groupMembers.role })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, ownerUserId)));
      expect(oldOwnerRows[0]?.role).toBe('member');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('can transfer to a non-member (adds them as owner)', async () => {
    let groupId = '';
    const outsiderId = await insertTestUser();
    try {
      const group = await createGroup({
        name: `Transfer Outsider ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Transfer to outsider test',
        primarySdgId: 2,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await transferOwnership(groupId, outsiderId, ownerUserId);

      const newOwnerRows = await db
        .select({ role: groupMembers.role })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, outsiderId)));
      expect(newOwnerRows[0]?.role).toBe('owner');

      const oldOwnerRows = await db
        .select({ role: groupMembers.role })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, ownerUserId)));
      expect(oldOwnerRows[0]?.role).toBe('member');
    } finally {
      if (groupId) await cleanupGroup(groupId);
      await cleanupUser(outsiderId);
    }
  });
});

describe('transferOwnership — authorization', () => {
  it('throws when actor is not the owner', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Unauthorized Transfer ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Unauthorized transfer test',
        primarySdgId: 3,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await db.insert(groupMembers).values({ groupId, userId: memberUserId, role: 'member' });

      const thirdUserId = await insertTestUser();
      try {
        // memberUserId is not the owner
        await expect(transferOwnership(groupId, thirdUserId, memberUserId)).rejects.toThrow(
          /not authorized/i,
        );
      } finally {
        await cleanupUser(thirdUserId);
      }
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('throws when trying to transfer to yourself', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Self Transfer ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Self transfer test',
        primarySdgId: 4,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await expect(transferOwnership(groupId, ownerUserId, ownerUserId)).rejects.toThrow(
        /cannot transfer to yourself/i,
      );
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});
