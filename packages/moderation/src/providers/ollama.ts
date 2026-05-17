/**
 * OllamaModerationProvider — real implementation.
 *
 * Two-pass design:
 *   Pass 1: Llama Guard 3 via POST /api/generate — native safe/unsafe + S-code output.
 *   Pass 2: Aux chat model via POST /api/chat (JSON mode) — spam/misinfo/off_topic scores.
 *
 * No SDK. Uses fetch to the Ollama HTTP API.
 * Design doc reference: docs/architecture/moderation.md §3, §6, §8.
 */

import { getOllamaAuxModel, getOllamaBaseUrl, getOllamaModel, getOllamaTimeoutMs } from '../env.ts';
import { ProviderMalformed, ProviderTimeout, ProviderUnavailable } from '../errors.ts';
import type {
  ModerationInput,
  ModerationProvider,
  ModerationResult,
  ModerationScores,
  ModerationVerdict,
} from '../provider.ts';

// ---------------------------------------------------------------------------
// S-code → ModerationCategory mapping (design doc §3.4)
//
// Meta's Llama Guard 3 hazard taxonomy (S1–S13) mapped to Earthropy axes:
//   S1  — Violent crimes                  → violence
//   S2  — Non-violent crimes              → illegal
//   S3  — Sex-related crimes              → illegal (and sexual)
//   S4  — Child sexual exploitation       → illegal at 1.0 (always auto_reject)
//   S5  — Defamation                      → harassment
//   S6  — Specialized advice              → (not mapped; ignored)
//   S7  — Privacy                         → harassment
//   S8  — Intellectual property           → illegal
//   S9  — Indiscriminate weapons          → violence
//   S10 — Hate                            → hate
//   S11 — Suicide & self-harm             → self_harm
//   S12 — Sexual content                  → sexual
//   S13 — Elections                       → misinfo
//
// S6 (specialized advice: medical/legal/financial) is intentionally not mapped;
// Llama Guard flags it as "unsafe" but it is not harmful on an SDG platform.
// ---------------------------------------------------------------------------

type MappedAxis = keyof ModerationScores;

const S_CODE_MAP: Record<string, MappedAxis[]> = {
  S1: ['violence'],
  S2: ['illegal'],
  S3: ['illegal', 'sexual'],
  S4: ['illegal'],
  S5: ['harassment'],
  // S6 intentionally omitted — specialized advice is not harmful on this platform
  S7: ['harassment'],
  S8: ['illegal'],
  S9: ['violence'],
  S10: ['hate'],
  S11: ['self_harm'],
  S12: ['sexual'],
  S13: ['misinfo'],
};

/** S4 (child sexual exploitation) always scores at 1.0, above the auto-reject threshold. */
const S4_SCORE = 1.0;

/** Every other unsafe S-code scores at 0.9 — above autoRejectMin=0.85. */
const UNSAFE_SCORE = 0.9;

/** Drop scores below this from the returned partial record (noise floor, design doc §9.2). */
const SCORE_NOISE_FLOOR = 0.05;

// ---------------------------------------------------------------------------
// Llama Guard prompt construction (design doc §3.2)
// ---------------------------------------------------------------------------

const GUARD_SYSTEM_PROMPT = `You are a content moderation assistant. Classify the following user message according to Meta's Llama Guard 3 hazard taxonomy. Respond on the first line with exactly "safe" or "unsafe". If unsafe, on the second line list the comma-separated category codes from S1..S13 that apply.`;

// ---------------------------------------------------------------------------
// Aux-model prompt construction (design doc §3.3)
// ---------------------------------------------------------------------------

function buildAuxSystemPrompt(groupSdgCodes: readonly string[], targetType: string): string {
  return `You are a content classifier. Output a JSON object with three numbers in [0, 1]: "spam", "misinfo", "off_topic". No prose, no preamble. Use Ollama JSON mode.

Group SDG codes: ${groupSdgCodes.length > 0 ? groupSdgCodes.join(', ') : 'none provided'}
Target type:     ${targetType}`;
}

// ---------------------------------------------------------------------------
// Score filter (noise floor)
// ---------------------------------------------------------------------------

