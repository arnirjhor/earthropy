import { log } from '@repo/observability';

// Background workers (BullMQ) land in Phase C. This script will start:
//   - moderation queue consumer
//   - notification dispatch (email send, in-app fan-out)
//   - reputation event aggregation (if any async work needed)

async function main(): Promise<void> {
  log.info('worker.start', { msg: 'no workers registered yet (Phase C)' });
  // Keep the process alive so docker compose sees the container as healthy.
  await new Promise(() => {});
}

main().catch((err) => {
  log.error('worker.fatal', { err: String(err) });
  process.exit(1);
});
