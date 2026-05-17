/**
 * Tests for getGroupBySlug.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { db } from '@repo/database/client';
import { groups, users } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGroup } from './createGroup.ts';
import { getGroupBySlug } from './getGroup.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let testUserId = '';

async function insertTestUser(): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: `get-grp-${suffix}@example.com`,
    handle: `getgrp-${suffix}`,
    displayName: `Get Group ${suffix}`,
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

describe('getGroupBySlug', () => {
  it('returns the group with its SDG rows when found', async () => {
    let groupId = '';
    try {
      const created = await createGroup({
        name: `Get Group Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Test group for get',
        primarySdgId: 3,
        additionalSdgIds: [4],
        visibility: 'public',
        preferredLocale: 'en',
        locationText: 'Berlin, Germany',
        createdBy: testUserId,
      });
      groupId = created.id;

      const result = await getGroupBySlug(created.slug);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(groupId);
      expect(result?.sdgs.length).toBe(2);
      expect(result?.sdgs.some((s) => s.id === 3)).toBe(true);
      expect(result?.sdgs.some((s) => s.id === 4)).toBe(true);
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });

  it('returns null for a slug that does not exist', async () => {
    const result = await getGroupBySlug('nonexistent-slug-xyz-123456');
    expect(result).toBeNull();
  });

  it('includes locationText in the result', async () => {
    let groupId = '';
    try {
      const created = await createGroup({
        name: `Location Test ${crypto.randomUUID().slice(0, 6)}`,
        description: 'Group with location',
        primarySdgId: 11,
        additionalSdgIds: [],
        visibility: 'public',
        preferredLocale: 'pt-BR',
        locationText: 'São Paulo, Brazil',
        createdBy: testUserId,
      });
      groupId = created.id;

      const result = await getGroupBySlug(created.slug);

      expect(result?.locationText).toBe('São Paulo, Brazil');
      expect(result?.preferredLocale).toBe('pt-BR');
    } finally {
      if (groupId) await cleanupGroup(groupId);
    }
  });
});
