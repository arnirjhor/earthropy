import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ResetPasswordForm } from './_form.tsx';

export default async function ResetPasswordPage({
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
          {t('resetPassword.heading')}
        </h1>
        <p className="mt-[var(--spacing-2)] text-[var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
          {t('resetPassword.description')}
        </p>
      </header>

      <ResetPasswordForm token={token} locale={locale} />
    </main>
  );
}
