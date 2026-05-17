/**
 * Worker supervisor entry-point.
 *
 * Started via `pnpm --filter @earthropy/api worker` (or `npm run worker`).
 * Registers the moderation worker and keeps the process alive.
 * On uncaught errors: process.exit(1) so docker-compose / k8s restarts it.
 */

import { log } from '@repo/observability';
import { createModerationWorker } from './moderation.ts';

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = { url: redisUrl };

  log.info('worker.start', { msg: 'starting moderation worker' });

  const { worker } = createModerationWorker(connection);

  worker.on('completed', (job) => {
    log.info('worker.job.completed', { jobId: job.id, targetId: job.data.targetId });
  });

  worker.on('failed', (job, err) => {
    log.error('worker.job.failed', {
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  log.info('worker.ready', { queues: ['moderation'] });

  // Keep the process alive.
  await new Promise(() => {});
}

main().catch((err) => {
  log.error('worker.fatal', { err: String(err) });
  process.exit(1);
});

// Exit on uncaught errors so the supervisor restarts the process.
process.on('uncaughtException', (err) => {
  log.error('worker.uncaughtException', { err: err.message });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('worker.unhandledRejection', { reason: String(reason) });
  process.exit(1);
});
