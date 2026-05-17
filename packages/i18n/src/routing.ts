import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from './locales.ts';

// Shared next-intl routing. Each Next.js app imports this and creates its own
// middleware via `createMiddleware(routing)` so URL conventions stay consistent
// across apps/app, apps/web, and apps/docs.
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
});
