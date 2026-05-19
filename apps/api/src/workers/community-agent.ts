/**
 * Community-agent worker — BullMQ consumer for the `community-agent` queue.
 *
 * Handles three job kinds:
 *   stale-discussions  — daily; surfaces inactive posts to group admins
 *   member-suggestions — on user join; recommends groups based on SDG interests
 *   weekly-digest      — weekly; drafts digest email content for opted-in groups
 *
 * Lifecycle:
 *  1. Receive a CommunityAgentJobData job from the queue.
 *  2. Check COMMUNITY_AGENT_ENABLED; skip if false (graceful no-op).
 *  3. Resolve the CommunityAgentProvider from COMMUNITY_AGENT_PROVIDER env var.
 *  4. Dispatch to the appropriate task handler.
 *  5. Write a community_agent_runs log row.
 *  6. Fan-out notifications to relevant users.
 *
 * Failure handling:
 *  - 2 retries (3 total attempts) with 5s / 25s backoff.
 *  - After all attempts exhausted the failed-job handler logs to DLQ.
 *  - Agent failures are non-fatal; they never block content delivery.
 *
 * Scheduling:
 *  - stale-discussions: BullMQ repeatable job, daily (configurable via STALE_CHECK_CRON).
 *  - weekly-digest:     BullMQ repeatable job, weekly (configurable via DIGEST_CRON).
 *  - member-suggestions: enqueued ad-hoc by the join handler in apps/api.
 */

import {
  AnthropicCommunityAgentProvider,
  OllamaCommunityAgentProvider,
  runMemberSuggestionsTask,
  runStaleDiscussionsTask,
  runWeeklyDigestTask,
} from '@repo/community-agent';
import type { CommunityAgentProvider } from '@repo/community-agent';
import { schema } from '@repo/database';
import { db } from '@repo/database/client';
import { notify } from '@repo/notifications';
import { log } from '@repo/observability';
import {
  COMMUNITY_AGENT_DLQ_NAME,
  COMMUNITY_AGENT_JOB_OPTS,
  COMMUNITY_AGENT_QUEUE_NAME,
  COMMUNITY_AGENT_RETRY_DELAYS_MS,
  type CommunityAgentJobData,
  type MemberSuggestionsJobData,
  type StaleDiscussionsJobData,
  type WeeklyDigestJobData,
  createCommunityAgentQueue,
} from '@repo/queue';
import { type ConnectionOptions, Queue, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

function resolveProvider(): CommunityAgentProvider {
  const providerEnv = process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic';

  if (providerEnv === 'ollama') {
    return new OllamaCommunityAgentProvider();
  }

  if (providerEnv === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required when COMMUNITY_AGENT_PROVIDER=anthropic');
    }
    const model = process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5';
    const timeoutMs = process.env.ANTHROPIC_TIMEOUT_MS
      ? Number(process.env.ANTHROPIC_TIMEOUT_MS)
      : 15_000;
    return new AnthropicCommunityAgentProvider(apiKey, model, timeoutMs);
  }

  log.warn('worker.communityAgent.unknownProvider', {
    provider: providerEnv,
    fallback: 'anthropic',
  });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  return new AnthropicCommunityAgentProvider(apiKey);
}

// ---------------------------------------------------------------------------
// Run log writer
// ---------------------------------------------------------------------------

async function writeRunLog(opts: {
  taskKind: 'stale_discussions' | 'member_suggestions' | 'weekly_digest';
  groupId?: string;
  userId?: string;
  provider: string;
  model: string;
  status: 'success' | 'failure' | 'skipped';
  resultSummary?: Record<string, unknown>;
  errorMessage?: string;
}): Promise<void> {
  await db.insert(schema.communityAgentRuns).values({
    taskKind: opts.taskKind,
    groupId: opts.groupId ?? null,
    userId: opts.userId ?? null,
    provider: opts.provider,
    model: opts.model,
    status: opts.status,
    resultSummary: opts.resultSummary ?? {},
    errorMessage: opts.errorMessage ?? null,
  });
}

// ---------------------------------------------------------------------------
// Stale-discussions handler
// ---------------------------------------------------------------------------

