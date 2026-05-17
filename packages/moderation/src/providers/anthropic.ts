/**
 * AnthropicModerationProvider — real implementation.
 *
 * Uses @anthropic-ai/sdk client.messages.parse with jsonSchemaOutputFormat for
 * structured output. Supports fixture-replay mode (MODERATION_FIXTURE_REPLAY=1)
 * for deterministic tests without hitting the real API.
 *
 * Design doc reference: docs/architecture/moderation.md §2, §6, §8.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { getModel, getTimeoutMs, isReplayMode } from '../env.ts';
import {
  ProviderMalformed,
  ProviderRateLimited,
  ProviderTimeout,
  ProviderUnavailable,
} from '../errors.ts';
import type {
  ModerationInput,
  ModerationProvider,
  ModerationResult,
  ModerationScores,
} from '../provider.ts';
import {
  MODERATION_SCHEMA,
  PROMPT_SHA,
  SYSTEM_PROMPT,
  renderUserPrompt,
} from './anthropic-prompt.ts';

// ---------------------------------------------------------------------------
// Internal types that mirror the JSON schema shape (all required from the schema)
// ---------------------------------------------------------------------------

interface SchemaScores {
  toxicity: number;
  hate: number;
  harassment: number;
  sexual: number;
  self_harm: number;
  violence: number;
  illegal: number;
  spam: number;
  misinfo: number;
  off_topic: number;
}

interface SchemaOutput {
  scores: SchemaScores;
  verdict: 'auto_publish' | 'hold_for_review' | 'auto_reject';
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Score filter: drop categories scoring < 0.05 (noise floor per design doc §9.2)
// ---------------------------------------------------------------------------

const SCORE_NOISE_FLOOR = 0.05;

function filterScores(raw: SchemaScores): ModerationScores {
  const out: ModerationScores = {};
  const entries = Object.entries(raw) as [keyof SchemaScores, number][];
  for (const [key, val] of entries) {
    if (val >= SCORE_NOISE_FLOOR) {
      out[key as keyof ModerationScores] = val;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fixture-replay helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '../../fixtures/anthropic');

export interface FixtureMeta {
  prompt_sha: string;
  recorded_model: string;
  scenario: string;
}

export interface FixtureRawResponse {
  id: string;
  model: string;
  stop_reason: string;
  parsed_output: SchemaOutput | null;
}

export interface FixtureFile {
  _meta: FixtureMeta;
  input: ModerationInput;
  raw_response: FixtureRawResponse;
}

function findFixture(input: ModerationInput): FixtureFile {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const raw = readFileSync(join(FIXTURES_DIR, file), 'utf-8');
    const fixture = JSON.parse(raw) as FixtureFile;
    if (fixture.input.text === input.text) {
      return fixture;
    }
  }

  throw new Error(
    `No fixture found for input text: "${input.text.slice(0, 60)}…"\nRun the recording script to create one: pnpm --filter @repo/moderation record-fixtures`,
  );
}

export function adaptFixtureResponse(fixture: FixtureFile, model: string): ModerationResult {
  // Guard: prompt_sha must match current prompt
  if (fixture._meta.prompt_sha !== PROMPT_SHA) {
    throw new Error(
      `prompt_sha mismatch for fixture "${fixture._meta.scenario}": fixture has ${fixture._meta.prompt_sha}, current prompt is ${PROMPT_SHA}. Re-record fixtures with: pnpm --filter @repo/moderation record-fixtures`,
    );
  }

  const raw = fixture.raw_response;
  const resolvedModel = raw.model ?? model;

  // Refusal path (design doc §2.6, §8.5)
  if (
    raw.stop_reason === 'refusal' ||
    raw.parsed_output === null ||
    raw.parsed_output === undefined
  ) {
    return {
      scores: {},
      verdict: 'hold_for_review',
      reasoning: 'provider refused to classify; held for human review',
      provider: 'anthropic',
      model: resolvedModel,
    };
  }

  // Validate required fields — malformed path (design doc §8.4)
  const parsed = raw.parsed_output;
  if (!parsed.scores || parsed.verdict === undefined || parsed.reasoning === undefined) {
    throw new ProviderMalformed(
      'Fixture raw_response.parsed_output is missing required fields (scores, verdict, reasoning)',
    );
  }

  return {
    scores: filterScores(parsed.scores),
    verdict: parsed.verdict,
    reasoning: parsed.reasoning,
    provider: 'anthropic',
    model: resolvedModel,
  };
}

// ---------------------------------------------------------------------------
// Live-API helpers
// ---------------------------------------------------------------------------

function buildRefusalResult(model: string): ModerationResult {
  return {
    scores: {},
    verdict: 'hold_for_review',
    reasoning: 'provider refused to classify; held for human review',
    provider: 'anthropic',
    model,
  };
}

// ---------------------------------------------------------------------------
// Main provider class
// ---------------------------------------------------------------------------

export class AnthropicModerationProvider implements ModerationProvider {
  private readonly client: Anthropic;
  readonly model: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, model?: string, timeoutMs?: number) {
    this.model = model ?? getModel();
    this.timeoutMs = timeoutMs ?? getTimeoutMs();
    this.client = new Anthropic({
      apiKey,
      // Disable built-in retries — the worker (C-WORKER-1) owns the retry/backoff
      // strategy so we don't double-retry inside the provider.
      maxRetries: 0,
      timeout: this.timeoutMs,
    });
  }

  async classify(input: ModerationInput): Promise<ModerationResult> {
    // Fixture-replay mode — no real API calls.
    if (isReplayMode()) {
      const fixture = findFixture(input);
      return adaptFixtureResponse(fixture, this.model);
    }

    // Live API path.
    const userMessage = renderUserPrompt({
      text: input.text,
      locale: input.locale,
      groupSdgCodes: input.context.groupSdgCodes,
      targetType: input.context.targetType,
      authorReputation: input.context.authorReputation,
    });

    try {
      const message = await this.client.messages.parse({
        model: this.model,
        max_tokens: 512,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        output_config: {
          format: jsonSchemaOutputFormat(MODERATION_SCHEMA),
        },
      });

      // Refusal path (design doc §2.6, §8.5)
      if (
        message.stop_reason === 'refusal' ||
        message.parsed_output === null ||
        message.parsed_output === undefined
      ) {
        return buildRefusalResult(message.model);
      }

      const parsed = message.parsed_output as SchemaOutput;

      // Validate required fields (malformed path §8.4)
      if (!parsed.scores || parsed.verdict === undefined || parsed.reasoning === undefined) {
        throw new ProviderMalformed(
          'API response parsed_output is missing required fields (scores, verdict, reasoning)',
        );
      }

      return {
        scores: filterScores(parsed.scores),
        verdict: parsed.verdict,
        reasoning: parsed.reasoning,
        provider: 'anthropic',
        model: message.model,
      };
    } catch (err) {
      // Re-throw already-typed provider errors
      if (
        err instanceof ProviderMalformed ||
        err instanceof ProviderUnavailable ||
        err instanceof ProviderTimeout ||
        err instanceof ProviderRateLimited
      ) {
        throw err;
      }

      // Timeout (APIConnectionTimeoutError inherits from APIConnectionError)
      if (err instanceof Anthropic.APIConnectionTimeoutError) {
        throw new ProviderTimeout(`Anthropic request timed out after ${this.timeoutMs}ms`, err);
      }

      // Abort from external signal (DOMException AbortError)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderTimeout(`Anthropic request aborted (timeout ${this.timeoutMs}ms)`, err);
      }

      // Network / connection error (check after timeout since timeout extends connection)
      if (err instanceof Anthropic.APIConnectionError) {
        throw new ProviderUnavailable('Anthropic API connection failed', err);
      }

      // Rate limit (design doc §8.3)
      if (err instanceof Anthropic.RateLimitError) {
        const retryAfterRaw = err.headers
          ? (err.headers as unknown as Record<string, string>)['retry-after']
          : undefined;
        const retryAfterSeconds = retryAfterRaw ? Number(retryAfterRaw) : 0;
        throw new ProviderRateLimited(
          `Anthropic rate limit hit (retry-after: ${retryAfterSeconds}s)`,
          retryAfterSeconds,
          err,
        );
      }

      // 5xx server error → ProviderUnavailable
      if (err instanceof Anthropic.APIError) {
        if (err.status !== undefined && err.status >= 500) {
          throw new ProviderUnavailable(`Anthropic server error (${err.status})`, err);
        }
        // Schema validation failure or other API error → ProviderMalformed
        throw new ProviderMalformed(
          `Anthropic response failed schema validation: ${err.message}`,
          err,
        );
      }

      // Generic Error — catch network failures escaping typed SDK paths
      if (err instanceof Error) {
        throw new ProviderUnavailable(`Unexpected provider error: ${err.message}`, err);
      }

      throw new ProviderUnavailable('Unknown provider error', err);
    }
  }
}
