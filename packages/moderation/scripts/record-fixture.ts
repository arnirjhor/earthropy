/**
 * Record (or re-record) Anthropic moderation fixtures.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @repo/moderation record-fixtures
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @repo/moderation record-fixtures -- --force
 *
 * This script is for human use only. CI never runs it.
 * Each fixture that has a stale prompt_sha (or --force is passed) will be
 * re-recorded by calling the real Anthropic API.
 *
 * Fixtures synthesized at authoring time are in packages/moderation/fixtures/anthropic/.
 * When the system prompt changes, all fixtures' prompt_sha values will mismatch
 * and this script will re-record them automatically.
 *
 * Design doc reference: docs/architecture/moderation.md §6.4.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import {
  MODERATION_SCHEMA,
  PROMPT_SHA,
  SYSTEM_PROMPT,
  renderUserPrompt,
} from '../src/providers/anthropic-prompt.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures/anthropic');

const FORCE = process.argv.includes('--force');
const MODEL = process.env.MODERATION_MODEL ?? 'claude-sonnet-4-5';
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

interface FixtureMeta {
  scenario: string;
  recorded_at: string;
  recorded_model: string;
  prompt_sha: string;
  note?: string;
}

interface FixtureInput {
  text: string;
  locale: string;
  context: {
    groupSdgCodes?: string[];
    authorReputation?: number;
    targetType: 'post' | 'comment';
  };
}

interface ExistingFixture {
  _meta: FixtureMeta;
  input: FixtureInput;
  [key: string]: unknown;
}

interface FixtureRawResponse {
  id: string;
  type: string;
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
  parsed_output: unknown;
}

const client = new Anthropic({ apiKey: API_KEY, maxRetries: 0 });

async function recordFixture(fixturePath: string, existing: ExistingFixture): Promise<void> {
  const { input } = existing;
  const scenario = existing._meta.scenario;

  console.log(`Recording: ${scenario}...`);

  const userMessage = renderUserPrompt({
    text: input.text,
    locale: input.locale,
    groupSdgCodes: input.context.groupSdgCodes,
    targetType: input.context.targetType,
    authorReputation: input.context.authorReputation,
  });

  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: 512,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    output_config: {
      format: jsonSchemaOutputFormat(MODERATION_SCHEMA),
    },
  });

  const rawResponse: FixtureRawResponse = {
    id: message.id,
    type: message.type,
    model: message.model,
    stop_reason: message.stop_reason ?? 'end_turn',
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
    parsed_output: message.parsed_output ?? null,
  };

  // Build expected_result by applying the same adapter logic as the real provider
  let expectedResult: unknown;
  if (rawResponse.stop_reason === 'refusal' || rawResponse.parsed_output === null) {
    expectedResult = {
      scores: {},
      verdict: 'hold_for_review',
      reasoning: 'provider refused to classify; held for human review',
      provider: 'anthropic',
      model: rawResponse.model,
    };
  } else {
    const parsed = rawResponse.parsed_output as {
      scores: Record<string, number>;
      verdict: string;
      reasoning: string;
    };
    const filteredScores: Record<string, number> = {};
    for (const [key, val] of Object.entries(parsed.scores)) {
      if (val >= 0.05) {
        filteredScores[key] = val;
      }
    }
    expectedResult = {
      scores: filteredScores,
      verdict: parsed.verdict,
      reasoning: parsed.reasoning,
      provider: 'anthropic',
      model: rawResponse.model,
    };
  }

  const fixture = {
    _meta: {
      scenario,
      recorded_at: new Date().toISOString(),
      recorded_model: MODEL,
      prompt_sha: PROMPT_SHA,
    },
    input,
    raw_response: rawResponse,
    expected_result: expectedResult,
  };

  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf-8');
  console.log(`  ✓ Recorded ${scenario} → ${fixturePath}`);
}

async function main(): Promise<void> {
  if (!existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No fixtures found.');
    return;
  }

  let recorded = 0;
  let skipped = 0;

  for (const file of files) {
    const fixturePath = join(FIXTURES_DIR, file);
    const existing = JSON.parse(readFileSync(fixturePath, 'utf-8')) as ExistingFixture;

    if (!FORCE && existing._meta.prompt_sha === PROMPT_SHA) {
      console.log(`Skipping ${existing._meta.scenario} (prompt_sha matches)`);
      skipped++;
      continue;
    }

    await recordFixture(fixturePath, existing);
    recorded++;
  }

  console.log(`\nDone. Recorded: ${recorded}, Skipped: ${skipped}`);
  if (recorded > 0) {
    console.log('\nReview the fixture diffs before committing:');
    console.log('  git diff packages/moderation/fixtures/');
  }
}

main().catch((err: unknown) => {
  console.error('Recording failed:', err);
  process.exit(1);
});
