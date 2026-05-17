/**
 * Tests for password hashing (auth.md §5, §11.1).
 * These tests are CPU-bound (Argon2id); no DB required.
 */
import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from './password.ts';

describe('hashPassword / verifyPassword', () => {
  it('round-trip succeeds: hash then verify with correct plaintext', async () => {
    const plain = 'correct-horse-battery-staple-123';
    const hash = await hashPassword(plain);
    expect(await verifyPassword(plain, hash)).toBe(true);
  });

  it('returns false for wrong plaintext', async () => {
    const hash = await hashPassword('right-password-xyz');
    expect(await verifyPassword('wrong-password-xyz', hash)).toBe(false);
  });

  it('same plaintext produces different hashes (different salts)', async () => {
    const plain = 'salt-test-password-abc';
    const [a, b] = await Promise.all([hashPassword(plain), hashPassword(plain)]);
    expect(a).not.toBe(b);
  });

  it('produces a PHC-encoded Argon2id string', async () => {
    const hash = await hashPassword('phc-format-check');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).toContain('m=65536');
    expect(hash).toContain('t=3');
    expect(hash).toContain('p=4');
  });

  it('constant-time verify smoke check: correct vs wrong times within 4×', async () => {
    const plain = 'timing-smoke-test-password';
    const hash = await hashPassword(plain);

    const RUNS = 3;
    let correctTotal = 0;
    let wrongTotal = 0;

    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      await verifyPassword(plain, hash);
      correctTotal += performance.now() - t0;

      const t1 = performance.now();
      await verifyPassword('definitely-wrong', hash);
      wrongTotal += performance.now() - t1;
    }

    const correctAvg = correctTotal / RUNS;
    const wrongAvg = wrongTotal / RUNS;
    // Both paths go through Argon2 — they should be within 4× of each other.
    expect(Math.max(correctAvg, wrongAvg)).toBeLessThan(4 * Math.min(correctAvg, wrongAvg));
  });

  it('verifyPassword handles malformed hash without throwing', async () => {
    expect(await verifyPassword('any', 'not-a-valid-hash')).toBe(false);
  });
});

describe('needsRehash', () => {
  it('returns false for a hash produced with current params', async () => {
    const hash = await hashPassword('current-params-test');
    expect(needsRehash(hash)).toBe(false);
  });

  it('returns true for a malformed/invalid encoded string', () => {
    expect(needsRehash('not-a-valid-phc-string')).toBe(true);
    expect(needsRehash('')).toBe(true);
  });

  it('returns true for a hash produced with different params (lower memoryCost)', async () => {
    // Produce a hash with lower memoryCost manually via the underlying library.
    const { hash } = await import('@node-rs/argon2');
    const oldHash = await hash('old-params-test', {
      memoryCost: 19456, // OWASP minimum profile (lower than current 65536)
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
    expect(needsRehash(oldHash)).toBe(true);
  });
});
