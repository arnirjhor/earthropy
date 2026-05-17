/**
 * Unit tests for @repo/queue — moderation queue init and enqueue helper.
 *
 * Redis requirement: BullMQ's Queue.add() uses Lua scripts that ioredis-mock
 * does not implement. We therefore test the queue at the level that doesn't
 * require a live Redis round-trip:
 *
 *  - Constants and config shape are tested directly (no Redis needed).
 *  - The `enqueueModeration` helper is tested by stubbing out the Queue.add
 *    method so we can assert the job name and data shape without executing
 *    Lua scripts.
 *
 * This mirrors the manual-fake pattern used in @repo/ratelimit.
 */

import { Queue } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MODERATION_DLQ_NAME,
  MODERATION_JOB_OPTS,
  MODERATION_QUEUE_NAME,
  RETRY_DELAYS_MS,
  _resetModerationQueue,
  enqueueModeration,
} from './moderation.ts';
import type { ModerationJobData } from './moderation.ts';

const SAMPLE_JOB: ModerationJobData = {
  targetType: 'post',
  targetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  text: 'A benign post about SDG 13.',
  locale: 'en',
  context: {
    groupSdgCodes: ['13'],
    authorReputation: 100,
    targetType: 'post',
  },
};

// ─── Queue.add stub ───────────────────────────────────────────────────────────
// We stub Queue.prototype.add to capture calls without needing Redis Lua scripts.

let capturedAdds: Array<{ name: string; data: ModerationJobData; opts: unknown }> = [];

beforeEach(() => {
  capturedAdds = [];
  _resetModerationQueue();
  process.env.REDIS_URL = 'redis://localhost:6379'; // prevent "required" throw

  vi.spyOn(Queue.prototype, 'add').mockImplementation(
    async function (this: Queue, name: string, data: unknown, opts?: unknown) {
      capturedAdds.push({ name, data: data as ModerationJobData, opts });
      // Return a minimal job-like object
      return { id: 'fake-id', name, data, opts } as unknown as ReturnType<Queue['add']>;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  _resetModerationQueue();
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe('queue constants', () => {
  it('has the expected queue name', () => {
    expect(MODERATION_QUEUE_NAME).toBe('moderation');
  });

  it('has the expected DLQ name', () => {
    expect(MODERATION_DLQ_NAME).toBe('moderation-dead');
  });

  it('configures 4 attempts (1 initial + 3 retries)', () => {
    expect(MODERATION_JOB_OPTS.attempts).toBe(4);
  });

  it('has three retry delay steps', () => {
    expect(RETRY_DELAYS_MS).toHaveLength(3);
  });

  it('retry delays are 1s, 5s, 25s', () => {
    expect(RETRY_DELAYS_MS[0]).toBe(1_000);
    expect(RETRY_DELAYS_MS[1]).toBe(5_000);
    expect(RETRY_DELAYS_MS[2]).toBe(25_000);
  });
});

// ─── enqueueModeration helper ─────────────────────────────────────────────────

describe('enqueueModeration', () => {
  it('calls Queue.add with job name "moderate-content"', async () => {
    await enqueueModeration(SAMPLE_JOB);
    expect(capturedAdds).toHaveLength(1);
    expect(capturedAdds[0]?.name).toBe('moderate-content');
  });

  it('passes targetType, targetId, text, locale, and context in data', async () => {
    await enqueueModeration(SAMPLE_JOB);
    const data = capturedAdds[0]?.data;
    expect(data?.targetType).toBe('post');
    expect(data?.targetId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(data?.text).toBe('A benign post about SDG 13.');
    expect(data?.locale).toBe('en');
    expect(data?.context.groupSdgCodes).toStrictEqual(['13']);
    expect(data?.context.authorReputation).toBe(100);
  });

  it('passes the correct attempts count in job opts', async () => {
    await enqueueModeration(SAMPLE_JOB);
    const opts = capturedAdds[0]?.opts as typeof MODERATION_JOB_OPTS;
    expect(opts?.attempts).toBe(4);
  });

  it('works for comment target type', async () => {
    const commentJob: ModerationJobData = {
      ...SAMPLE_JOB,
      targetType: 'comment',
      context: { ...SAMPLE_JOB.context, targetType: 'comment' },
    };
    await enqueueModeration(commentJob);
    expect(capturedAdds[0]?.data.targetType).toBe('comment');
  });

  it('returns the job object from Queue.add', async () => {
    const result = await enqueueModeration(SAMPLE_JOB);
    expect(result).toBeDefined();
    // The stub returns an object with a name field
    expect((result as { name: string }).name).toBe('moderate-content');
  });
});
