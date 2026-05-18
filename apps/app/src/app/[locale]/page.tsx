import { SdgChip } from '@repo/design-system';
import { SDGS } from '@repo/sdg';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function HomePage() {
  const t = await getTranslations('Home');
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1200px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
    >
      <header className="flex flex-col gap-[var(--spacing-2)] md:flex-row md:items-baseline md:justify-between">
        <h1 className="m-0 text-[var(--text-display)] leading-[var(--text-display--line-height)] font-medium tracking-tight">
          {t('title')}
        </h1>
        <span className="font-mono text-[var(--text-mono)] leading-[var(--text-mono--line-height)] uppercase tracking-wider text-[var(--color-text-muted)]">
          {t('caption')}
        </span>
      </header>

      <hr className="my-[var(--spacing-8)] border-0 border-t border-[var(--color-border)]" />

      <div className="grid gap-[var(--spacing-12)] md:grid-cols-5">
        <section aria-label={t('sdgListLabel')} className="md:col-span-3">
          <h2 className="m-0 mb-[var(--spacing-4)] font-mono text-[var(--text-mono)] leading-[var(--text-mono--line-height)] uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('sdgListLabel')}
          </h2>
          <ul className="grid grid-cols-1 gap-[var(--spacing-2)] m-0 p-0 list-none sm:grid-cols-2">
            {SDGS.map((sdg) => (
              <li key={sdg.id} className="m-0 p-0">
                <Link
                  href={`/sdg/${sdg.code}`}
                  className="block no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
                >
                  <SdgChip sdg={sdg.id} size="md" withName />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="md:col-span-2">
          <p className="m-0 max-w-[60ch] text-[var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text)]">
            {t('mission')}
          </p>
          <p className="mt-[var(--spacing-4)] m-0 font-mono text-[var(--text-mono)] leading-[var(--text-mono--line-height)] uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('missionAttribution')}
          </p>
        </aside>
      </div>

      <footer className="mt-[var(--spacing-16)] pt-[var(--spacing-6)] border-t border-[var(--color-border)] font-mono text-[var(--text-micro)] leading-[var(--text-micro--line-height)] text-[var(--color-text-muted)]">
        {t('footer')}
      </footer>
    </main>
  );
}
