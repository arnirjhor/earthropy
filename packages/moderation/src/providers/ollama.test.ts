/**
 * OllamaModerationProvider — replay-mode unit tests.
 *
 * Run with: MODERATION_FIXTURE_REPLAY=1 pnpm --filter @repo/moderation test
 *
 * Tests cover:
 *   1. Fixture-driven scenarios: benign / toxic (S1) / hate (S10+S11) /
 *      spam (aux) / off_topic (aux) / refusal (malformed guard response).
 *   2. Aux-disabled scenario: OLLAMA_AUX_MODEL=none omits spam/misinfo/off_topic.
 *   3. Network/timeout failure modes via mocked fetch.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderTimeout, ProviderUnavailable } from '../errors.ts';
import type { ModerationInput } from '../provider.ts';
import { OllamaModerationProvider } from './ollama.ts';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

interface OllamaFixtureMeta {
  scenario: string;
  recorded_at: string;
  recorded_model: string;
  prompt_sha: string;
  note?: string;
}

interface OllamaFixtureRawResponse {
  guard_response: string;
  aux_response: Record<string, number> | null;
}

interface OllamaFixtureExpectedResult {
  scores: Record<string, number>;
  verdict: string;
  provider: string;
  model: string;
}

interface OllamaFixture {
  _meta: OllamaFixtureMeta;
  input: ModerationInput;
  raw_response: OllamaFixtureRawResponse;
  expected_result: OllamaFixtureExpectedResult;
}

function loadFixture(name: string): OllamaFixture {
  const fixturePath = join(
    new URL('../../fixtures/ollama', import.meta.url).pathname,
    `${name}.json`,
  );
  return JSON.parse(readFileSync(fixturePath, 'utf-8')) as OllamaFixture;
}

// ---------------------------------------------------------------------------
// Provider factory for tests
// ---------------------------------------------------------------------------

function makeProvider(auxModel?: string): OllamaModerationProvider {
  return new OllamaModerationProvider(
    'http://localhost:11434',
    'llama-guard3:8b',
    auxModel ?? 'llama3.1:8b',
  );
}

// ---------------------------------------------------------------------------
// Replay mode mock: intercepts fetch calls and returns fixture data.
// The Ollama provider makes two sequential fetch calls (guard + aux).
// We track call count so we can return the right response for each pass.
// ---------------------------------------------------------------------------

function mockFetchFromFixture(fixture: OllamaFixture, auxModel: string | null = 'llama3.1:8b') {
  let callCount = 0;

  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => {
      callCount++;
      const isAuxCall = callCount === 2;

      // Guard pass response shape: Ollama /api/generate → { response: string }
      if (!isAuxCall) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              model: 'llama-guard3:8b',
              response: fixture.raw_response.guard_response,
              done: true,
            }),
        } as Response);
      }

      // Aux pass response shape: Ollama /api/chat (JSON mode) → { message: { content: string } }
      const auxData = fixture.raw_response.aux_response;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            model: auxModel ?? 'llama3.1:8b',
            message: {
              content: auxData !== null ? JSON.stringify(auxData) : '{}',
            },
            done: true,
          }),
      } as Response);
    }),
  );
}

// ---------------------------------------------------------------------------
// 1. Fixture-driven happy-path tests
// ---------------------------------------------------------------------------

describe('OllamaModerationProvider (fixture replay)', () => {
  beforeEach(() => {
    process.env.MODERATION_FIXTURE_REPLAY = '1';
  });

  afterEach(() => {
    process.env.MODERATION_FIXTURE_REPLAY = undefined;
    process.env.OLLAMA_AUX_MODEL = undefined;
    vi.restoreAllMocks();
  });

  it('benign-post: returns auto_publish with empty scores (all < 0.05)', async () => {
    const fixture = loadFixture('benign-post');
    mockFetchFromFixture(fixture);

    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    expect(result.verdict).toBe('auto_publish');
    expect(Object.keys(result.scores)).toHaveLength(0);
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('llama-guard3:8b');
  });

  it('toxic-post (S1): sets violence=0.9, returns auto_reject', async () => {
    const fixture = loadFixture('toxic-post');
    mockFetchFromFixture(fixture);

    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    expect(result.verdict).toBe('auto_reject');
    expect(result.scores.violence).toBeCloseTo(0.9, 5);
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('llama-guard3:8b');
  });

  it('hate-post (S10, S11): sets hate=0.9 and self_harm=0.9, returns auto_reject', async () => {
    const fixture = loadFixture('hate-post');
    mockFetchFromFixture(fixture);

    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    expect(result.verdict).toBe('auto_reject');
    expect(result.scores.hate).toBeCloseTo(0.9, 5);
    expect(result.scores.self_harm).toBeCloseTo(0.9, 5);
    expect(result.provider).toBe('ollama');
  });

  it('spam-post: guard says safe; aux returns high spam, returns auto_reject', async () => {
    const fixture = loadFixture('spam-post');
    mockFetchFromFixture(fixture);

    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    expect(result.verdict).toBe('auto_reject');
    expect(result.scores.spam).toBeGreaterThanOrEqual(0.85);
    expect(result.scores.off_topic).toBeGreaterThan(0.5);
    expect(result.provider).toBe('ollama');
  });

  it('off-topic-post: guard says safe; aux returns high off_topic, returns auto_reject', async () => {
    const fixture = loadFixture('off-topic-post');
    mockFetchFromFixture(fixture);

    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    expect(result.verdict).toBe('auto_reject');
    expect(result.scores.off_topic).toBeGreaterThanOrEqual(0.85);
    expect(result.provider).toBe('ollama');
  });

  it('refusal: malformed guard response → hold_for_review with empty scores', async () => {
    const fixture = loadFixture('refusal');
    mockFetchFromFixture(fixture);

    const provider = makeProvider();
    const result = await provider.classify(fixture.input);

    expect(result.verdict).toBe('hold_for_review');
    expect(result.scores).toEqual({});
    expect(result.reasoning).toMatch(/malformed|parse|held for human review/i);
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('llama-guard3:8b');
  });

  it('aux-disabled: OLLAMA_AUX_MODEL=none → spam/misinfo/off_topic absent from scores', async () => {
    const fixture = loadFixture('aux-disabled');
    // Only one fetch call is made (guard only), no aux call
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            model: 'llama-guard3:8b',
            response: fixture.raw_response.guard_response,
            done: true,
          }),
      } as Response),
    );

    process.env.OLLAMA_AUX_MODEL = 'none';
    const provider = new OllamaModerationProvider(
      'http://localhost:11434',
      'llama-guard3:8b',
      'none',
    );
    const result = await provider.classify(fixture.input);

    expect(result.scores.spam).toBeUndefined();
    expect(result.scores.misinfo).toBeUndefined();
    expect(result.scores.off_topic).toBeUndefined();
    expect(result.provider).toBe('ollama');
  });
});

// ---------------------------------------------------------------------------
// 2. Network/timeout failure tests (non-replay mode)
// ---------------------------------------------------------------------------

describe('OllamaModerationProvider: failure modes', () => {
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
    process.env.MODERATION_FIXTURE_REPLAY = undefined;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const provider = makeProvider();
    await expect(provider.classify(testInput)).rejects.toBeInstanceOf(ProviderUnavailable);
  });

  it('throws ProviderTimeout when fetch times out (AbortError)', async () => {
    process.env.MODERATION_FIXTURE_REPLAY = undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((_, reject) => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }),
      ),
    );

    const provider = makeProvider();
    await expect(provider.classify(testInput)).rejects.toBeInstanceOf(ProviderTimeout);
  });
});
