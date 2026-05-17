import createMiddleware from 'next-intl/middleware';
import { routing } from '@repo/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all routes except API, _next, and files with extensions.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
