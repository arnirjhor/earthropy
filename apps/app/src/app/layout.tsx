import { direction } from '@repo/i18n';
import type { Locale } from '@repo/i18n';
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Earthropy',
  description:
    'Earth + Entropy = Earthropy. Coordinating global action on the 17 UN Sustainable Development Goals.',
};

const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'greek'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex-sans',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
});

const plexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex-sans-ar',
});

export default async function RootLayout({ children }: { children: ReactNode }) {
  // next-intl middleware sets X-NEXT-INTL-LOCALE on every request.
  const hdrs = await headers();
  const locale = (hdrs.get('X-NEXT-INTL-LOCALE') ?? 'en') as Locale;
  const dir = direction(locale);
  const fontClassNames = `${plexSans.variable} ${plexMono.variable} ${plexSansArabic.variable}`;

  return (
    <html lang={locale} dir={dir} className={fontClassNames}>
      <body>{children}</body>
    </html>
  );
}
