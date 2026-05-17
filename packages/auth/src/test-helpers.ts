import type { Database } from '@repo/database';
/**
 * Test helpers — DB transaction rollback isolation.
 * Each test wraps its work in a transaction that always rolls back.
 * This file is only imported in *.test.ts files; not exported from index.ts.
 */
import { db } from '@repo/database/client';
import { users } from '@repo/database/schema';

export type { Database };

class RollbackSentinel extends Error {
  constructor() {
    super('rollback sentinel — not a real error');
    this.name = 'RollbackSentinel';
  }
}

/**
 * Run `fn` inside a Drizzle transaction that always rolls back,
 * giving the test a clean slate regardless of what happens.
 */
export async function withRollback<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
  let result!: T;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx as unknown as Database);
      throw new RollbackSentinel();
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e;
  }
  return result;
}

/**
 * Insert a minimal test user row directly, bypassing auth logic.
 * Returns the created user id.
 */
export async function insertTestUser(
  tx: Database,
  overrides: {
    email?: string;
    handle?: string;
    emailVerifiedAt?: Date | null;
    disabledAt?: Date | null;
    passwordHash?: string | null;
  } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  const uniqueSuffix = id.slice(0, 8);
  await (tx as typeof db).insert(users).values({
    id,
    email: overrides.email ?? `test-${uniqueSuffix}@example.com`,
    handle: overrides.handle ?? `testuser-${uniqueSuffix}`,
    displayName: `Test User ${uniqueSuffix}`,
    locale: 'en',
    passwordHash: overrides.passwordHash ?? null,
    emailVerifiedAt:
      overrides.emailVerifiedAt !== undefined ? overrides.emailVerifiedAt : new Date(),
    disabledAt: overrides.disabledAt ?? null,
  });
  return id;
}
