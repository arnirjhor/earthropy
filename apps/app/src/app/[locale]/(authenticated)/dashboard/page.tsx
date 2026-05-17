import { getSession } from '@repo/auth';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('Auth');

  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  const user = sessionId ? await getSession(sessionId) : null;

  return (
    <main className="mx-auto max-w-[1200px] px-[var(--spacing-6)] py-[var(--spacing-12)]">
      <header className="flex flex-col gap-[var(--spacing-2)] md:flex-row md:items-baseline md:justify-between">
        <h1 className="m-0 text-[var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]">
          {t('dashboard.welcome', { name: user?.displayName ?? t('dashboard.defaultName') })}
        </h1>
        <nav>
          <Link
            href={`/${locale}/signout`}
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            {t('dashboard.signOut')}
          </Link>
        </nav>
      </header>

      <hr className="my-[var(--spacing-8)] border-0 border-t border-[var(--color-border)]" />

      <p className="text-[var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]">
        {t('dashboard.placeholder')}
      </p>
    </main>
  );
}