function filterScores(raw: ModerationScores): ModerationScores {
  const out: ModerationScores = {};
  for (const [key, val] of Object.entries(raw) as [MappedAxis, number][]) {
    if (val >= SCORE_NOISE_FLOOR) {
      out[key] = val;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pre-policy verdict helper (design doc §3.4)
// ---------------------------------------------------------------------------

function computeVerdict(scores: ModerationScores): ModerationVerdict {
  const values = Object.values(scores);
  const max = values.length === 0 ? 0 : Math.max(...values);
  if (max >= 0.85) return 'auto_reject';
  if (max < 0.25) return 'auto_publish';
  return 'hold_for_review';
}

// ---------------------------------------------------------------------------
// Reasoning string builder (design doc §3.4)
// ---------------------------------------------------------------------------

function buildReasoning(sCodes: string[], scores: ModerationScores): string {
  if (sCodes.length === 0) {
    const axes = Object.keys(scores);
    if (axes.length === 0) {
      return 'Llama Guard 3 found no safety issues. Self-host classifier; see /docs/moderation-policy.md.';
    }
    return `Aux classifier flagged ${axes.join(', ')}. Self-host classifier; see /docs/moderation-policy.md.`;
  }
  const descriptions: Record<string, string> = {
    S1: 'violent crimes',
    S2: 'non-violent crimes',
    S3: 'sex-related crimes',
    S4: 'child sexual exploitation',
    S5: 'defamation',
    S6: 'specialized advice',
    S7: 'privacy',
    S8: 'intellectual property',
    S9: 'indiscriminate weapons',
    S10: 'hate',
    S11: 'self_harm',
    S12: 'sexual content',
    S13: 'elections/misinfo',
  };
  const labels = sCodes.map((c) => {
    const d = descriptions[c];
    return d ? `${c} (${d})` : c;
  });
  return `Llama Guard 3 flagged ${labels.join(', ')}. Self-host classifier; see /docs/moderation-policy.md.`;
}

// ---------------------------------------------------------------------------
// Ollama HTTP API call helpers (no SDK)
// ---------------------------------------------------------------------------

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

interface OllamaChatResponse {
  model: string;
  message: { content: string };
  done: boolean;
}

async function callOllamaGenerate(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userText: string,
  timeoutMs: number,
): Promise<OllamaGenerateResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `[system]\n${systemPrompt}\n\n[user]\n${userText}`,
        stream: false,
        options: { temperature: 0, num_predict: 64 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ProviderUnavailable(`Ollama /api/generate returned HTTP ${res.status}`);
    }
    return (await res.json()) as OllamaGenerateResponse;
  } finally {
    clearTimeout(timer);
  }
}

async function callOllamaChat(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userText: string,
  timeoutMs: number,
): Promise<OllamaChatResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        format: 'json',
        stream: false,
        options: { temperature: 0, num_predict: 128 },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ProviderUnavailable(`Ollama /api/chat returned HTTP ${res.status}`);
    }
    return (await res.json()) as OllamaChatResponse;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Guard response parser (design doc §3.2)
// ---------------------------------------------------------------------------

interface ParsedGuardResponse {
  safe: boolean;
  sCodes: string[];
  malformed: boolean;
}

function parseGuardResponse(text: string): ParsedGuardResponse {
  const trimmed = text.trim();
  if (!trimmed) {
    return { safe: false, sCodes: [], malformed: true };
  }
  const lines = trimmed.split('\n').map((l) => l.trim());
  const firstLine = lines[0]?.toLowerCase() ?? '';

  if (firstLine === 'safe') {
    return { safe: true, sCodes: [], malformed: false };
  }

  if (firstLine === 'unsafe') {
    const codesLine = lines[1] ?? '';
    const sCodes = codesLine
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^S\d+$/.test(s));
    return { safe: false, sCodes, malformed: false };
  }

  return { safe: false, sCodes: [], malformed: true };
}

// ---------------------------------------------------------------------------
// Aux response parser (design doc §3.3)
// ---------------------------------------------------------------------------

interface AuxScores {
  spam: number;
  misinfo: number;
  off_topic: number;
}

