import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SignUpForm } from './_form.tsx';

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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
          {t('signup.heading')}
        </h1>
        <p className="mt-[var(--spacing-2)] text-[var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
          {t('signup.subheading')}
        </p>
      </header>

      <SignUpForm locale={locale} />

      <footer className="mt-[var(--spacing-6)] text-center text-[var(--text-body-sm)] text-[var(--color-text-muted)]">
        {t('signup.alreadyHaveAccount')}{' '}
        <Link
          href={`/${locale}/signin`}
          className="text-[var(--color-text)] underline underline-offset-2 hover:no-underline"
        >
          {t('signup.signInLink')}
        </Link>
      </footer>
    </main>
  );
}
