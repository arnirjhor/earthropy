import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function CheckYourEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('Auth');

  return (
    <main id="main-content" className="w-full max-w-[400px] text-center">
      <header className="mb-[var(--spacing-8)]">
        <Link
          href={`/${locale}`}
          className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
        >
          Earthropy
        </Link>
      </header>

      <div
        className="w-16 h-16 mx-auto mb-[var(--spacing-6)] rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center"
        aria-hidden="true"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-text-muted)]"
          aria-hidden="true"
        >
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </div>

      <h1 className="text-[var(--text-h2)] leading-[var(--text-h2--line-height)] font-medium text-[var(--color-text)] mb-[var(--spacing-4)]">
        {t('checkYourEmail.heading')}
      </h1>
      <p className="text-[var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)] max-w-[40ch] mx-auto">
        {t('checkYourEmail.description')}
      </p>

      <footer className="mt-[var(--spacing-8)] text-[var(--text-body-sm)] text-[var(--color-text-muted)]">
        {t('checkYourEmail.wrongEmail')}{' '}
        <Link
          href={`/${locale}/signin`}
          className="text-[var(--color-text)] underline underline-offset-2 hover:no-underline"
        >
          {t('checkYourEmail.tryAgain')}
        </Link>
      </footer>
    </main>
  );
}