async function handleStaleDiscussions(
  data: StaleDiscussionsJobData,
  provider: CommunityAgentProvider,
): Promise<void> {
  const staleDays = data.staleDays;
  log.info('worker.communityAgent.staleDiscussions.start', {
    groupId: data.groupId,
    staleDays,
  });

  const discussions = await runStaleDiscussionsTask(provider, {
    groupId: data.groupId,
    staleDays,
  });

  if (discussions.length === 0) {
    log.info('worker.communityAgent.staleDiscussions.none', { groupId: data.groupId });
    await writeRunLog({
      taskKind: 'stale_discussions',
      groupId: data.groupId,
      provider: process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic',
      model: process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5',
      status: 'skipped',
      resultSummary: { discussionsFound: 0 },
    });
    return;
  }

  // Notify group admins/moderators of stale discussions
  const adminRows = await db
    .select({ userId: schema.groupMembers.userId })
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, data.groupId));

  const adminIds = adminRows.map((r) => r.userId);

  for (const adminId of adminIds) {
    await notify({
      userId: adminId,
      kind: 'stale_discussion_alert',
      payload: {
        groupId: data.groupId,
        discussionCount: discussions.length,
        discussions: discussions.map((d) => ({
          postId: d.postId,
          postTitle: d.postTitle,
          daysSinceActivity: d.daysSinceActivity,
          suggestionText: d.suggestionText,
        })),
      },
    }).catch((err: unknown) => {
      log.warn('worker.communityAgent.staleDiscussions.notifyFailed', {
        adminId,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }

  await writeRunLog({
    taskKind: 'stale_discussions',
    groupId: data.groupId,
    provider: process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic',
    model: process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5',
    status: 'success',
    resultSummary: { discussionsFound: discussions.length, adminsNotified: adminIds.length },
  });

  log.info('worker.communityAgent.staleDiscussions.done', {
    groupId: data.groupId,
    discussionsFound: discussions.length,
  });
}

// ---------------------------------------------------------------------------
// Member-suggestions handler
// ---------------------------------------------------------------------------

async function handleMemberSuggestions(
  data: MemberSuggestionsJobData,
  provider: CommunityAgentProvider,
): Promise<void> {
  log.info('worker.communityAgent.memberSuggestions.start', { userId: data.userId });

  // Check user opt-in (default: true)
  const prefRows = await db
    .select({ groupSuggestionsEnabled: schema.userAgentPreferences.groupSuggestionsEnabled })
    .from(schema.userAgentPreferences)
    .where(eq(schema.userAgentPreferences.userId, data.userId))
    .limit(1);

  const pref = prefRows[0];
  if (pref && !pref.groupSuggestionsEnabled) {
    log.info('worker.communityAgent.memberSuggestions.optedOut', { userId: data.userId });
    await writeRunLog({
      taskKind: 'member_suggestions',
      userId: data.userId,
      provider: process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic',
      model: process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5',
      status: 'skipped',
      resultSummary: { reason: 'user_opted_out' },
    });
    return;
  }

  const suggestions = await runMemberSuggestionsTask(provider, { userId: data.userId });

  if (suggestions.length === 0) {
    await writeRunLog({
      taskKind: 'member_suggestions',
      userId: data.userId,
      provider: process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic',
      model: process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5',
      status: 'skipped',
      resultSummary: { suggestionsCount: 0 },
    });
    return;
  }

  await notify({
    userId: data.userId,
    kind: 'group_suggestion',
    payload: {
      suggestions: suggestions.map((s) => ({
        groupId: s.groupId,
        groupSlug: s.groupSlug,
        groupName: s.groupName,
        sdgCodes: s.sdgCodes,
        relevanceScore: s.relevanceScore,
        reason: s.reason,
      })),
    },
  }).catch((err: unknown) => {
    log.warn('worker.communityAgent.memberSuggestions.notifyFailed', {
      userId: data.userId,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  await writeRunLog({
    taskKind: 'member_suggestions',
    userId: data.userId,
    provider: process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic',
    model: process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5',
    status: 'success',
    resultSummary: { suggestionsCount: suggestions.length },
  });

  log.info('worker.communityAgent.memberSuggestions.done', {
    userId: data.userId,
    suggestionsCount: suggestions.length,
  });
}

// ---------------------------------------------------------------------------
// Weekly-digest handler
// ---------------------------------------------------------------------------

async function handleWeeklyDigest(
  data: WeeklyDigestJobData,
  provider: CommunityAgentProvider,
): Promise<void> {
  log.info('worker.communityAgent.weeklyDigest.start', { groupId: data.groupId });

  // Check group opt-in
  const groupRows = await db
    .select({ digestEnabled: schema.groups.digestEnabled })
    .from(schema.groups)
    .where(eq(schema.groups.id, data.groupId))
    .limit(1);

  const group = groupRows[0];
  if (!group?.digestEnabled) {
    log.info('worker.communityAgent.weeklyDigest.groupOptedOut', { groupId: data.groupId });
    await writeRunLog({
      taskKind: 'weekly_digest',
      groupId: data.groupId,
      provider: process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic',
      model: process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5',
      status: 'skipped',
      resultSummary: { reason: 'group_opted_out' },
    });
    return;
  }

  const digest = await runWeeklyDigestTask(provider, { groupId: data.groupId });

  if (!digest) {
    await writeRunLog({
      taskKind: 'weekly_digest',
      groupId: data.groupId,
      provider: process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic',
      model: process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5',
      status: 'skipped',
      resultSummary: { reason: 'group_not_found' },
    });
    return;
  }

  // Notify opted-in members of digest availability
  const memberRows = await db
    .select({ userId: schema.groupMembers.userId })
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, data.groupId));

  // Filter to members who have digest email enabled (default: false, user must opt in)
  const memberIds = memberRows.map((r) => r.userId);

  const prefRows =
    memberIds.length > 0
      ? await db
          .select({
            userId: schema.userAgentPreferences.userId,
            digestEmailEnabled: schema.userAgentPreferences.digestEmailEnabled,
          })
          .from(schema.userAgentPreferences)
          .where(eq(schema.userAgentPreferences.digestEmailEnabled, true))
      : [];

  const enabledUserIds = new Set(prefRows.map((p) => p.userId));
  const recipientIds = memberIds.filter((id) => enabledUserIds.has(id));

  for (const userId of recipientIds) {
    await notify({
      userId,
      kind: 'digest_ready',
      payload: {
        groupId: digest.groupId,
        groupName: digest.groupName,
        subjectLine: digest.subjectLine,
        summaryText: digest.summaryText,
        itemCount: digest.items.length,
        periodStart: digest.periodStart.toISOString(),
        periodEnd: digest.periodEnd.toISOString(),
      },
    }).catch((err: unknown) => {
      log.warn('worker.communityAgent.weeklyDigest.notifyFailed', {
        userId,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }

  await writeRunLog({
    taskKind: 'weekly_digest',
    groupId: data.groupId,
    provider: digest.provider,
    model: digest.model,
    status: 'success',
    resultSummary: {
      itemCount: digest.items.length,
      recipientsNotified: recipientIds.length,
    },
  });

  log.info('worker.communityAgent.weeklyDigest.done', {
    groupId: data.groupId,
    itemCount: digest.items.length,
    recipientsNotified: recipientIds.length,
  });
}

// ---------------------------------------------------------------------------
// Core job processor
// ---------------------------------------------------------------------------

export async function processCommunityAgentJob(
  data: CommunityAgentJobData,
  provider: CommunityAgentProvider,
): Promise<void> {
  // Feature flag — skip gracefully if disabled
  if (!isAgentEnabled()) {
    log.info('worker.communityAgent.disabled', { kind: data.kind });
    return;
  }

  switch (data.kind) {
    case 'stale-discussions':
      await handleStaleDiscussions(data, provider);
      break;
    case 'member-suggestions':
      await handleMemberSuggestions(data, provider);
      break;
    case 'weekly-digest':
      await handleWeeklyDigest(data, provider);
      break;
    default: {
      const exhaustive: never = data;
      log.warn('worker.communityAgent.unknownKind', {
        kind: (exhaustive as CommunityAgentJobData).kind,
      });
    }
  }
}

function isAgentEnabled(): boolean {
  return process.env.COMMUNITY_AGENT_ENABLED === 'true';
}

// ---------------------------------------------------------------------------
// Failure handler
// ---------------------------------------------------------------------------

export interface AgentDlqLike {
  add(name: string, data: unknown): Promise<unknown>;
}

export async function handleFailedCommunityAgentJob(
  data: CommunityAgentJobData,
  err: unknown,
  dlq: AgentDlqLike,
  jobId?: string,
): Promise<void> {
  log.warn('worker.communityAgent.failed', {
    jobId,
    kind: data.kind,
    err: err instanceof Error ? err.message : String(err),
  });

  await writeRunLog({
    taskKind:
      data.kind === 'stale-discussions'
        ? 'stale_discussions'
        : data.kind === 'member-suggestions'
          ? 'member_suggestions'
          : 'weekly_digest',
    groupId: 'groupId' in data ? data.groupId : undefined,
    userId: 'userId' in data ? data.userId : undefined,
    provider: process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic',
    model: process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5',
    status: 'failure',
    errorMessage: err instanceof Error ? err.message : String(err),
  }).catch((writeErr: unknown) => {
    log.error('worker.communityAgent.failedWriteLog', {
      jobId,
      err: writeErr instanceof Error ? writeErr.message : String(writeErr),
    });
  });

  await dlq
    .add('failed-community-agent', {
      originalJobId: jobId,
      kind: data.kind,
      failedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
      jobData: data,
    })
    .catch((dlqErr: unknown) => {
      log.error('worker.communityAgent.dlqFailed', {
        jobId,
        err: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
      });
    });
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

export interface CommunityAgentWorkerHandle {
  worker: Worker;
  queue: ReturnType<typeof createCommunityAgentQueue>;
}

export function createCommunityAgentWorker(
  connection: ConnectionOptions,
  provider?: CommunityAgentProvider,
  dlq?: AgentDlqLike,
): CommunityAgentWorkerHandle {
  const resolvedProvider = provider ?? resolveProvider();
  const queue = createCommunityAgentQueue(connection);

  const deadLetterQueue: AgentDlqLike =
    dlq ??
    new Queue(COMMUNITY_AGENT_DLQ_NAME, {
      connection,
    });

  const worker = new Worker<CommunityAgentJobData>(
    COMMUNITY_AGENT_QUEUE_NAME,
    async (job) => {
      await processCommunityAgentJob(job.data, resolvedProvider);
    },
    {
      connection,
      settings: {
        backoffStrategy: (attemptsMade: number): number => {
          const idx = Math.min(attemptsMade - 1, COMMUNITY_AGENT_RETRY_DELAYS_MS.length - 1);
          return (
            COMMUNITY_AGENT_RETRY_DELAYS_MS[idx] ??
            COMMUNITY_AGENT_RETRY_DELAYS_MS[COMMUNITY_AGENT_RETRY_DELAYS_MS.length - 1] ??
            25_000
          );
        },
      },
    },
  );

  worker.on('failed', (job, err) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? COMMUNITY_AGENT_JOB_OPTS.attempts;
    const attemptsMade = job.attemptsMade ?? 0;
    if (attemptsMade >= maxAttempts) {
      void handleFailedCommunityAgentJob(job.data, err, deadLetterQueue, job.id);
    }
  });

  return { worker, queue };
}

// ---------------------------------------------------------------------------
// Cron scheduler — registers repeatable jobs for daily/weekly tasks
// ---------------------------------------------------------------------------

/**
 * Register repeatable BullMQ jobs for stale-discussions (daily) and
 * weekly-digest (weekly) for all groups that have these features configured.
 *
 * Call once at worker startup after createCommunityAgentWorker().
 */
export async function scheduleCommunityAgentCrons(
  queue: ReturnType<typeof createCommunityAgentQueue>,
): Promise<void> {
  if (!isAgentEnabled()) {
    log.info('worker.communityAgent.cronsSkipped', { reason: 'feature disabled' });
    return;
  }

  // Default cron expressions — overridable via env vars
  const staleCron = process.env.STALE_CHECK_CRON ?? '0 8 * * *'; // daily at 08:00 UTC
  const digestCron = process.env.DIGEST_CRON ?? '0 9 * * 1'; // Mondays at 09:00 UTC
  const staleDays = process.env.STALE_DAYS_THRESHOLD ? Number(process.env.STALE_DAYS_THRESHOLD) : 7;

  // Fetch all groups
  const groupRows = await db
    .select({ id: schema.groups.id, digestEnabled: schema.groups.digestEnabled })
    .from(schema.groups);

  for (const group of groupRows) {
    // Schedule stale-discussions check for every group
    await queue.add(
      'stale-discussions',
      { kind: 'stale-discussions', groupId: group.id, staleDays },
      {
        ...COMMUNITY_AGENT_JOB_OPTS,
        repeat: { pattern: staleCron },
        jobId: `stale-${group.id}`,
      },
    );

    // Schedule weekly-digest only for opted-in groups
    if (group.digestEnabled) {
      await queue.add(
        'weekly-digest',
        { kind: 'weekly-digest', groupId: group.id },
        {
          ...COMMUNITY_AGENT_JOB_OPTS,
          repeat: { pattern: digestCron },
          jobId: `digest-${group.id}`,
        },
      );
    }
  }

  log.info('worker.communityAgent.cronsScheduled', {
    groupCount: groupRows.length,
    staleCron,
    digestCron,
  });
}
