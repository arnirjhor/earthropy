/**
 * Moderation worker — BullMQ consumer for the `moderation` queue.
 *
 * Design doc: docs/architecture/moderation.md §8 (failure modes).
 *
 * Lifecycle:
 *  1. Receive a ModerationJobData job from the queue.
 *  2. Resolve the ModerationProvider from MODERATION_PROVIDER env var.
 *  3. Call provider.classify(input).
 *  4. Apply DEFAULT_POLICY via decide() to get the final verdict.
 *  5. Insert a moderation_decisions row (immutable audit log).
 *  6. Transition the target post/comment to the appropriate status.
 *
 * Failure handling (§8):
 *  - 3 retries with exponential backoff (1s / 5s / 25s) = 4 total attempts.
 *  - After all attempts exhausted the failed-job handler writes a
 *    hold_for_review decision (fail-closed per §8.1) and moves the job to
 *    the moderation-dead DLQ.
 *  - Never write auto_publish on failure.
 *
 * Testability: `processModerationJob` and `handleFailedModerationJob` are
 * exported so tests can call business logic directly without standing up a
 * live Redis connection (BullMQ's Lua scripts require a real Redis server).
 * `createModerationWorker` is for production use and the supervisor entry.
 */

import { getCommentById, updateCommentStatus } from '@repo/comments';
import { db } from '@repo/database/client';
import { moderationDecisions } from '@repo/database/schema';
import type { ModerationScores } from '@repo/database/schema';
import {
  AnthropicModerationProvider,
  DEFAULT_POLICY,
  type ModerationProvider,
  decide,
} from '@repo/moderation';
import { notify } from '@repo/notifications';
import { log } from '@repo/observability';
import { getPostById, updatePostStatus } from '@repo/posts';
import {
  MODERATION_DLQ_NAME,
  MODERATION_JOB_OPTS,
  MODERATION_QUEUE_NAME,
  type ModerationJobData,
  RETRY_DELAYS_MS,
  createModerationQueue,
} from '@repo/queue';
import { recordEvent } from '@repo/trust';
import { type ConnectionOptions, Queue, Worker } from 'bullmq';

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

function resolveProvider(): ModerationProvider {
  const providerEnv = process.env.MODERATION_PROVIDER ?? 'anthropic';

  if (providerEnv === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required when MODERATION_PROVIDER=anthropic');
    }
    const model = process.env.MODERATION_MODEL ?? 'claude-sonnet-4-5';
    const timeoutMs = process.env.ANTHROPIC_TIMEOUT_MS
      ? Number(process.env.ANTHROPIC_TIMEOUT_MS)
      : 10_000;
    return new AnthropicModerationProvider(apiKey, model, timeoutMs);
  }

  // Ollama provider lands in C-MOD-2; fall back to Anthropic with a warning.
  log.warn('worker.moderation.unknownProvider', {
    provider: providerEnv,
    fallback: 'anthropic',
  });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  return new AnthropicModerationProvider(apiKey);
}

// ---------------------------------------------------------------------------
// Status mapping: verdict → ContentStatus
// ---------------------------------------------------------------------------

type ContentStatus = 'published' | 'pending_review' | 'rejected';

function verdictToStatus(verdict: string): ContentStatus {
  switch (verdict) {
    case 'auto_publish':
      return 'published';
    case 'auto_reject':
      return 'rejected';
    default:
      return 'pending_review';
  }
}

// ---------------------------------------------------------------------------
// Notification fan-out helpers
// ---------------------------------------------------------------------------

async function fanOutNotifications(
  targetType: 'post' | 'comment',
  targetId: string,
  newStatus: 'published' | 'rejected',
): Promise<void> {
  if (targetType === 'post') {
    const post = await getPostById(targetId);
    if (!post) return;

    const kind = newStatus === 'published' ? 'post_published' : 'post_rejected';
    await notify({ userId: post.authorId, kind, payload: { postId: targetId } });
  } else {
    // comment: notify the post author when a comment is published (comment_reply)
    if (newStatus !== 'published') return;

    const comment = await getCommentById(targetId);
    if (!comment) return;

    const post = await getPostById(comment.postId);
    if (!post) return;

    await notify({
      userId: post.authorId,
      kind: 'comment_reply',
      payload: { commentId: targetId, postId: comment.postId },
    });
  }
}

