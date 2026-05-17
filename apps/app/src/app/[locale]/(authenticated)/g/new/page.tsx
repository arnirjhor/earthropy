import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CreateGroupForm } from './_form.tsx';

export default async function NewGroupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('GroupCreate');

  return (
    <main className="mx-auto max-w-[640px] px-[var(--spacing-6)] py-[var(--spacing-12)]">
      <header className="mb-[var(--spacing-8)]">
        <Link
          href={`/${locale}/dashboard`}
          className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
        >
          Earthropy
        </Link>
        <h1 className="mt-[var(--spacing-4)] text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] font-medium text-[var(--color-text)]">
          {t('heading')}
        </h1>
        <p className="mt-[var(--spacing-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
          {t('subheading')}
        </p>
      </header>

      <CreateGroupForm locale={locale} />
    </main>
  );
}
