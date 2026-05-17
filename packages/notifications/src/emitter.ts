/**
 * In-process EventEmitter for notification fan-out.
 *
 * Single shared instance; SSE route handlers subscribe per connected user.
 * Multi-process pub/sub (Redis) is a v0.2 concern.
 */
import { EventEmitter } from 'node:events';
import type { NotificationKind } from './index.ts';

export interface NotificationEvent {
  id: string;
  userId: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

export const notificationEmitter = new EventEmitter();
// Prevent Node.js MaxListenersExceededWarning for busy SSE endpoints
notificationEmitter.setMaxListeners(500);
