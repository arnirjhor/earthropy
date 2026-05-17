/**
 * notify() — insert a notifications row and fan out to SSE listeners.
 *
 * B-NOTIF-1: replaces the throwing stub in index.ts.
 */
import { db } from '@repo/database/client';
import { notifications } from '@repo/database/schema';
import { notificationEmitter } from './emitter.ts';
import type { NotificationEvent } from './emitter.ts';
import type { NotifyInput } from './index.ts';

export async function notify(input: NotifyInput): Promise<void> {
  const { userId, kind, payload } = input;

  // Build notification record
  const id = crypto.randomUUID();
  const createdAt = new Date();

  // Insert into database
  await db.insert(notifications).values({
    id,
    userId,
    kind,
    payload,
  });

  // Fan out to in-process listeners (SSE route handlers)
  const event: NotificationEvent = {
    id,
    userId,
    kind,
    payload,
    readAt: null,
    createdAt,
  };
  notificationEmitter.emit('notification', event);
}