// ---------------------------------------------------------------------------
// Decision writer — shared by success and failure paths
// ---------------------------------------------------------------------------

async function writeDecision(opts: {
  targetType: 'post' | 'comment';
  targetId: string;
  provider: string;
  model: string;
  scores: ModerationScores;
  verdict: 'auto_publish' | 'hold_for_review' | 'auto_reject';
  reasoning: string | null;
}): Promise<void> {
  await db.insert(moderationDecisions).values({
    targetType: opts.targetType,
    targetId: opts.targetId,
    provider: opts.provider,
    model: opts.model,
    scores: opts.scores,
    verdict: opts.verdict,
    reasoning: opts.reasoning ?? undefined,
    reviewerId: undefined,
  });
}

// ---------------------------------------------------------------------------
// Core job processor — exported so tests can call it directly
// ---------------------------------------------------------------------------

/**
 * Process one moderation job. Exported for direct testing without needing
 * a live Redis / BullMQ instance.
 */
export async function processModerationJob(
  data: ModerationJobData,
  provider: ModerationProvider,
): Promise<void> {
  const { targetType, targetId, text, locale, context } = data;
  const authorReputation = context.authorReputation ?? 0;

  log.info('worker.moderation.start', { targetType, targetId });

  const result = await provider.classify({
    text,
    locale,
    context: {
      groupSdgCodes: context.groupSdgCodes,
      authorReputation,
      targetType,
    },
  });

  // Apply policy — the final verdict is always from decide(), not the provider.
  const finalVerdict = decide(result, DEFAULT_POLICY, authorReputation);

  // Write the immutable audit row (design doc §9.1).
  await writeDecision({
    targetType,
    targetId,
    provider: result.provider,
    model: result.model,
    scores: result.scores as ModerationScores,
    verdict: finalVerdict,
    reasoning: result.reasoning,
  });

  // Transition status
  const newStatus = verdictToStatus(finalVerdict);
  if (targetType === 'post') {
    await updatePostStatus(targetId, { newStatus });
  } else {
    await updateCommentStatus(targetId, { newStatus });
  }

  // Accrue reputation for published / rejected transitions
  if (newStatus === 'published' || newStatus === 'rejected') {
    try {
      const reputationKind =
        targetType === 'post'
          ? newStatus === 'published'
            ? 'post_accepted'
            : 'post_rejected'
          : newStatus === 'published'
            ? 'comment_accepted'
            : 'comment_rejected';

      // Resolve authorId: we need the content row for the user id
      let authorId: string | null = null;
      if (targetType === 'post') {
        const post = await getPostById(targetId);
        authorId = post?.authorId ?? null;
      } else {
        const comment = await getCommentById(targetId);
        authorId = comment?.authorId ?? null;
      }

      if (authorId) {
        await recordEvent({
          userId: authorId,
          kind: reputationKind,
          sourceId: targetId,
          reason: finalVerdict,
        });
      } else {
        log.warn('worker.moderation.reputationSkipped', {
          targetType,
          targetId,
          reason: 'authorId not found',
        });
      }
    } catch (repErr) {
      // Non-fatal: log but don't fail the job
      log.warn('worker.moderation.reputationFailed', {
        targetType,
        targetId,
        err: repErr instanceof Error ? repErr.message : String(repErr),
      });
    }
  }

  // Fan out in-app notifications
  if (newStatus === 'published' || newStatus === 'rejected') {
    try {
      await fanOutNotifications(targetType, targetId, newStatus);
    } catch (notifyErr) {
      // Non-fatal: log but don't fail the job
      log.warn('worker.moderation.notifyFailed', {
        targetType,
        targetId,
        err: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
      });
    }
  }

  log.info('worker.moderation.done', { targetType, targetId, verdict: finalVerdict });
}

