/**
 * Tests for CSRF helpers (auth.md §6, §11.1).
 * Pure crypto — no DB required.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { issueCsrfToken, verifyCsrfToken } from './csrf.ts';

beforeAll(() => {
  process.env.AUTH_SECRET ??= 'test-auth-secret-for-vitest-only';
});

describe('issueCsrfToken / verifyCsrfToken', () => {
  it('happy path: issued token verifies against the same sessionId', () => {
    const sessionId = 'session-id-abc123';
    const token = issueCsrfToken(sessionId);
    expect(verifyCsrfToken(sessionId, token)).toBe(true);
  });

  it('returns false for an empty submitted token', () => {
    const sessionId = 'session-abc';
    expect(verifyCsrfToken(sessionId, '')).toBe(false);
  });

  it('returns false for a tampered token', () => {
    const sessionId = 'session-def';
    const token = issueCsrfToken(sessionId);
    const tampered = `${token.slice(0, -4)}zzzz`;
    expect(verifyCsrfToken(sessionId, tampered)).toBe(false);
  });

  it('returns false for a token issued for a different sessionId (cross-session)', () => {
    const tokenForA = issueCsrfToken('session-A');
    expect(verifyCsrfToken('session-B', tokenForA)).toBe(false);
  });

  it('two different sessionIds produce different tokens', () => {
    const tokenA = issueCsrfToken('session-1');
    const tokenB = issueCsrfToken('session-2');
    expect(tokenA).not.toBe(tokenB);
  });

  it('returns false when submitted token has wrong length', () => {
    const sessionId = 'session-length-check';
    // Submit a shorter token (not the same length as the HMAC hex output)
    expect(verifyCsrfToken(sessionId, 'short')).toBe(false);
  });

  it('constant-time compare smoke check: correct and wrong paths have similar timing', () => {
    const sessionId = 'timing-session';
    const correct = issueCsrfToken(sessionId);
    const wrong = 'a'.repeat(correct.length); // same length, wrong value

    const RUNS = 100;
    let correctTotal = 0;
    let wrongTotal = 0;

    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      verifyCsrfToken(sessionId, correct);
      correctTotal += performance.now() - t0;

      const t1 = performance.now();
      verifyCsrfToken(sessionId, wrong);
      wrongTotal += performance.now() - t1;
    }

    const correctAvg = correctTotal / RUNS;
    const wrongAvg = wrongTotal / RUNS;

    // Both paths hit timingSafeEqual; should be within 10× of each other in practice.
    // We use a generous bound to avoid flakiness in CI.
    expect(Math.max(correctAvg, wrongAvg)).toBeLessThan(10 * Math.min(correctAvg, wrongAvg) + 0.01);
  });
});
