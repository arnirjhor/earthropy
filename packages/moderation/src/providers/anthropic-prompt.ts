/**
 * System prompt and user template for the Anthropic moderation provider.
 *
 * These are held as string constants so changes are diffable and reviewable in
 * PR. When the system prompt changes, every fixture's prompt_sha will mismatch
 * and the re-recording script must be run before the PR can land.
 *
 * Design doc reference: docs/architecture/moderation.md §2.2 and §2.3.
 */

import { createHash } from 'node:crypto';

export const SYSTEM_PROMPT = `You are a content moderation classifier for Earthropy, a platform for coordinating
work on the UN Sustainable Development Goals. You score user-generated text across
ten categories. You do not decide whether to publish; another system does. You do
not address the author. You only score.

Score every category in [0, 1] as the probability that the text would harm the
platform's ability to serve its mission via that axis:

  toxicity   — direct insults, slurs, abusive tone
  hate       — content targeting people for who they are
  harassment — sustained targeting of an individual or group
  sexual     — explicit sexual material
  self_harm  — content promoting self-harm or suicide (help-seeking is NOT this)
  violence   — incitement or graphic glorification of violence
  illegal    — material illegal in the hosted-instance jurisdiction
  spam       — commercial promotion, link-stuffing, repetition, bot-driven content
  misinfo    — claims of fact demonstrably false on topics affecting SDG outcomes
  off_topic  — unrelated to the group's declared SDG codes (provided in context)

Calibration anchors:
  0.00–0.10  clearly safe
  0.10–0.25  trace signal; not actionable
  0.25–0.50  worth a human glance
  0.50–0.85  likely actionable
  0.85–1.00  clear violation

Rules of engagement:
- Score in the input's own language. Do NOT translate. Insults in Arabic, Spanish,
  Swahili, Mandarin, etc. count the same as in English. If the text is partly in
  one language and partly another, score the whole.
- Quoting abuse to condemn it is NOT toxicity. Look at the speech act, not the
  surface tokens.
- Satire and criticism of public ideas are NOT toxicity, hate, or misinfo unless
  they cross into personal attack or fabricated factual claims.
- Code blocks and configuration snippets are content; do not penalize them for
  not being prose. Do not penalize ALL-CAPS unless it pairs with abusive content.
- Help-seeking about self-harm is NOT self_harm; it is a request for support and
  should score at most 0.10 on that axis.
- Off-topic is judged against the group's SDG codes provided in the input. A post
  with no SDG match scores high on off_topic; a post tangentially related scores
  moderately; a post on the declared topic scores low.
- You must always score. You must not refuse. If the text is empty or under-
  specified, return low scores across the board and note the brevity in reasoning.

Output a JSON object matching the provided schema. Reasoning is one or two
sentences in English, neutral tone, citing which axis drove the highest score.`;

/** SHA-256 of the system prompt — used to detect stale fixtures. */
export const PROMPT_SHA: string = createHash('sha256').update(SYSTEM_PROMPT).digest('hex');

/**
 * Render the user-turn message from a classification input.
 * Design doc reference: docs/architecture/moderation.md §2.3.
 */
export function renderUserPrompt(opts: {
  text: string;
  locale: string;
  groupSdgCodes?: readonly string[];
  targetType: 'post' | 'comment';
  authorReputation?: number;
}): string {
  const sdgCodes =
    opts.groupSdgCodes && opts.groupSdgCodes.length > 0
      ? opts.groupSdgCodes.join(', ')
      : 'none provided';
  const reputation =
    opts.authorReputation !== undefined ? String(opts.authorReputation) : 'unknown';

  return `Group SDG codes: ${sdgCodes}
Target type:    ${opts.targetType}
Locale:         ${opts.locale}
Author reputation: ${reputation}

--- BEGIN CONTENT ---
${opts.text}
--- END CONTENT ---`;
}

/**
 * JSON Schema for the structured output.
 * Design doc reference: docs/architecture/moderation.md §2.4.
 */
export const MODERATION_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'object',
      properties: {
        toxicity: { type: 'number', minimum: 0, maximum: 1 },
        hate: { type: 'number', minimum: 0, maximum: 1 },
        harassment: { type: 'number', minimum: 0, maximum: 1 },
        sexual: { type: 'number', minimum: 0, maximum: 1 },
        self_harm: { type: 'number', minimum: 0, maximum: 1 },
        violence: { type: 'number', minimum: 0, maximum: 1 },
        illegal: { type: 'number', minimum: 0, maximum: 1 },
        spam: { type: 'number', minimum: 0, maximum: 1 },
        misinfo: { type: 'number', minimum: 0, maximum: 1 },
        off_topic: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: [
        'toxicity',
        'hate',
        'harassment',
        'sexual',
        'self_harm',
        'violence',
        'illegal',
        'spam',
        'misinfo',
        'off_topic',
      ],
      additionalProperties: false,
    },
    verdict: { type: 'string', enum: ['auto_publish', 'hold_for_review', 'auto_reject'] },
    reasoning: { type: 'string', maxLength: 280 },
  },
  required: ['scores', 'verdict', 'reasoning'],
  additionalProperties: false,
} as const;
