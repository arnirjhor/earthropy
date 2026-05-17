/**
 * Environment variable reads for @repo/auth.
 * Throws on startup if required vars are missing.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`@repo/auth: Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  /** Used for CSRF HMAC and any future server-side signing. */
  AUTH_SECRET: required('AUTH_SECRET'),
  /** Used to hash raw IPs before storing in sessions.ip_hash. */
  IP_HASH_SECRET: optional('IP_HASH_SECRET', 'ip-hash-secret-dev'),
  NODE_ENV: optional('NODE_ENV', 'development'),
} as const;
