import { getTranslations } from 'next-intl/server';
import { SDGS } from '@repo/sdg';

export default async function HomePage() {
  const t = await getTranslations('Home');
  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <ul aria-label={t('sdgListLabel')}>
        {SDGS.map((sdg) => (
          <li
            key={sdg.id}
            style={{
              background: `var(--sdg-${sdg.id})`,
              color: sdg.onColor,
              padding: '0.5rem 0.75rem',
              margin: '0.25rem 0',
            }}
          >
            {sdg.id}. {sdg.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
