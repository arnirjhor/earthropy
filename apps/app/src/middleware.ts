/**
 * Next.js middleware: compose next-intl locale routing with auth gating.
 *
 * next-intl middleware runs first (locale detection + redirects).
 * Auth check follows: if a request targets an (authenticated) route without
 * a session cookie, redirect to /<locale>/signin?next=<path>.
 *
 * auth.md §9: "Session missing/expired on a gated route → 303 to /signin?next=<path>".
 */

import { routing } from '@repo/i18n/routing';
import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createIntlMiddleware(routing);

/** URL path segments that require an authenticated session. */
const AUTHENTICATED_PATH_SEGMENTS = ['/dashboard', '/account', '/group', '/post'];

function isAuthenticatedPath(pathname: string): boolean {
  // Strip the locale prefix (e.g. /en/dashboard → /dashboard)
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '');
  return AUTHENTICATED_PATH_SEGMENTS.some(
    (seg) => withoutLocale === seg || withoutLocale.startsWith(`${seg}/`),
  );
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  // 1. Run next-intl middleware (locale detection, redirects).
  const intlResponse = intlMiddleware(request);

  // If next-intl issued a redirect/rewrite, honour it first.
  if (intlResponse.status !== 200) {
    return intlResponse;
  }

  // 2. Auth gate for (authenticated) routes.
  const { pathname } = request.nextUrl;

  if (isAuthenticatedPath(pathname)) {
    const sessionCookie = request.cookies.get('earthropy_session');

    if (!sessionCookie?.value) {
      // Derive locale from the path prefix (fallback to 'en').
      const localeMatch = pathname.match(/^\/([a-z]{2}(-[A-Z]{2})?)\//);
      const locale = localeMatch?.[1] ?? 'en';

      const signinUrl = new URL(`/${locale}/signin`, request.url);
      signinUrl.searchParams.set('next', pathname);

      return NextResponse.redirect(signinUrl, 303);
    }
  }

  return intlResponse;
}

export const config = {
  // Match all routes except API, _next, and files with extensions.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
