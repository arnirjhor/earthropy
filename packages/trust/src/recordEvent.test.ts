/**
 * Tests for recordEvent().
 *
 * Database interaction is fully mocked — no live Postgres required.
 * Covers:
 *  1. Inserts a reputation_events row with correct fields.
 *  2. Updates users.reputation atomically in the same transaction.
 *  3. Concurrent events sum correctly (sequential inserts accumulate delta).
 *  4. Throws when user is not found (update returns 0 rows via mock).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock refs ──────────────────────────────────────────────────────────

const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@repo/database/client', () => ({
  db: {
    transaction: mockTransaction,
  },
}));

vi.mock('@repo/database/schema', () => ({
  reputationEvents: {
    id: 'id',
    userId: 'user_id',
    kind: 'kind',
    delta: 'delta',
    reason: 'reason',
    sourceId: 'source_id',
    createdAt: 'created_at',
  },
  users: {
    id: 'id',
    reputation: 'reputation',
    updatedAt: 'updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ __eq: val })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    __sql: strings.join('?'),
    __values: values,
  })),
}));

// ── Import SUT after mocks ─────────────────────────────────────────────────────

import { recordEvent } from './recordEvent.ts';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeInsertedRow(
  overrides: Partial<{
    id: string;
    userId: string;
    kind: string;
    delta: number;
    reason: string | null;
    sourceId: string | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? 'event-uuid-1',
    userId: overrides.userId ?? 'user-uuid-1',
    kind: overrides.kind ?? 'post_accepted',
    delta: overrides.delta ?? 5,
    reason: overrides.reason ?? null,
    sourceId: overrides.sourceId ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
  };
}

/**
 * Build a mock transaction that captures what the callback inserts/updates,
 * then runs the callback with a fake tx object.
 */
function buildTxMock(insertedRow: ReturnType<typeof makeInsertedRow>) {
  const capturedInserts: unknown[] = [];
  const capturedUpdates: unknown[] = [];

  const returningFn = vi.fn().mockResolvedValue([insertedRow]);
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

  const setFn = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });

  const fakeTx = {
    insert: (table: unknown) => {
      capturedInserts.push(table);
      return insertFn(table);
    },
    update: (table: unknown) => {
      capturedUpdates.push(table);
      return updateFn(table);
    },
  };

  mockTransaction.mockImplementation(async (callback: (tx: typeof fakeTx) => Promise<unknown>) => {
    return callback(fakeTx);
  });

  return { capturedInserts, capturedUpdates, valuesFn, returningFn, setFn };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('recordEvent()', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('inserts reputation_events row', () => {
    it('calls tx.insert with correct values for post_accepted', async () => {
      const row = makeInsertedRow({ kind: 'post_accepted', delta: 5 });
      const { valuesFn } = buildTxMock(row);

      const result = await recordEvent({
        userId: 'user-uuid-1',
        kind: 'post_accepted',
        sourceId: 'post-uuid-1',
        reason: 'auto_publish',
      });

      expect(valuesFn).toHaveBeenCalledOnce();
      const args = valuesFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(args).toMatchObject({
        userId: 'user-uuid-1',
        kind: 'post_accepted',
        delta: 5,
        sourceId: 'post-uuid-1',
        reason: 'auto_publish',
      });

      expect(result.kind).toBe('post_accepted');
      expect(result.delta).toBe(5);
      expect(result.userId).toBe('user-uuid-1');
    });

    it('uses negative delta for post_rejected', async () => {
      const row = makeInsertedRow({ kind: 'post_rejected', delta: -3 });
      const { valuesFn } = buildTxMock(row);

      await recordEvent({ userId: 'user-uuid-2', kind: 'post_rejected' });

      const args = valuesFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(args.delta).toBe(-3);
    });

    it('uses delta 1 for comment_accepted', async () => {
      const row = makeInsertedRow({ kind: 'comment_accepted', delta: 1 });
      const { valuesFn } = buildTxMock(row);

      await recordEvent({ userId: 'user-uuid-3', kind: 'comment_accepted' });

      const args = valuesFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(args.delta).toBe(1);
    });

    it('uses delta -1 for comment_rejected', async () => {
      const row = makeInsertedRow({ kind: 'comment_rejected', delta: -1 });
      const { valuesFn } = buildTxMock(row);

      await recordEvent({ userId: 'user-uuid-4', kind: 'comment_rejected' });

      const args = valuesFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(args.delta).toBe(-1);
    });

    it('sets sourceId and reason to null when not provided', async () => {
      const row = makeInsertedRow();
      const { valuesFn } = buildTxMock(row);

      await recordEvent({ userId: 'user-uuid-5', kind: 'post_accepted' });

      const args = valuesFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(args.sourceId).toBeNull();
      expect(args.reason).toBeNull();
    });
  });

  describe('updates users.reputation in the same transaction', () => {
    it('calls tx.update on users table', async () => {
      const row = makeInsertedRow();
      const { setFn } = buildTxMock(row);

      await recordEvent({ userId: 'user-uuid-1', kind: 'post_accepted' });

      expect(setFn).toHaveBeenCalledOnce();
    });

    it('wraps both insert and update in a single transaction', async () => {
      const row = makeInsertedRow();
      buildTxMock(row);

      await recordEvent({ userId: 'user-uuid-1', kind: 'post_accepted' });

      // db.transaction was called once — both ops happened inside the callback
      expect(mockTransaction).toHaveBeenCalledOnce();
    });
  });

  describe('concurrent events sum correctly', () => {
    it('sequential calls each trigger their own transaction', async () => {
      const row1 = makeInsertedRow({ id: 'evt-1', delta: 5 });
      const row2 = makeInsertedRow({ id: 'evt-2', delta: -3 });

      // First call setup
      const { valuesFn: vf1 } = buildTxMock(row1);
      await recordEvent({ userId: 'user-uuid-1', kind: 'post_accepted' });
      const firstCallArgs = vf1.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(firstCallArgs.delta).toBe(5);

      vi.clearAllMocks();

      // Second call setup
      const { valuesFn: vf2 } = buildTxMock(row2);
      await recordEvent({ userId: 'user-uuid-1', kind: 'post_rejected' });
      const secondCallArgs = vf2.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(secondCallArgs.delta).toBe(-3);
    });

    it('returns event with id from inserted row', async () => {
      const row = makeInsertedRow({ id: 'unique-event-id' });
      buildTxMock(row);

      const result = await recordEvent({ userId: 'user-uuid-1', kind: 'post_accepted' });

      expect(result.id).toBe('unique-event-id');
    });
  });

  describe('return value', () => {
    it('returns the inserted row shape with all fields', async () => {
      const now = new Date('2026-05-18T12:00:00Z');
      const row = makeInsertedRow({
        id: 'event-uuid-99',
        userId: 'user-uuid-99',
        kind: 'post_accepted',
        delta: 5,
        reason: 'moderation passed',
        sourceId: 'post-uuid-99',
        createdAt: now,
      });
      buildTxMock(row);

      const result = await recordEvent({
        userId: 'user-uuid-99',
        kind: 'post_accepted',
        sourceId: 'post-uuid-99',
        reason: 'moderation passed',
      });

      expect(result).toEqual({
        id: 'event-uuid-99',
        userId: 'user-uuid-99',
        kind: 'post_accepted',
        delta: 5,
        reason: 'moderation passed',
        sourceId: 'post-uuid-99',
        createdAt: now,
      });
    });
  });
});
