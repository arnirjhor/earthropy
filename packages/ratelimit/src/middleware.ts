/**
 * Next.js helpers for rate limiting.
 *
 * `withRateLimit`   — wraps an API Route handler (pages or app router route handler).
 * `rateLimitAction` — guards a Server Action; throws a typed error on 429.
 */

import type { Redis } from 'ioredis';
import { limit } from './limit.ts';

// ─── types ────────────────────────────────────────────────────────────────────

export interface RateLimitOpts {
  /** Rate-limit bucket prefix, e.g. "signin:ip". The IP will be appended as ":<ip>". */
  key: string;
  /** Sliding window length in seconds */
  windowSec: number;
  /** Maximum number of requests allowed in the window */
  max: number;
  /**
   * When true the leftmost value in `X-Forwarded-For` is used as the client IP.
   * Only set to true when the application is behind a trusted reverse-proxy.
   * Defaults to false (uses the socket remote address).
   */
  trustProxy?: boolean;
  /** Redis client override — useful in tests. Falls back to the lazy singleton. */
  redis?: Redis;
}

export class RateLimitError extends Error {
  readonly retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super(`Rate limit exceeded. Retry after ${retryAfterSec}s.`);
    this.name = 'RateLimitError';
    this.retryAfterSec = retryAfterSec;
  }
}

// ─── IP extraction ────────────────────────────────────────────────────────────

/**
 * Extract a best-effort client IP from an incoming request.
 *
 * When `trustProxy` is true, returns the leftmost (client) IP from
 * `X-Forwarded-For`.  Otherwise returns the value of the `x-real-ip` header
 * or the literal string "unknown" (safe fallback — all "unknown" requests
 * share a single bucket, which is still better than bypassing the limit).
 */
export function extractIp(
  headers: Record<string, string | string[] | undefined>,
  trustProxy = false,
): string {
  if (trustProxy) {
    const xff = headers['x-forwarded-for'];
    if (xff) {
      const raw = Array.isArray(xff) ? xff[0] : xff;
      const first = raw?.split(',')[0]?.trim();
      if (first) return first;
    }
  }

  const realIp = headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? (realIp[0] ?? 'unknown') : realIp;
  }

  return 'unknown';
}

// ─── withRateLimit ────────────────────────────────────────────────────────────

/**
 * Wrap a Next.js App Router route handler (or pages-router API handler).
 *
 * The wrapped handler receives the same arguments and returns the same type.
 * A 429 response with `Retry-After` and `X-RateLimit-*` headers is returned
 * when the limit is exceeded.
 *
 * Usage (App Router):
 * ```ts
 * export const POST = withRateLimit(
 *   async (req) => { ... },
 *   { key: 'signin:ip', windowSec: 900, max: 10, trustProxy: true },
 * );
 * ```
 */
export function withRateLimit<TArgs extends [Request, ...unknown[]]>(
  handler: (...args: TArgs) => Promise<Response>,
  opts: RateLimitOpts,
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs): Promise<Response> => {
    const req = args[0];
    const headersObj = Object.fromEntries(req.headers.entries());
    const ip = extractIp(headersObj, opts.trustProxy);
    const bucketKey = `${opts.key}:${ip}`;

    const result = await limit({
      key: bucketKey,
      windowSec: opts.windowSec,
      max: opts.max,
      redis: opts.redis,
    });

    if (!result.ok) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfterSec: result.resetSec,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.resetSec),
            'X-RateLimit-Limit': String(opts.max),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + result.resetSec),
          },
        },
      );
    }

    // Delegate to the actual handler
    const response = await handler(...args);

    // Annotate successful responses with remaining-budget headers
    const mutable = new Response(response.body, response);
    mutable.headers.set('X-RateLimit-Limit', String(opts.max));
    mutable.headers.set('X-RateLimit-Remaining', String(result.remaining));
    mutable.headers.set(
      'X-RateLimit-Reset',
      String(Math.floor(Date.now() / 1000) + result.resetSec),
    );
    return mutable;
  };
}

// ─── rateLimitAction ─────────────────────────────────────────────────────────

/**
 * Guard a Next.js Server Action.
 *
 * Call at the top of any Server Action that should be rate-limited. Throws
 * `RateLimitError` when the budget is exhausted; the caller can catch it and
 * return a typed error object to the client.
 *
 * The IP is read from Next.js `headers()` automatically.
 * Pass `redis` to inject a test client.
 *
 * Usage:
 * ```ts
 * export async function signInAction(formData: FormData) {
 *   'use server';
 *   await rateLimitAction({ key: 'signin:ip', windowSec: 900, max: 10 });
 *   // ... rest of action
 * }
 * ```
 */
export async function rateLimitAction(opts: RateLimitOpts): Promise<void> {
  // next/headers is only available in a Next.js server context.
  // Dynamic import keeps this module importable outside Next.js (e.g., tests).
  let ip = 'unknown';
  try {
    const { headers } = await import('next/headers');
    const headerStore = await headers();
    const headersObj: Record<string, string | undefined> = {};
    headerStore.forEach((value, key) => {
      headersObj[key] = value;
    });
    ip = extractIp(headersObj, opts.trustProxy ?? false);
  } catch {
    // Outside Next.js context (e.g., unit tests) — use "unknown"
  }

  const bucketKey = `${opts.key}:${ip}`;

  const result = await limit({
    key: bucketKey,
    windowSec: opts.windowSec,
    max: opts.max,
    redis: opts.redis,
  });

  if (!result.ok) {
    throw new RateLimitError(result.resetSec);
  }
}
