'use server';

/**
 * Server Actions for notification read state.
 */

import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { notifications } from '@repo/database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';

async function requireUser() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

/** Mark a single notification as read. */
export async function markAsReadAction(notificationId: string): Promise<void> {
  const user = await requireUser();
  if (!user) return;

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, user.id),
        isNull(notifications.readAt),
      ),
    );
}

/** Mark all unread notifications for the current user as read. */
export async function markAllAsReadAction(): Promise<void> {
  const user = await requireUser();
  if (!user) return;

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
}
