/**
 * @repo/queue — moderation queue definition.
 *
 * Exports the BullMQ Queue instance and the `enqueueModeration` producer helper.
 *
 * Redis connection: reads REDIS_URL from env. Tests inject their own connection
 * via the `connection` option of the Queue constructor (ioredis-mock or a thin
 * manual fake — see packages/ratelimit/src/limit.test.ts for the fake pattern).
 *
 * Backoff config mirrors moderation.md §8:
 *   Attempt 1: immediate
 *   Attempt 2: delay 1 000 ms  (1s)
 *   Attempt 3: delay 5 000 ms  (5s)
 *   Attempt 4: delay 25 000 ms (25s)
 * Three retries = four total attempts.
 */

import { Queue, type ConnectionOptions } from 'bullmq';

export const MODERATION_QUEUE_NAME = 'moderation' as const;
export const MODERATION_DLQ_NAME = 'moderation-dead' as const;

export interface ModerationJobContext {
  readonly groupSdgCodes?: readonly string[];
  readonly authorReputation?: number;
  readonly targetType: 'post' | 'comment';
}

export interface ModerationJobData {
  readonly targetType: 'post' | 'comment';
  readonly targetId: string;
  readonly text: string;
  readonly locale: string;
  readonly context: ModerationJobContext;
}

/** Shared backoff configuration for the moderation worker. */
export const MODERATION_JOB_OPTS = {
  attempts: 4, // 1 initial + 3 retries
  backoff: {
    type: 'custom' as const,
    // Custom delays in ms per attempt index (0-based):
    // attempt 0 = immediate (no delay), 1 = 1s, 2 = 5s, 3 = 25s
  },
  removeOnComplete: { count: 500 },
  removeOnFail: false, // keep failed jobs so the worker can DLQ them
} as const;

/**
 * Exponential-ish delay schedule:
 * retryIndex 0 → 1 000 ms
 * retryIndex 1 → 5 000 ms
 * retryIndex 2 → 25 000 ms
 */
export const RETRY_DELAYS_MS = [1_000, 5_000, 25_000] as const;

// ---------------------------------------------------------------------------
// Lazy singleton — created on first use so importing the module in tests
// without a Redis instance doesn't fail (tests inject their own connection).
// ---------------------------------------------------------------------------

let _queue: Queue<ModerationJobData> | undefined;

/**
 * Returns the shared queue instance (lazy singleton).
 * Tests MUST call `createModerationQueue(connection)` and use the returned
 * instance directly to avoid touching the singleton.
 */
export function moderationQueue(): Queue<ModerationJobData> {
  if (!_queue) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    _queue = new Queue<ModerationJobData>(MODERATION_QUEUE_NAME, {
      connection: { url: redisUrl } as ConnectionOptions,
      defaultJobOptions: {
        ...MODERATION_JOB_OPTS,
      },
    });
  }
  return _queue;
}

/**
 * Create a named queue with an explicit connection — used by tests and the
 * worker process (which passes its own IORedis instance).
 */
export function createModerationQueue(
  connection: ConnectionOptions,
): Queue<ModerationJobData> {
  return new Queue<ModerationJobData>(MODERATION_QUEUE_NAME, {
    connection,
    defaultJobOptions: { ...MODERATION_JOB_OPTS },
  });
}

/**
 * Enqueue a `moderate-content` job on the shared queue.
 *
 * @param data  Job payload: target type/id, text to classify, locale, context.
 * @returns     The created BullMQ job.
 */
export async function enqueueModeration(
  data: ModerationJobData,
): Promise<ReturnType<Queue<ModerationJobData>['add']> extends Promise<infer J> ? J : never> {
  const q = moderationQueue();
  return q.add('moderate-content', data, { ...MODERATION_JOB_OPTS });
}

/** Exported for test teardown — clears the singleton so tests don't share state. */
export function _resetModerationQueue(): void {
  _queue = undefined;
}
