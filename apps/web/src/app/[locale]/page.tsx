import { SdgColorBar } from '@repo/design-system';
import { LOCALES, LOCALE_NAMES } from '@repo/i18n';
import { getTranslations } from 'next-intl/server';

export default async function LandingPage() {
  const t = await getTranslations('Landing');

  return (
    <main>
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-[var(--spacing-6)] pt-[var(--spacing-6)]">
        <span className="font-mono text-[var(--text-mono)] leading-[var(--text-mono--line-height)] uppercase tracking-[0.18em] text-[var(--color-text)]">
          {t('wordmark')}
        </span>
        <nav aria-label={t('languageNavLabel')}>
          <ul className="m-0 flex list-none gap-[var(--spacing-3)] p-0">
            {LOCALES.map((locale) => (
              <li key={locale} className="m-0 p-0">
                <a
                  href={`/${locale}`}
                  className="font-mono text-[var(--text-micro)] leading-[var(--text-micro--line-height)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] no-underline"
                  hrefLang={locale}
                  aria-label={LOCALE_NAMES[locale]}
                >
                  {locale}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section className="mx-auto max-w-[1200px] px-[var(--spacing-6)] pt-[var(--spacing-16)] pb-[var(--spacing-12)]">
        <h1 className="m-0 max-w-[18ch] text-[var(--text-display)] leading-[var(--text-display--line-height)] font-medium tracking-tight text-[var(--color-text)]">
          {t('hero')}
        </h1>
        <p className="mt-[var(--spacing-6)] m-0 max-w-[60ch] text-[var(--text-h4)] leading-[var(--text-h4--line-height)] text-[var(--color-text-muted)]">
          {t('subhero')}
        </p>
        <p className="mt-[var(--spacing-8)] m-0">
          <a
            href="/en"
            className="inline-flex items-center gap-[var(--spacing-2)] px-[var(--spacing-4)] py-[var(--spacing-3)] no-underline border border-[var(--color-text)] text-[var(--color-text)] font-mono text-[var(--text-mono)] leading-[var(--text-mono--line-height)] uppercase tracking-[0.18em] transition-colors hover:bg-[var(--color-text)] hover:text-[var(--color-paper)]"
            style={{
              borderRadius: 'var(--radius-xs)',
              transitionDuration: 'var(--duration-base)',
              transitionTimingFunction: 'var(--ease-out)',
            }}
          >
            {t('cta')}
          </a>
        </p>
      </section>

      <section className="mx-auto max-w-[1200px] px-[var(--spacing-6)] py-[var(--spacing-12)]">
        <h2 className="m-0 mb-[var(--spacing-6)] font-mono text-[var(--text-mono)] leading-[var(--text-mono--line-height)] uppercase tracking-wider text-[var(--color-text-muted)]">
          {t('whatItIsHeading')}
        </h2>
        <div className="grid gap-[var(--spacing-8)] md:grid-cols-2">
          <p className="m-0 max-w-[60ch] text-[var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text)]">
            {t('whatItIsP1')}
          </p>
          <p className="m-0 max-w-[60ch] text-[var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text)]">
            {t('whatItIsP2')}
          </p>
        </div>
      </section>

      <section className="py-[var(--spacing-12)]">
        <div className="mx-auto max-w-[1200px] px-[var(--spacing-6)]">
          <h2 className="m-0 mb-[var(--spacing-6)] font-mono text-[var(--text-mono)] leading-[var(--text-mono--line-height)] uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('goalsHeading')}
          </h2>
        </div>
        <div className="w-full">
          <SdgColorBar />
        </div>
      </section>

      <footer className="mx-auto max-w-[1200px] px-[var(--spacing-6)] py-[var(--spacing-12)] border-t border-[var(--color-border)] grid gap-[var(--spacing-6)] md:grid-cols-3">
        <p className="m-0 font-mono text-[var(--text-micro)] leading-[var(--text-micro--line-height)] text-[var(--color-text-muted)]">
          {t('footerLicense')}
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-[var(--spacing-4)] p-0">
          <li className="m-0 p-0">
            <a
              href="/docs"
              className="font-mono text-[var(--text-micro)] leading-[var(--text-micro--line-height)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] no-underline"
            >
              {t('footerDocs')}
            </a>
          </li>
          <li className="m-0 p-0">
            <a
              href="/governance"
              className="font-mono text-[var(--text-micro)] leading-[var(--text-micro--line-height)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] no-underline"
            >
              {t('footerGovernance')}
            </a>
          </li>
        </ul>
        <p className="m-0">
          <a
            href="https://github.com/earthropy/earthropy"
            className="font-mono text-[var(--text-micro)] leading-[var(--text-micro--line-height)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] no-underline"
          >
            {t('footerSource')}
          </a>
        </p>
      </footer>
    </main>
  );
}
