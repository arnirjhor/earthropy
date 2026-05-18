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
      <body>
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4 focus-visible:z-[9999] focus-visible:inline-flex focus-visible:items-center focus-visible:px-4 focus-visible:py-2 focus-visible:bg-[var(--color-text)] focus-visible:text-[var(--color-paper)] focus-visible:font-mono focus-visible:text-sm focus-visible:uppercase focus-visible:tracking-wider focus-visible:rounded-[var(--radius-xs)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
