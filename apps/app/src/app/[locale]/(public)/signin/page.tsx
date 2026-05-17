import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SignInForm } from './_form.tsx';

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('Auth');

  return (
    <main className="w-full max-w-[400px]">
      <header className="mb-[var(--spacing-8)]">
        <Link
          href={`/${locale}`}
          className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
        >
          Earthropy
        </Link>
        <h1 className="mt-[var(--spacing-4)] text-[var(--text-h2)] leading-[var(--text-h2--line-height)] font-medium text-[var(--color-text)]">
          {t('signin.heading')}
        </h1>
      </header>

      <SignInForm locale={locale} />

      <footer className="mt-[var(--spacing-6)] flex flex-col gap-[var(--spacing-3)] text-center text-[var(--text-body-sm)] text-[var(--color-text-muted)]">
        <div>
          <Link
            href={`/${locale}/forgot-password`}
            className="text-[var(--color-text)] underline underline-offset-2 hover:no-underline"
          >
            {t('signin.forgotPassword')}
          </Link>
        </div>
        <div>
          {t('signin.noAccount')}{' '}
          <Link
            href={`/${locale}/signup`}
            className="text-[var(--color-text)] underline underline-offset-2 hover:no-underline"
          >
            {t('signin.signUpLink')}
          </Link>
        </div>
      </footer>
    </main>
  );
}