function parseAuxResponse(content: string): AuxScores | null {
  try {
    const parsed = JSON.parse(content) as Partial<AuxScores>;
    const spam = typeof parsed.spam === 'number' ? Math.min(1, Math.max(0, parsed.spam)) : 0;
    const misinfo =
      typeof parsed.misinfo === 'number' ? Math.min(1, Math.max(0, parsed.misinfo)) : 0;
    const off_topic =
      typeof parsed.off_topic === 'number' ? Math.min(1, Math.max(0, parsed.off_topic)) : 0;
    return { spam, misinfo, off_topic };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main provider class
// ---------------------------------------------------------------------------

export class OllamaModerationProvider implements ModerationProvider {
  private readonly baseUrl: string;
  readonly model: string;
  private readonly auxModel: string;
  private readonly timeoutMs: number;

  constructor(baseUrl?: string, model?: string, auxModel?: string, timeoutMs?: number) {
    this.baseUrl = baseUrl ?? getOllamaBaseUrl();
    this.model = model ?? getOllamaModel();
    this.auxModel = auxModel ?? getOllamaAuxModel();
    this.timeoutMs = timeoutMs ?? getOllamaTimeoutMs();
  }

  async classify(input: ModerationInput): Promise<ModerationResult> {
    // -----------------------------------------------------------------------
    // Pass 1: Llama Guard 3 — native safe/unsafe classification
    // -----------------------------------------------------------------------
    let guardText: string;
    try {
      const guardResp = await callOllamaGenerate(
        this.baseUrl,
        this.model,
        GUARD_SYSTEM_PROMPT,
        input.text,
        this.timeoutMs,
      );
      guardText = guardResp.response ?? '';
    } catch (err) {
      // Re-throw already-typed provider errors
      if (
        err instanceof ProviderUnavailable ||
        err instanceof ProviderTimeout ||
        err instanceof ProviderMalformed
      ) {
        throw err;
      }
      // AbortError → timeout
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderTimeout(`Ollama guard request timed out after ${this.timeoutMs}ms`, err);
      }
      // Network error
      if (err instanceof Error) {
        throw new ProviderUnavailable(`Ollama guard request failed: ${err.message}`, err);
      }
      throw new ProviderUnavailable('Ollama guard request failed with unknown error', err);
    }

    const parsed = parseGuardResponse(guardText);

    // Malformed response → hold for human review (design doc §8.4 / §8.6)
    if (parsed.malformed) {
      return {
        scores: {},
        verdict: 'hold_for_review',
        reasoning:
          'Ollama guard response failed to parse (malformed output); held for human review.',
        provider: 'ollama',
        model: this.model,
      };
    }

    // Build scores from S-codes (design doc §3.4)
    const scores: ModerationScores = {};

    if (!parsed.safe) {
      for (const code of parsed.sCodes) {
        const axes = S_CODE_MAP[code];
        if (!axes) continue; // S6 and unknown codes are skipped

        const score = code === 'S4' ? S4_SCORE : UNSAFE_SCORE;
        for (const axis of axes) {
          // Take the max if multiple codes map to the same axis
          const existing = scores[axis] ?? 0;
          scores[axis] = Math.max(existing, score);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Pass 2: Aux model — spam / misinfo / off_topic (design doc §3.3)
    // -----------------------------------------------------------------------
    if (this.auxModel !== 'none') {
      try {
        const auxSystemPrompt = buildAuxSystemPrompt(
          input.context.groupSdgCodes ?? [],
          input.context.targetType,
        );
        const auxResp = await callOllamaChat(
          this.baseUrl,
          this.auxModel,
          auxSystemPrompt,
          input.text,
          this.timeoutMs,
        );
        const auxScores = parseAuxResponse(auxResp.message?.content ?? '{}');
        if (auxScores) {
          // Overlay aux scores — these axes do not come from Llama Guard
          scores.spam = auxScores.spam;
          scores.misinfo = auxScores.misinfo;
          scores.off_topic = auxScores.off_topic;
        }
        // If auxScores is null (parse failure), degrade gracefully: axes absent (design doc §8.6)
      } catch {
        // Aux failure is non-fatal: native-axis scores survive (design doc §8.6)
      }
    }

    const filteredScores = filterScores(scores);
    const verdict = computeVerdict(filteredScores);
    const reasoning = buildReasoning(parsed.safe ? [] : parsed.sCodes, filteredScores);

    return {
      scores: filteredScores,
      verdict,
      reasoning,
      provider: 'ollama',
      model: this.model,
    };
  }
}
