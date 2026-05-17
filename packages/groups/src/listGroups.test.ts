/**
 * Tests for listGroups.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { db } from '@repo/database/client';
import { groups, users } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGroup } from './createGroup.ts';
import { listGroups } from './listGroups.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let testUserId = '';

async function insertTestUser(): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: `list-test-${suffix}@example.com`,
    handle: `listtst-${suffix}`,
    displayName: `List Test ${suffix}`,
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
  testUserId = await insertTestUser();
});

afterEach(async () => {
  if (testUserId) await cleanupUser(testUserId);
  testUserId = '';
});

describe('listGroups — basic pagination', () => {
  it('returns rows with a total count', async () => {
    let groupId = '';
    try {
      const g = await createGroup({
        name: `List Pagination Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Pagination test group',
        primarySdgId: 1,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      groupId = g.id;

      const result = await listGroups({ limit: 100, offset: 0 });

      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(result.rows)).toBe(true);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('respects limit and offset', async () => {
    const groupIds: string[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const g = await createGroup({
          name: `Pagination Batch ${crypto.randomUUID().slice(0, 6)}`,
          description: `Group ${i}`,
          primarySdgId: 1,
          additionalSdgIds: [],
          visibility: 'public',
          preferredLocale: 'en',
          locationText: null,
          createdBy: testUserId,
        });
        groupIds.push(g.id);
      }

      const page1 = await listGroups({ limit: 2, offset: 0 });
      expect(page1.rows.length).toBeLessThanOrEqual(2);
      expect(page1.total).toBeGreaterThanOrEqual(3);
    } finally {
      for (const id of groupIds) await cleanupGroup(id);
    }
  });
});

describe('listGroups — visibility filter', () => {
  it('only returns public groups when visibility=public is requested', async () => {
    let publicGroupId = '';
    let privateGroupId = '';
    try {
      const pub = await createGroup({
        name: `Public Vis Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Public group',
        primarySdgId: 1,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      publicGroupId = pub.id;

      const priv = await createGroup({
        name: `Private Vis Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Private group',
        primarySdgId: 2,
        additionalSdgIds: [],
        visibility: 'private',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      privateGroupId = priv.id;

      const result = await listGroups({ visibility: 'public', limit: 100, offset: 0 });

      const ids = result.rows.map((r) => r.id);
      expect(ids).toContain(publicGroupId);
      expect(ids).not.toContain(privateGroupId);
    } finally {
      if (privateGroupId) await cleanupGroup(privateGroupId);
      if (publicGroupId) await cleanupGroup(publicGroupId);
    }
  });
});

describe('listGroups — SDG filter', () => {
  it('only returns groups that have the requested SDG', async () => {
    let sdg13GroupId = '';
    let sdg14GroupId = '';
    try {
      const g13 = await createGroup({
        name: `SDG13 Filter Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Climate group',
        primarySdgId: 13,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      sdg13GroupId = g13.id;

      const g14 = await createGroup({
        name: `SDG14 Filter Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Oceans group',
        primarySdgId: 14,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      sdg14GroupId = g14.id;

      const result = await listGroups({ sdgIds: [13], limit: 100, offset: 0 });
      const ids = result.rows.map((r) => r.id);

      expect(ids).toContain(sdg13GroupId);
      expect(ids).not.toContain(sdg14GroupId);
    } finally {
      if (sdg14GroupId) await cleanupGroup(sdg14GroupId);
      if (sdg13GroupId) await cleanupGroup(sdg13GroupId);
    }
  });

  it('returns groups that have any of the requested SDGs (OR semantics)', async () => {
    let groupId1 = '';
    let groupId2 = '';
    let groupId3 = '';
    try {
      const g1 = await createGroup({
        name: `SDG OR Test1 ${crypto.randomUUID().slice(0, 6)}`,
        description: 'SDG 7 group',
        primarySdgId: 7,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      groupId1 = g1.id;

      const g2 = await createGroup({
        name: `SDG OR Test2 ${crypto.randomUUID().slice(0, 6)}`,
        description: 'SDG 8 group',
        primarySdgId: 8,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      groupId2 = g2.id;

      const g3 = await createGroup({
        name: `SDG OR Test3 ${crypto.randomUUID().slice(0, 6)}`,
        description: 'SDG 9 group',
        primarySdgId: 9,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: null,
        createdBy: testUserId,
      });
      groupId3 = g3.id;

      const result = await listGroups({ sdgIds: [7, 8], limit: 100, offset: 0 });
      const ids = result.rows.map((r) => r.id);

      expect(ids).toContain(groupId1);
      expect(ids).toContain(groupId2);
      expect(ids).not.toContain(groupId3);
    } finally {
      if (groupId3) await cleanupGroup(groupId3);
      if (groupId2) await cleanupGroup(groupId2);
      if (groupId1) await cleanupGroup(groupId1);
    }
  });
});
