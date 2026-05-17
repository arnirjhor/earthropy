/**
 * Tests for createGroup.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { db } from '@repo/database/client';
import { groupMembers, groupSdgs, groups, users } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGroup } from './createGroup.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

// Test user ids created per test, cleaned up in afterEach
let testUserId = '';

async function insertTestUser(): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: `grp-test-${suffix}@example.com`,
    handle: `grptst-${suffix}`,
    displayName: `Group Test ${suffix}`,
    locale: 'en',
    emailVerifiedAt: new Date(),
  });
  return id;
}

async function cleanupGroup(id: string): Promise<void> {
  // group_sdgs and group_members cascade on group delete
  await db.delete(groups).where(eq(groups.id, id));
}

async function cleanupUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

beforeEach(async () => {
  testUserId = await insertTestUser();
});

afterEach(async () => {
  if (testUserId) await cleanupUser(testUserId);
  testUserId = '';
});

describe('createGroup — happy path', () => {
  it('inserts the group row and returns the created group', async () => {
    let groupId = '';
    try {
      const result = await createGroup({
        name: 'Climate Warriors',
        description: 'Fighting climate change together',
        primarySdgId: 13,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      groupId = result.id;

      expect(result.id).toBeTruthy();
      expect(result.name).toBe('Climate Warriors');
      expect(result.slug).toMatch(/^climate-warriors/);
      expect(result.visibility).toBe('public');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('inserts a group_sdgs row with primary=true for the primarySdgId', async () => {
    let groupId = '';
    try {
      const result = await createGroup({
        name: 'Ocean Keepers',
        description: 'Protecting our oceans',
        primarySdgId: 14,
        additionalSdgIds: [15],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      groupId = result.id;

      const sdgRows = await db.select().from(groupSdgs).where(eq(groupSdgs.groupId, groupId));

      const primaryRow = sdgRows.find((r) => r.primary === true);
      const nonPrimaryRow = sdgRows.find((r) => r.sdgId === 15);

      expect(primaryRow).toBeDefined();
      expect(primaryRow?.sdgId).toBe(14);
      expect(nonPrimaryRow).toBeDefined();
      expect(nonPrimaryRow?.primary).toBe(false);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('inserts exactly one primary SDG row even with multiple additionalSdgIds', async () => {
    let groupId = '';
    try {
      const result = await createGroup({
        name: 'Multi SDG Group',
        description: 'Covering many SDGs',
        primarySdgId: 7,
        additionalSdgIds: [8, 9],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      groupId = result.id;

      const sdgRows = await db.select().from(groupSdgs).where(eq(groupSdgs.groupId, groupId));

      const primaryRows = sdgRows.filter((r) => r.primary === true);
      expect(primaryRows.length).toBe(1);
      expect(sdgRows.length).toBe(3); // 1 primary + 2 additional
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});

describe('createGroup — auto-membership', () => {
  it('inserts a group_members row for createdBy with role owner', async () => {
    let groupId = '';
    try {
      const result = await createGroup({
        name: 'Founders Club',
        description: 'Creator auto-joins as owner',
        primarySdgId: 1,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      groupId = result.id;

      const memberRows = await db
        .select()
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, testUserId)));

      expect(memberRows.length).toBe(1);
      expect(memberRows[0]?.role).toBe('owner');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});

describe('createGroup — SDG uniqueness invariant', () => {
  it('rejects when primarySdgId also appears in additionalSdgIds', async () => {
    await expect(
      createGroup({
        name: 'Duplicate SDG Group',
        description: 'Should fail',
        primarySdgId: 13,
        additionalSdgIds: [13], // duplicate
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      }),
    ).rejects.toThrow(/duplicate/i);
  });

  it('rejects when an invalid SDG id is passed', async () => {
    await expect(
      createGroup({
        name: 'Invalid SDG Group',
        description: 'Should fail',
        primarySdgId: 99 as never,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      }),
    ).rejects.toThrow(/invalid sdg/i);
  });
});

describe('createGroup — slug collision', () => {
  it('generates a collision-free slug when a group with the same name already exists', async () => {
    let groupId1 = '';
    let groupId2 = '';
    try {
      const g1 = await createGroup({
        name: 'Slug Collision Test',
        description: 'First group',
        primarySdgId: 2,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      groupId1 = g1.id;

      // Create a second user for the second group
      const user2 = await insertTestUser();
      try {
        const g2 = await createGroup({
          name: 'Slug Collision Test',
          description: 'Second group, same name',
          primarySdgId: 3,
          additionalSdgIds: [],
          visibility: 'public',
          preferredLocale: 'en',
          locationText: null,
          createdBy: user2,
        });
        groupId2 = g2.id;

        expect(g1.slug).not.toBe(g2.slug);
        expect(g2.slug).toMatch(/^slug-collision-test-\d+$/);
      } finally {
        // Clean up group2 BEFORE user2 (FK: groups.createdBy references users.id RESTRICT)
        if (groupId2) {
          await cleanupGroup(groupId2);
          groupId2 = ''; // prevent outer finally from re-running
        }
        await cleanupUser(user2);
      }
    } finally {
      if (groupId2) await cleanupGroup(groupId2);
      if (groupId1) await cleanupGroup(groupId1);
    }
  });
});
