/**
 * @repo/queue — community-agent queue definition.
 *
 * Three job kinds sharing one queue:
 *   - stale-discussions  : daily cron, one job per group
 *   - member-suggestions : triggered on user join, one job per user
 *   - weekly-digest      : weekly cron, one job per opted-in group
 *
 * Retry policy: 2 retries (3 total attempts) with 5s / 25s backoff.
 * Failure is non-critical; DLQ logs but does not block content delivery.
 */

import { type ConnectionOptions, Queue } from 'bullmq';

export const COMMUNITY_AGENT_QUEUE_NAME = 'community-agent' as const;
export const COMMUNITY_AGENT_DLQ_NAME = 'community-agent-dead' as const;

export type CommunityAgentJobKind = 'stale-discussions' | 'member-suggestions' | 'weekly-digest';

export interface StaleDiscussionsJobData {
  readonly kind: 'stale-discussions';
  readonly groupId: string;
  readonly staleDays: number;
}

export interface MemberSuggestionsJobData {
  readonly kind: 'member-suggestions';
  readonly userId: string;
}

export interface WeeklyDigestJobData {
  readonly kind: 'weekly-digest';
  readonly groupId: string;
}

export type CommunityAgentJobData =
  | StaleDiscussionsJobData
  | MemberSuggestionsJobData
  | WeeklyDigestJobData;

export const COMMUNITY_AGENT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'custom' as const },
  removeOnComplete: { count: 200 },
  removeOnFail: false,
} as const;

export const COMMUNITY_AGENT_RETRY_DELAYS_MS = [5_000, 25_000] as const;

let _queue: Queue<CommunityAgentJobData> | undefined;

export function communityAgentQueue(): Queue<CommunityAgentJobData> {
  if (!_queue) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    _queue = new Queue<CommunityAgentJobData>(COMMUNITY_AGENT_QUEUE_NAME, {
      connection: { url: redisUrl } as ConnectionOptions,
      defaultJobOptions: { ...COMMUNITY_AGENT_JOB_OPTS },
    });
  }
  return _queue;
}

export function createCommunityAgentQueue(
  connection: ConnectionOptions,
): Queue<CommunityAgentJobData> {
  return new Queue<CommunityAgentJobData>(COMMUNITY_AGENT_QUEUE_NAME, {
    connection,
    defaultJobOptions: { ...COMMUNITY_AGENT_JOB_OPTS },
  });
}

export async function enqueueCommunityAgentJob(data: CommunityAgentJobData): Promise<void> {
  const q = communityAgentQueue();
  await q.add(data.kind, data, { ...COMMUNITY_AGENT_JOB_OPTS });
}

export function _resetCommunityAgentQueue(): void {
  _queue = undefined;
}
