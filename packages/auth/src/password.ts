/**
 * Password hashing using Argon2id (OWASP 2024-2025 modern profile).
 * §5 of docs/architecture/auth.md.
 *
 * Parameters (64 MiB / 3 iterations / 4 parallelism) as specified in auth.md §5.2.
 * Output is a PHC string: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
 *
 * @node-rs/argon2 does not export needsRehash; we implement it by parsing
 * the PHC string (deviation logged in A-AUTH-1.md Notes).
 */
import { hash, verify } from '@node-rs/argon2';

/** Current canonical Argon2id params (auth.md §5.2). Single source of truth. */
const ARGON2_PARAMS = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
} as const;

/**
 * Hash a plaintext password using Argon2id.
 * Returns a PHC-encoded string safe to store in `users.password_hash`.
 */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_PARAMS);
}

/**
 * Verify a plaintext password against a stored PHC-encoded hash.
 * Uses the parameters embedded in the PHC string (accepts old params too).
 * Constant-time via the underlying Argon2 Rust implementation.
 */
export async function verifyPassword(plain: string, encoded: string): Promise<boolean> {
  try {
    return await verify(encoded, plain);
  } catch {
    // Malformed hash — treat as mismatch rather than crash.
    return false;
  }
}

/**
 * Returns true if the stored PHC hash was produced with params that differ
 * from the current ARGON2_PARAMS. On a successful sign-in, the caller should
 * re-hash and persist the new hash (transparent migration, auth.md §5.3).
 *
 * @node-rs/argon2 v2 does not export a needsRehash helper, so we parse the
 * PHC string ourselves. PHC format: $argon2id$v=19$m=<mem>,t=<time>,p=<par>$…
 */
export function needsRehash(encoded: string): boolean {
  try {
    // PHC: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
    const parts = encoded.split('$');
    // parts[0] = '', parts[1] = 'argon2id', parts[2] = 'v=19', parts[3] = 'm=...,t=...,p=...'
    if (parts.length < 5) return true;
    const paramStr = parts[3];
    if (!paramStr) return true;

    const params: Record<string, number> = {};
    for (const kv of paramStr.split(',')) {
      const [k, v] = kv.split('=');
      if (k && v) params[k] = Number.parseInt(v, 10);
    }

    return (
      params.m !== ARGON2_PARAMS.memoryCost ||
      params.t !== ARGON2_PARAMS.timeCost ||
      params.p !== ARGON2_PARAMS.parallelism
    );
  } catch {
    return true; // malformed → needs rehash
  }
}
