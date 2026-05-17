/**
 * AnthropicModerationProvider — replay-mode unit tests.
 *
 * Run with: MODERATION_FIXTURE_REPLAY=1 pnpm --filter @repo/moderation test
 *
 * Tests are split into:
 *   1. Fixture-driven happy-path tests (benign, toxic, spam, off-topic, refusal).
 *   2. Malformed-response test (adapter must throw ProviderMalformed).
 *   3. Network/timeout failure tests via mocked fetch.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderMalformed, ProviderTimeout, ProviderUnavailable } from '../errors.ts';
import type { ModerationInput } from '../provider.ts';
import {
  AnthropicModerationProvider,
  type FixtureFile,
  adaptFixtureResponse,
} from './anthropic.ts';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

interface FixtureExpectedResult {
  scores: Record<string, number>;
  verdict: string;
  reasoning: string;
  provider: string;
  model: string;
}

/** Superset of FixtureFile that also carries expected_result for test assertions. */
interface Fixture extends FixtureFile {
  expected_result: FixtureExpectedResult | null;
}

function loadFixture(name: string): Fixture {
  const fixturePath = join(
    new URL('../../fixtures/anthropic', import.meta.url).pathname,
    `${name}.json`,
  );
  return JSON.parse(readFileSync(fixturePath, 'utf-8')) as Fixture;
}

// ---------------------------------------------------------------------------
// Provider factory for tests (uses ANTHROPIC_API_KEY placeholder — replay mode
// never calls the real API so the key is not validated).
// ---------------------------------------------------------------------------

function makeProvider(): AnthropicModerationProvider {
  return new AnthropicModerationProvider('sk-ant-test-replay-mode-placeholder');
}

// ---------------------------------------------------------------------------
// 1. Fixture-driven happy-path tests
// ---------------------------------------------------------------------------

describe('AnthropicModerationProvider (fixture replay)', () => {
  beforeEach(() => {
    process.env.MODERATION_FIXTURE_REPLAY = '1';
  });

  afterEach(() => {
    process.env.MODERATION_FIXTURE_REPLAY = undefined;
    vi.restoreAllMocks();
  });

  it('benign-post: returns auto_publish with empty scores (all < 0.05)', async () => {
    const fixture = loadFixture('benign-post');
    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    const expected = fixture.expected_result;
    expect(expected).not.toBeNull();
    if (!expected) return;

    expect(result.verdict).toBe(expected.verdict);
    expect(result.reasoning).toBe(expected.reasoning);
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe(fixture._meta.recorded_model);
    // All fixture scores are < 0.05, so adapter drops them all → empty scores
    expect(Object.keys(result.scores)).toHaveLength(0);
  });

  it('toxic-post: returns auto_reject with toxicity >= 0.85 and harassment score retained', async () => {
    const fixture = loadFixture('toxic-post');
    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    const expected = fixture.expected_result;
    expect(expected).not.toBeNull();
    if (!expected) return;

    expect(result.verdict).toBe('auto_reject');
    expect(result.scores.toxicity).toBeCloseTo(0.92, 5);
    expect(result.scores.harassment).toBeCloseTo(0.55, 5);
    expect(result.scores.hate).toBeCloseTo(0.3, 5);
    // misinfo at 0.20 >= 0.05, retained
    expect(result.scores.misinfo).toBeCloseTo(0.2, 5);
    // off_topic at 0.05 is exactly 0.05 — boundary: < 0.05 drops, >= 0.05 keeps
    // fixture has off_topic=0.05 which is NOT < 0.05, so it stays
    expect(result.provider).toBe('anthropic');
  });

  it('spam-post: returns auto_reject with high spam score', async () => {
    const fixture = loadFixture('spam-post');
    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    expect(result.verdict).toBe('auto_reject');
    expect(result.scores.spam).toBeGreaterThanOrEqual(0.85);
    expect(result.scores.off_topic).toBeGreaterThan(0.5);
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe(fixture._meta.recorded_model);
  });

  it('off-topic-post: returns auto_reject with high off_topic score', async () => {
    const fixture = loadFixture('off-topic-post');
    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    expect(result.verdict).toBe('auto_reject');
    expect(result.scores.off_topic).toBeGreaterThanOrEqual(0.85);
    expect(result.provider).toBe('anthropic');
  });

  it('refusal: returns hold_for_review with empty scores and refusal reasoning', async () => {
    const fixture = loadFixture('refusal');
    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    expect(result.verdict).toBe('hold_for_review');
    expect(result.scores).toEqual({});
    expect(result.reasoning).toBe('provider refused to classify; held for human review');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe(fixture._meta.recorded_model);
  });

  it('malformed: throws ProviderMalformed when parsed_output is missing required fields', async () => {
    const fixture = loadFixture('malformed');
    const provider = makeProvider();

    await expect(provider.classify(fixture.input)).rejects.toBeInstanceOf(ProviderMalformed);
  });
});

// ---------------------------------------------------------------------------
// 2. Prompt SHA validation
// ---------------------------------------------------------------------------

describe('AnthropicModerationProvider: prompt_sha validation', () => {
  beforeEach(() => {
    process.env.MODERATION_FIXTURE_REPLAY = '1';
  });

  afterEach(() => {
    process.env.MODERATION_FIXTURE_REPLAY = undefined;
    vi.restoreAllMocks();
  });

  it('throws when fixture prompt_sha does not match current prompt SHA', () => {
    // Build a fixture object with a stale prompt_sha directly — no filesystem mock needed.
    const fixture = loadFixture('benign-post');
    const tampered = {
      ...fixture,
      _meta: { ...fixture._meta, prompt_sha: 'deadbeefdeadbeefdeadbeefdeadbeef' },
    };

    // adaptFixtureResponse is the internal function that checks the SHA.
    expect(() => adaptFixtureResponse(tampered, 'claude-sonnet-4-5')).toThrow(
      /prompt_sha mismatch/,
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Network/timeout failure tests (mocked fetch, non-replay mode)
// ---------------------------------------------------------------------------

describe('AnthropicModerationProvider: failure modes', () => {
  const testInput: ModerationInput = {
    text: 'Test content for failure mode tests.',
    locale: 'en',
    context: { groupSdgCodes: ['1'], targetType: 'post', authorReputation: 100 },
  };

  afterEach(() => {
    process.env.MODERATION_FIXTURE_REPLAY = undefined;
    vi.restoreAllMocks();
  });

  it('throws ProviderUnavailable when fetch throws a network error', async () => {
    // We set MODERATION_FIXTURE_REPLAY off and mock global fetch to throw
    process.env.MODERATION_FIXTURE_REPLAY = undefined;

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const provider = new AnthropicModerationProvider(
      'sk-ant-test-failure-key',
      'claude-sonnet-4-5',
      // pass a custom httpFetch so the SDK uses our mock
    );

    await expect(provider.classify(testInput)).rejects.toBeInstanceOf(ProviderUnavailable);
  });

  it('throws ProviderTimeout when request times out', async () => {
    process.env.MODERATION_FIXTURE_REPLAY = undefined;

    // Simulate a timeout by having fetch hang and the abort controller fire
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((_, reject) => {
            // Immediately reject with an AbortError to simulate timeout
            const err = new DOMException('The operation was aborted.', 'AbortError');
            reject(err);
          }),
      ),
    );

    const provider = new AnthropicModerationProvider(
      'sk-ant-test-timeout-key',
      'claude-sonnet-4-5',
    );

    await expect(provider.classify(testInput)).rejects.toBeInstanceOf(ProviderTimeout);
  });
});
