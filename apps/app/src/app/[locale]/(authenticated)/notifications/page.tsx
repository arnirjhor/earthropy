/**
 * /notifications — no-JS fallback page listing all notifications.
 *
 * Server component; fetches the last 50 notifications for the current user.
 * Mark-all-as-read is a form POST server action.
 */
import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { notifications } from '@repo/database/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { markAllAsReadAction } from '../_actions/notifications.ts';

function kindLabel(kind: string): string {
  switch (kind) {
    case 'post_published':
      return 'Post published';
    case 'post_held':
      return 'Post held for review';
    case 'post_rejected':
      return 'Post rejected';
    case 'comment_reply':
      return 'New comment reply';
    case 'group_invite':
      return 'Group invitation';
    case 'moderation_assigned':
      return 'Moderation assigned';
    case 'appeal_resolved':
      return 'Appeal resolved';
    case 'mention':
      return 'You were mentioned';
    default:
      return kind;
  }
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('Notifications');

  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) redirect(`/${locale}/signin`);

  const user = await getSession(sessionId);
  if (!user) redirect(`/${locale}/signin`);

  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const hasUnread = rows.some((r) => !r.readAt);

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[800px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
    >
      <header className="flex items-center justify-between mb-[var(--spacing-8)]">
        <h1 className="m-0 text-[var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
          {t('page.heading')}
        </h1>

        {hasUnread && (
          <form action={markAllAsReadAction}>
            <button
              type="submit"
              aria-label={t('page.markAll')}
              className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {t('page.markAll')}
            </button>
          </form>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="text-[var(--text-body)] text-[var(--color-text-muted)]">{t('page.empty')}</p>
      ) : (
        <ul
          aria-label={t('page.heading')}
          className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded"
        >
          {rows.map((notif) => (
            <li
              key={notif.id}
              data-testid="notification-item"
              className={`flex items-start gap-4 px-[var(--spacing-4)] py-[var(--spacing-3)] ${!notif.readAt ? 'bg-[color-mix(in_srgb,var(--color-paper),var(--color-border)_15%)]' : ''}`}
            >
              {/* Unread indicator */}
              {!notif.readAt && (
                <span
                  aria-hidden="true"
                  className="mt-2 flex-shrink-0 w-2 h-2 rounded-full bg-[var(--color-text)]"
                />
              )}
              {notif.readAt && <span className="flex-shrink-0 w-2" aria-hidden="true" />}

              <div className="flex-1 min-w-0">
                <p className="text-[var(--text-body)] text-[var(--color-text)]">
                  {kindLabel(notif.kind)}
                </p>
                <p className="text-[var(--text-body-sm)] text-[var(--color-text-muted)] font-mono mt-1">
                  {new Date(notif.createdAt).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
