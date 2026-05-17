/**
 * Environment variable reads for @repo/ratelimit.
 * Throws on startup if required vars are missing.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`@repo/ratelimit: Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  /** Full Redis connection URL, e.g. redis://localhost:6379 */
  REDIS_URL: required('REDIS_URL'),
  /**
   * When true the leftmost IP in X-Forwarded-For is used as the client IP.
   * Set to "true" only when the app is behind a trusted reverse-proxy.
   */
  RATE_LIMIT_PROXY_TRUST: optional('RATE_LIMIT_PROXY_TRUST', 'false') === 'true',
} as const;