// ---------------------------------------------------------------------------
// Failure handler — writes hold_for_review THEN DLQs the job (§8.7)
// Exported so tests can call it directly.
// ---------------------------------------------------------------------------

export interface DlqLike {
  add(name: string, data: unknown): Promise<unknown>;
}

/**
 * Write a fail-closed hold_for_review decision and push the job to the DLQ.
 * Called by the BullMQ 'failed' event (after attempts exhausted) or by tests.
 */
export async function handleFailedModerationJob(
  data: ModerationJobData,
  err: unknown,
  dlq: DlqLike,
  jobId?: string,
): Promise<void> {
  const { targetType, targetId } = data;
  const providerEnv = process.env.MODERATION_PROVIDER ?? 'anthropic';

  log.warn('worker.moderation.failed', {
    jobId,
    targetType,
    targetId,
    err: err instanceof Error ? err.message : String(err),
  });

  // Fail-closed: write hold_for_review so the human queue picks it up (§8.1).
  await writeDecision({
    targetType,
    targetId,
    provider: providerEnv,
    model: process.env.MODERATION_MODEL ?? 'claude-sonnet-4-5',
    scores: {},
    verdict: 'hold_for_review',
    reasoning: 'provider unavailable after retries; queued for human review',
  }).catch((writeErr) => {
    log.error('worker.moderation.failedWriteDecision', {
      jobId,
      err: writeErr instanceof Error ? writeErr.message : String(writeErr),
    });
  });

  // Move to DLQ
  await dlq
    .add('failed-moderation', {
      originalJobId: jobId,
      targetType,
      targetId,
      failedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
      jobData: data,
    })
    .catch((dlqErr) => {
      log.error('worker.moderation.dlqFailed', {
        jobId,
        err: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
      });
    });
}

// ---------------------------------------------------------------------------
// Worker factory — for production use and the supervisor entry
// ---------------------------------------------------------------------------

export interface ModerationWorkerHandle {
  worker: Worker;
  queue: Queue<ModerationJobData>;
}

/**
 * Create a BullMQ Worker and Queue pair for the moderation pipeline.
 *
 * @param connection  IORedis ConnectionOptions — production passes REDIS_URL.
 * @param provider    ModerationProvider — defaults to resolving from env.
 * @param dlq         Optional DLQ queue override (for tests).
 */
export function createModerationWorker(
  connection: ConnectionOptions,
  provider?: ModerationProvider,
  dlq?: DlqLike,
): ModerationWorkerHandle {
  const resolvedProvider = provider ?? resolveProvider();
  const queue = createModerationQueue(connection);

  const deadLetterQueue: DlqLike =
    dlq ??
    new Queue(MODERATION_DLQ_NAME, {
      connection,
    });

  const worker = new Worker<ModerationJobData>(
    MODERATION_QUEUE_NAME,
    async (job) => {
      await processModerationJob(job.data, resolvedProvider);
    },
    {
      connection,
      settings: {
        /**
         * Custom backoff strategy matching the spec: 1s / 5s / 25s.
         * BullMQ calls this with the attempt index (1 = first retry).
         */
        backoffStrategy: (attemptsMade: number): number => {
          const idx = Math.min(attemptsMade - 1, RETRY_DELAYS_MS.length - 1);
          return RETRY_DELAYS_MS[idx] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 25_000;
        },
      },
    },
  );

  // 'failed' event fires after ALL attempts are exhausted.
  // Write DLQ entry only on final failure — not on each retry attempt.
  worker.on('failed', (job, err) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? MODERATION_JOB_OPTS.attempts;
    const attemptsMade = job.attemptsMade ?? 0;
    if (attemptsMade >= maxAttempts) {
      void handleFailedModerationJob(job.data, err, deadLetterQueue, job.id);
    }
  });

  return { worker, queue };
}
