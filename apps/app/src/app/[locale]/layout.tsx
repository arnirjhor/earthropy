import { SdgColorBar } from '@repo/design-system';
import { routing } from '@repo/i18n/routing';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <>
      <SdgColorBar Link={Link} />
      <NextIntlClientProvider>{children}</NextIntlClientProvider>
    </>
  );
}
