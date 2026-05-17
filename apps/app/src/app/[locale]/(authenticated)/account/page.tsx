/**
 * Account page — server component.
 * Reads current user + active sessions; renders profile, sessions, notifications, danger zone.
 */

import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { sessions } from '@repo/database/schema';
import { tierOf } from '@repo/trust';
import { and, eq, gt } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { SessionRow } from './_actions/sessions.ts';
import { DangerZone } from './_danger.tsx';
import { ProfileForm } from './_form.tsx';
import { NotificationPrefs } from './_notifications.tsx';
import { SessionsList } from './_sessions.tsx';

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('Auth');

  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;

  if (!sessionId) {
    redirect(`/${locale}/signin`);
  }

  const user = await getSession(sessionId);

  if (!user) {
    redirect(`/${locale}/signin`);
  }

  // Fetch active sessions for this user
  const now = new Date();
  const sessionRows = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, now)))
    .orderBy(sessions.createdAt);

  const sessionList: SessionRow[] = sessionRows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    isCurrent: row.id === sessionId,
  }));

  const ta = t as unknown as (key: string, opts?: Record<string, unknown>) => string;
  const tier = tierOf(user.reputation);

  return (
    <main className="mx-auto max-w-[720px] px-[var(--spacing-6)] py-[var(--spacing-12)]">
      <header className="flex flex-col gap-[var(--spacing-2)] md:flex-row md:items-baseline md:justify-between mb-[var(--spacing-10)]">
        <h1 className="m-0 text-[var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
          {ta('account.heading')}
        </h1>
        <nav className="flex gap-[var(--spacing-6)]">
          <Link
            href={`/${locale}/dashboard`}
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href={`/${locale}/signout`}
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            {ta('dashboard.signOut')}
          </Link>
        </nav>
      </header>

      {/* Profile section */}
      <section aria-labelledby="section-profile" className="mb-[var(--spacing-12)]">
        <h2
          id="section-profile"
          className="mb-[var(--spacing-6)] text-[var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)] font-mono uppercase tracking-wider"
        >
          {ta('account.sections.profile')}
        </h2>

        {/* Reputation + tier row */}
        <div className="flex flex-wrap items-center gap-[var(--spacing-4)] mb-[var(--spacing-6)]">
          <span className="font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)]">
            <span className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]">
              {user.reputation}
            </span>{' '}
            rep
          </span>
          <span
            data-testid="account-tier-badge"
            className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] border border-[var(--color-border)] px-[var(--spacing-3)] py-[var(--spacing-1)]"
            style={{ fontVariant: 'small-caps' }}
            aria-label={`Reputation tier: ${tier}`}
          >
            {tier}
          </span>
          <Link
            href={`/${locale}/u/${user.handle}/reputation`}
            className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors border-b border-[var(--color-border)]"
          >
            View history
          </Link>
        </div>

        <ProfileForm displayName={user.displayName} handle={user.handle} locale={user.locale} />
      </section>

      <hr className="my-[var(--spacing-8)] border-0 border-t border-[var(--color-border)]" />

      {/* Sessions section */}
      <section aria-labelledby="section-sessions" className="mb-[var(--spacing-12)]">
        <h2
          id="section-sessions"
          className="mb-[var(--spacing-6)] text-[var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)] font-mono uppercase tracking-wider"
        >
          {ta('account.sections.sessions')}
        </h2>
        <SessionsList sessions={sessionList} />
      </section>

      <hr className="my-[var(--spacing-8)] border-0 border-t border-[var(--color-border)]" />

      {/* Notification preferences */}
      <section aria-labelledby="section-notifications" className="mb-[var(--spacing-12)]">
        <h2
          id="section-notifications"
          className="mb-[var(--spacing-6)] text-[var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)] font-mono uppercase tracking-wider"
        >
          {ta('account.sections.notifications')}
        </h2>
        <NotificationPrefs />
      </section>

      <hr className="my-[var(--spacing-8)] border-0 border-t border-[var(--color-border)]" />

      {/* Danger zone */}
      <section aria-labelledby="section-danger">
        <h2
          id="section-danger"
          className="mb-[var(--spacing-6)] text-[var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)] font-mono uppercase tracking-wider"
        >
          {ta('account.sections.danger')}
        </h2>
        <DangerZone />
      </section>
    </main>
  );
}
