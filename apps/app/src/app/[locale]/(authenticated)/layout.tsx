/**
 * (authenticated) route group layout.
 * Auth gating is handled in proxy.ts before this renders.
 * Mounts NotificationsBell in the top-right corner of every authenticated page.
 */
import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { notifications } from '@repo/database/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { NotificationsBell } from './_shell/NotificationsBell.tsx';

async function getInitialNotifications(userId: string) {
  return db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(10);
}

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  const user = sessionId ? await getSession(sessionId) : null;

  const initialNotifications = user ? await getInitialNotifications(user.id) : [];

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      {/* Notifications bell — fixed top-right */}
      {user && (
        <div className="fixed top-3 end-4 z-40">
          <NotificationsBell initialNotifications={initialNotifications} />
        </div>
      )}
      {children}
    </div>
  );
}
