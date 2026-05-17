import type { Redis } from 'ioredis';

export type LimitResult =
  | { ok: true; remaining: number; resetSec: number }
  | { ok: false; remaining: 0; resetSec: number };

export interface LimitOpts {
  /** Redis client to use. When omitted a lazy singleton is created from REDIS_URL. */
  redis?: Redis;
  /** The rate-limit bucket key, e.g. "signin:ip:1.2.3.4" */
  key: string;
  /** Sliding window length in seconds */
  windowSec: number;
  /** Maximum number of requests allowed in the window */
  max: number;
}

/**
 * Lazy Redis singleton — created on first call so modules that import `limit`
 * but never call it don't open a connection (and tests can inject their own).
 */
let _defaultClient: Redis | undefined;

/** Build a default Redis client from env. Separated so it can be replaced in tests. */
async function buildDefaultClient(): Promise<Redis> {
  const { env } = await import('./env.ts');
  const { default: IORedisCtor } = await import('ioredis');
  return new IORedisCtor(env.REDIS_URL);
}

/** Exposed for tests: replace (or clear) the lazy singleton. */
export function _setDefaultClient(client: Redis | undefined): void {
  _defaultClient = client;
}

async function resolveClient(injected: Redis | undefined): Promise<Redis> {
  if (injected) return injected;
  if (!_defaultClient) {
    _defaultClient = await buildDefaultClient();
  }
  return _defaultClient;
}

/**
 * Increment the hit counter for `key` and check it against `max`.
 *
 * Uses a Redis pipeline (INCR + EXPIRE NX) so the TTL is set only on the
 * first hit in a window, preserving the original window boundary on
 * subsequent hits.  This is not atomic (a Lua script would be), but for
 * rate-limiting at these thresholds the pipeline approach is the accepted
 * tradeoff — worst case: one extra request sneaks through on a race.
 *
 * On Redis errors the function fails **closed** (returns `ok: false`) so a
 * Redis outage cannot be used to bypass rate limiting.
 */
export async function limit(opts: LimitOpts): Promise<LimitResult> {
  const { key, windowSec, max } = opts;

  try {
    const redis = await resolveClient(opts.redis);

    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSec, 'NX'); // set TTL only when key is brand-new
    pipeline.ttl(key);

    const results = await pipeline.exec();

    if (!results) {
      // Pipeline aborted — fail closed
      return { ok: false, remaining: 0, resetSec: windowSec };
    }

    // results: [[err, incrValue], [err, expireResult], [err, ttlValue]]
    const incrEntry = results[0];
    const ttlEntry = results[2];

    if (!incrEntry || !ttlEntry) {
      return { ok: false, remaining: 0, resetSec: windowSec };
    }

    const [incrErr, incrValue] = incrEntry;
    const [ttlErr, ttlValue] = ttlEntry;

    if (incrErr ?? ttlErr) {
      return { ok: false, remaining: 0, resetSec: windowSec };
    }

    const count = incrValue as number;
    const ttl = ttlValue as number;
    // ttl -1 means no expiry (edge case), -2 means key gone; fall back to windowSec
    const resetSec = ttl > 0 ? ttl : windowSec;

    if (count > max) {
      return { ok: false, remaining: 0, resetSec };
    }

    return { ok: true, remaining: max - count, resetSec };
  } catch {
    // Any unexpected error — fail closed
    return { ok: false, remaining: 0, resetSec: windowSec };
  }
}
