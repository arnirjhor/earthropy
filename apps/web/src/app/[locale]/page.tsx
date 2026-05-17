import { getTranslations } from 'next-intl/server';

export default async function LandingPage() {
  const t = await getTranslations('Landing');
  return (
    <main>
      <h1>{t('hero')}</h1>
      <p>{t('subhero')}</p>
    </main>
  );
}
