import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { MagicLinkConsumeForm } from './_form.tsx';

/**
 * Magic-link interstitial (auth.md §6.3).
 * GET renders a "Confirm sign-in" button — does NOT consume the token.
 * POST (form submit) consumes the token and creates a session.
 * This pattern defeats email pre-fetchers that GET the click URL.
 */
export default async function MagicSignInPage({
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
          {t('magicLink.heading')}
        </h1>
        <p className="mt-[var(--spacing-2)] text-[var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
          {t('magicLink.description')}
        </p>
      </header>

      <MagicLinkConsumeForm token={token} locale={locale} />

      <footer className="mt-[var(--spacing-6)] text-center text-[var(--text-body-sm)] text-[var(--color-text-muted)]">
        <Link
          href={`/${locale}/signin`}
          className="text-[var(--color-text)] underline underline-offset-2 hover:no-underline"
        >
          {t('magicLink.requestNew')}
        </Link>
      </footer>
    </main>
  );
}
