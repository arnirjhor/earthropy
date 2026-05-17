/**
 * Tests for notify() — inserts a notifications row and emits an in-process event.
 *
 * Database interaction is mocked; no real Postgres required.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock refs ──────────────────────────────────────────────────────────

const { mockInsert } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@repo/database/client', () => ({
  db: {
    insert: mockInsert,
  },
}));

vi.mock('@repo/database/schema', () => ({
  notifications: { tableName: 'notifications' },
}));

// ── Import SUT ─────────────────────────────────────────────────────────────────

import { notificationEmitter } from './emitter.ts';
import { notify } from './notify.ts';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('notify()', () => {
  beforeEach(() => {
    // Wire db.insert chain: insert(table).values(row) → Promise<void>
    const valuesMock = vi.fn().mockResolvedValue([{ id: 'new-notif-uuid' }]);
    mockInsert.mockReturnValue({ values: valuesMock });
  });

  afterEach(() => {
    mockInsert.mockReset();
    notificationEmitter.removeAllListeners();
  });

  it('inserts a notifications row with correct fields', async () => {
    await notify({ userId: 'user-1', kind: 'post_published', payload: { postId: 'p-1' } });

    expect(mockInsert).toHaveBeenCalledOnce();
    const valuesMock = mockInsert.mock.results[0]?.value as { values: ReturnType<typeof vi.fn> };
    expect(valuesMock.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        kind: 'post_published',
        payload: { postId: 'p-1' },
      }),
    );
  });

  it('emits a "notification" event on the notificationEmitter', async () => {
    const listener = vi.fn();
    notificationEmitter.on('notification', listener);

    await notify({ userId: 'user-2', kind: 'comment_reply', payload: { commentId: 'c-1' } });

    expect(listener).toHaveBeenCalledOnce();
    const emitted = listener.mock.calls[0]?.[0] as unknown;
    expect(emitted).toMatchObject({
      userId: 'user-2',
      kind: 'comment_reply',
      payload: { commentId: 'c-1' },
    });
  });

  it('emitted event includes an id and createdAt', async () => {
    const listener = vi.fn();
    notificationEmitter.on('notification', listener);

    await notify({ userId: 'user-3', kind: 'post_rejected', payload: {} });

    const emitted = listener.mock.calls[0]?.[0] as { id: unknown; createdAt: unknown };
    expect(typeof emitted.id).toBe('string');
    expect(emitted.createdAt).toBeInstanceOf(Date);
  });

  it('handles all supported notification kinds without throwing', async () => {
    const kinds = [
      'post_published',
      'post_held',
      'post_rejected',
      'comment_reply',
      'group_invite',
      'moderation_assigned',
      'appeal_resolved',
      'mention',
    ] as const;

    for (const kind of kinds) {
      await expect(notify({ userId: 'u', kind, payload: {} })).resolves.toBeUndefined();
    }
  });
});
