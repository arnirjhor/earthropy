import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { VerifyEmailForm } from './_form.tsx';

/**
 * GET-interstitial pattern (auth.md §6.3).
 * The raw token arrives in the URL path; this page renders a "Confirm" button.
 * The POST (form submit) consumes the token. A pre-fetcher that GETs this URL
 * does NOT consume the token.
 */
export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const t = await getTranslations('Auth');

  return (
    <main id="main-content" className="w-full max-w-[400px]">
      <header className="mb-[var(--spacing-8)]">
        <Link
          href={`/${locale}`}
          className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
        >
          Earthropy
        </Link>
        <h1 className="mt-[var(--spacing-4)] text-[var(--text-h2)] leading-[var(--text-h2--line-height)] font-medium text-[var(--color-text)]">
          {t('verifyEmail.heading')}
        </h1>
        <p className="mt-[var(--spacing-2)] text-[var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
          {t('verifyEmail.description')}
        </p>
      </header>

      <VerifyEmailForm token={token} locale={locale} />
    </main>
  );
}
