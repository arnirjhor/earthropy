/**
 * Tests for updateGroup.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { db } from '@repo/database/client';
import { groupMembers, groups, users } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGroup } from './createGroup.ts';
import { updateGroup } from './updateGroup.ts';

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
    email: `upd-test-${suffix}@example.com`,
    handle: `updtst-${suffix}`,
    displayName: `Update Test ${suffix}`,
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

describe('updateGroup — owner can update', () => {
  it('allows the owner to update name and description', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Owner Update Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Original description',
        primarySdgId: 5,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      const updated = await updateGroup(
        groupId,
        { description: 'Updated description', name: 'Updated Name' },
        { actorId: ownerUserId },
      );

      expect(updated.description).toBe('Updated description');
      expect(updated.name).toBe('Updated Name');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('allows a moderator to update the group', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Moderator Update Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'A group',
        primarySdgId: 6,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      // Manually insert memberUserId as moderator
      await db.insert(groupMembers).values({
        groupId,
        userId: memberUserId,
        role: 'moderator',
      });

      const updated = await updateGroup(
        groupId,
        { description: 'Moderator updated this' },
        { actorId: memberUserId },
      );

      expect(updated.description).toBe('Moderator updated this');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});

describe('updateGroup — member cannot update', () => {
  it('throws when a plain member tries to update', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Member Reject Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'A group',
        primarySdgId: 10,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      // memberUserId is a plain member
      await db.insert(groupMembers).values({
        groupId,
        userId: memberUserId,
        role: 'member',
      });

      await expect(
        updateGroup(groupId, { description: 'Hacked!' }, { actorId: memberUserId }),
      ).rejects.toThrow(/not authorized/i);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('throws when the actor is not a member at all', async () => {
    let groupId = '';
    const outsiderId = await insertTestUser();
    try {
      const group = await createGroup({
        name: `Outsider Reject Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'A group',
        primarySdgId: 11,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await expect(
        updateGroup(groupId, { description: 'Hacked!' }, { actorId: outsiderId }),
      ).rejects.toThrow(/not authorized/i);
    } finally {
      if (groupId) await cleanupGroup(groupId);
      await cleanupUser(outsiderId);
    }
  });
});

describe('updateGroup — closed (private) groups reject mutations', () => {
  it('throws when trying to update a private (soft-closed) group', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Closed Group Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'A private group',
        primarySdgId: 12,
        additionalSdgIds: [],
        visibility: 'private',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      await expect(
        updateGroup(groupId, { description: 'Should fail' }, { actorId: ownerUserId }),
      ).rejects.toThrow(/closed/i);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});

describe('updateGroup — visibility change (closeGroup)', () => {
  it('owner can set visibility to private (soft-close)', async () => {
    let groupId = '';
    try {
      const group = await createGroup({
        name: `Close Group Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Will be closed',
        primarySdgId: 16,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: ownerUserId,
      });
      groupId = group.id;

      const updated = await updateGroup(
        groupId,
        { visibility: 'private' },
        { actorId: ownerUserId },
      );

      expect(updated.visibility).toBe('private');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});
