# Moderation pipeline design

Status: accepted (C-MOD-DESIGN)
Authoritative for: `packages/moderation` provider implementations, the BullMQ worker that consumes pre-publication classification jobs, and any downstream consumer of `moderation_decisions`.
Implementers: C-MOD-1 (Anthropic provider), C-MOD-2 (Ollama / Llama Guard provider), C-WORKER-1 (worker entry + DLQ), C-PIPE-1 (pipeline wiring).
Reviewers check the implementation against this file. Deviations land as appended sections in this file with rationale and date; the original wording does not get edited in place.

Existing primitives this doc builds on:

- Provider contract: `packages/moderation/src/provider.ts` (`ModerationCategory`, `ModerationScores`, `ModerationVerdict`, `ModerationInput`, `ModerationResult`, `ModerationProvider`, `ModerationPolicy`, `DEFAULT_POLICY`, `decide`).
- Stubs that land real impls in C-MOD-1 / C-MOD-2: `packages/moderation/src/providers/anthropic.ts`, `packages/moderation/src/providers/ollama.ts`.
- Audit + appeal schema: `packages/database/src/schema/moderation.ts` (`moderation_decisions`, `appeals`).
- Verdict enum (`auto_publish | hold_for_review | auto_reject | human_publish | human_reject`): `packages/database/src/schema/enums.ts`.
- The transparency promise that constrains everything below: `docs/moderation-policy.md`.
- Repo conventions, especially the corp-agnostic and immutability rules: `CLAUDE.md`.

---

## 1. Mission alignment

Earthropy moderates because the platform exists to coordinate global SDG work; a forum overrun by harassment, spam, and misinformation cannot host that work. The moderation pipeline is therefore load-bearing for the mission, not a content filter bolted onto the side. Two consequences follow:

**Pre-publication, not post-publication.** Every post and comment enters the system as `pending_ai` (per `contentStatus` in `packages/database/src/schema/enums.ts`) and is held until the worker writes a decision. A naïve "publish then moderate" stance trades retention for harm reduction — wrong trade-off when the harm in question is harassment of contributors writing in good faith about contentious topics (climate denial pile-ons, gendered abuse around SDG 5, etc.).

**What AI does NOT decide.** The AI provider returns scores and a suggested verdict; the platform decides what to do with them.

- The provider never deletes content, never bans users, never adjusts reputation, never communicates with the author. The worker writes a `moderation_decisions` row and the application reads it.
- The policy layer (`decide()` in `packages/moderation/src/provider.ts`) takes the AI's scores and applies thresholds (`autoPublishMax=0.25`, `autoRejectMin=0.85`). The AI's `verdict` field is advisory; the policy can override it. The policy decides the final verdict.
- Borderline content (`hold_for_review`) is routed to a human moderator queue (group moderators, then platform anchors). The AI's reasoning is shown to that human as a hint, never as a recommendation to rubber-stamp.
- Appeals (`packages/database/src/schema/moderation.ts` `appeals`) are decided by humans only. The pipeline never re-classifies on appeal — the original AI decision is the artifact under review, not a starting point.
- Moderation outcomes are surfaced to authors with the provider and model identifier (per `docs/moderation-policy.md` "Transparency promise"). Authors know what classified them and what it said.

The provider is intentionally easy to swap and intentionally easy to disagree with. Self-hosters who reject the hosted instance's choice of Anthropic can switch to Ollama with one env flag (`MODERATION_PROVIDER=ollama`) and lose nothing structural. The categories in `ModerationCategory` are the contract; how a provider arrives at scores against them is its own business.

---

## 2. Anthropic Claude prompt

The default provider for the hosted instance. Lands in C-MOD-1 against `@anthropic-ai/sdk` (Apache 2.0, on the dep allowlist per `CLAUDE.md` "Architectural rules"). Model identifier is held in env (`ANTHROPIC_MODEL`, default `claude-sonnet-4-5`); see Section 7 for cost rationale.

### 2.1 Request shape

The provider issues a single `client.messages.parse` call per classification — see the SDK helper `jsonSchemaOutputFormat` (latest Anthropic TS SDK; verified via context7). Parameters:

| Parameter | Value | Rationale |
| --- | --- | --- |
| `model` | env `ANTHROPIC_MODEL`, default `claude-sonnet-4-5` | Sonnet is the cost/quality sweet spot for short-form classification. Opus is reserved for the moderator-queue assist (a future feature); Haiku underperforms on multilingual nuance. |
| `max_tokens` | `512` | Output is one JSON object with ten floats, ten brief justifications, one verdict, one reasoning string. 512 is comfortably above the worst-case JSON length and well below any per-message cap. |
| `temperature` | `0` | Classification is deterministic by intent; we want the same input to score the same way across retries. `temperature=0` is also a precondition for the fixture-replay strategy in Section 6 to be honest. |
| `output_config.format` | `jsonSchemaOutputFormat(MODERATION_SCHEMA)` | Per the SDK guidance in `/anthropics/anthropic-sdk-typescript`. The SDK validates and exposes `parsed_output`; no hand-rolled JSON.parse. |
| `system` | The system prompt below (Section 2.2). | Held as a string constant in `packages/moderation/src/providers/anthropic-prompt.ts` so changes are diffable and reviewable in PR. |
| `messages` | One user message: the user-template-rendered input (Section 2.3). | Single-turn. No assistant priming. |

No streaming. No `stop_sequences`. No tools other than the output schema.

### 2.2 System prompt

The system prompt establishes the role, the categories, the calibration rules, and the refusal-free contract. Held as one immutable string per release; revisions go through a PR review and append a row to a `prompts/anthropic-system.<sha>.txt` archive under `packages/moderation/prompts/` (so a logged decision can be traced to the exact prompt version that produced it).

```
You are a content moderation classifier for Earthropy, a platform for coordinating
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
sentences in English, neutral tone, citing which axis drove the highest score.
```

The "you must not refuse" clause is deliberate. Claude's default safety training can refuse to engage with verbatim slurs even when the task is classification. We tell the model explicitly that classification is the task and refusal is not an option. Section 8.4 covers what happens if the model refuses anyway.

### 2.3 User prompt template

The user message is rendered from a template held in `packages/moderation/src/providers/anthropic-prompt.ts`:

```
Group SDG codes: {{groupSdgCodes | "none provided"}}
Target type:    {{targetType}}            // 'post' or 'comment'
Locale:         {{locale}}                // BCP-47, e.g. 'en', 'ar', 'pt-BR'
Author reputation: {{authorReputation | "unknown"}}

--- BEGIN CONTENT ---
{{text}}
--- END CONTENT ---
```

Notes:

- `authorReputation` is passed as a soft prior so the model can be slightly less paranoid about borderline phrasing from established contributors. The policy layer in `decide()` is the only place reputation thresholds make a binding difference; the prompt makes it advisory.
- The delimiters (`--- BEGIN CONTENT ---` / `--- END CONTENT ---`) bound the untrusted region. Prompt-injection attempts inside the content are bounded by the schema (the output must validate; injected instructions can't change that) and by the system prompt explicitly stating "you score, you do not address the author."
- `locale` is included so the model can pick the right calibration for languages whose toxic vocabulary differs from English's (German, Arabic, and Spanish all have insults that look mild on surface gloss).

### 2.4 Structured output JSON schema

The JSON Schema passed to `jsonSchemaOutputFormat`. Held as `MODERATION_SCHEMA` next to the prompt:

```json
{
  "type": "object",
  "properties": {
    "scores": {
      "type": "object",
      "properties": {
        "toxicity":   { "type": "number", "minimum": 0, "maximum": 1 },
        "hate":       { "type": "number", "minimum": 0, "maximum": 1 },
        "harassment": { "type": "number", "minimum": 0, "maximum": 1 },
        "sexual":     { "type": "number", "minimum": 0, "maximum": 1 },
        "self_harm":  { "type": "number", "minimum": 0, "maximum": 1 },
        "violence":   { "type": "number", "minimum": 0, "maximum": 1 },
        "illegal":    { "type": "number", "minimum": 0, "maximum": 1 },
        "spam":       { "type": "number", "minimum": 0, "maximum": 1 },
        "misinfo":    { "type": "number", "minimum": 0, "maximum": 1 },
        "off_topic":  { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "required": ["toxicity","hate","harassment","sexual","self_harm","violence","illegal","spam","misinfo","off_topic"],
      "additionalProperties": false
    },
    "verdict":   { "type": "string", "enum": ["auto_publish","hold_for_review","auto_reject"] },
    "reasoning": { "type": "string", "maxLength": 280 }
  },
  "required": ["scores", "verdict", "reasoning"],
  "additionalProperties": false
}
```

Why every score is required (not optional, despite `ModerationScores = Partial<Record<...>>`): forcing the model to commit a value on every axis avoids silent zeros from "I didn't think about that one." The provider adapter narrows from the schema's required form to the partial form when constructing `ModerationResult.scores`.

`reasoning.maxLength=280` keeps the field user-presentable (it lands in `moderation_decisions.reasoning` and is shown to authors per Section 9).

### 2.5 Multilingual nuance

- Earthropy ships locales `en`, `es`, `fr`, `ar`, `zh`, `hi`, `pt`, `ru`, `sw` per `packages/i18n/src/locales.ts`. Claude Sonnet 4.5 has strong coverage of all nine. We do not translate input; the system prompt explicitly forbids it (Section 2.2).
- The `locale` field in the user template is BCP-47. Variants matter: `pt-BR` and `pt-PT` have different idioms; `ar-EG` and `ar-SA` differ in offensive vocabulary. We pass whatever the author set; the model's calibration handles the rest.
- Mid-text language switches (Section 5) are common in code-switching contexts (e.g., Hindi-English; Swahili-English). The prompt says "score the whole"; we accept some calibration drift in exchange for not requiring per-sentence language detection.
- For locales where Claude's coverage is weakest (Swahili is the thinnest of the nine on current evals), self-hosters running primarily Swahili content may prefer the Ollama provider with a Swahili-tuned classifier. The provider-swap path makes this a single env change.

### 2.6 Refusal handling

The model may refuse despite the system-prompt instruction. Detection and behavior:

- If `messages.parse` returns with `stop_reason === 'refusal'` (per SDK), or if `parsed_output` is missing despite a successful HTTP response, the adapter treats the call as **provider-failure** (Section 8.4), not as a verdict.
- The adapter does **not** retry on refusal. A refusal is a signal that the content tripped a Claude-side safety filter, which usually means it is in fact violating. The fallback path writes a `hold_for_review` decision with `provider='anthropic'`, `model=<id>`, `scores={}`, `reasoning='provider refused to classify; held for human review'`. A human moderator sees it in the queue.
- The refusal path is rare but observable; the rate is tracked in the transparency stats (Section 9.4) so we can tune the prompt if it spikes.

---

## 3. Ollama / Llama Guard prompt

The self-host-friendly provider. Lands in C-MOD-2. Talks to a local Ollama server (default base URL `http://localhost:11434`); the model is configurable via env (`OLLAMA_MODEL`, default `llama-guard3:8b`). No external API dependency.

### 3.1 Why a different prompt shape

Llama Guard 3 is not a general-purpose chat model; it is a fine-tuned safety classifier. Its training expects a specific prompt format and emits a specific output format. Asking it to produce the same JSON schema as Claude would force it off-distribution and harm accuracy. We meet it on its own terms and adapt at the boundary.

### 3.2 Native Llama Guard 3 invocation

Llama Guard 3 expects a chat-style prompt with a hardcoded preamble describing the unsafe categories it was trained on. Meta's published format (S1–S13 hazard codes covering violence, sexual, child exploitation, defamation, privacy, etc.) is the model's native vocabulary. The adapter sends:

```
[system]
You are a content moderation assistant. Classify the following user message
according to Meta's Llama Guard 3 hazard taxonomy. Respond on the first line
with exactly "safe" or "unsafe". If unsafe, on the second line list the
comma-separated category codes from S1..S13 that apply.

[user]
{{text}}
```

The provider issues this via the Ollama generate endpoint (`POST /api/generate`), `stream: false`, `format: 'json'` is **not** used here because Llama Guard's native output is two short lines, not JSON. Temperature is `0`; `num_predict` (Ollama's `max_tokens` equivalent) is 64 — plenty for "unsafe\nS1,S10".

Illustrative response (text returned by Ollama in `response` field):

```
unsafe
S10,S11
```

### 3.3 Two-pass design for the categories Llama Guard does not cover

Llama Guard's taxonomy does not natively cover `spam`, `misinfo`, or `off_topic`. These are platform-shape concerns, not safety concerns. The adapter handles them with a second pass against a generic Llama 3 chat model (the one running alongside Llama Guard on the same Ollama server; `llama3.2:3b` or similar, configurable as `OLLAMA_AUX_MODEL`):

```
[system]
You are a content classifier. Output a JSON object with three numbers in [0, 1]:
"spam", "misinfo", "off_topic". No prose, no preamble. Use Ollama JSON mode.

Group SDG codes: {{groupSdgCodes}}
Target type:     {{targetType}}

[user]
{{text}}
```

This second call uses Ollama's JSON mode (`format: 'json'`, per the Ollama API docs verified via context7) — the model is explicitly instructed in the prompt to emit JSON, which the mode requires. `temperature=0`, `num_predict=128`.

Self-hosters who don't want the second pass can set `OLLAMA_AUX_MODEL=none`; the adapter will return `0` for `spam | misinfo | off_topic` and rely on community reporting plus the human queue to catch those classes. That degradation is acceptable for small instances.

### 3.4 Mapping Llama Guard categories back to `ModerationCategory`

Meta's S-codes map to Earthropy axes as follows. The mapping table lives in `packages/moderation/src/providers/llama-guard-mapping.ts`:

| Llama Guard code | Description | Earthropy axis |
| --- | --- | --- |
| S1 | Violent crimes | `violence` |
| S2 | Non-violent crimes | `illegal` |
| S3 | Sex-related crimes | `illegal` (and `sexual`) |
| S4 | Child sexual exploitation | `illegal` at 1.0 (always auto_reject) |
| S5 | Defamation | `harassment` |
| S6 | Specialized advice (medical/legal/financial) | not mapped; ignored |
| S7 | Privacy | `harassment` |
| S8 | Intellectual property | `illegal` |
| S9 | Indiscriminate weapons | `violence` |
| S10 | Hate | `hate` |
| S11 | Suicide & self-harm | `self_harm` |
| S12 | Sexual content | `sexual` |
| S13 | Elections | `misinfo` |

The adapter converts the `unsafe\n<S-codes>` output into scores by:

1. Default every axis to `0.0`.
2. For each S-code present in the response, set the mapped axis to `0.9` (Llama Guard's binary output doesn't give us a continuous score; `0.9` is "above `autoRejectMin=0.85` by design," which means a positive Llama Guard hit auto-rejects under the default policy).
3. If `safe`, all native-axis scores stay at `0.0`.
4. Overlay the aux-model JSON for `spam | misinfo | off_topic`.

The `0.9` quantization is a deliberate trade-off: we lose the calibration shape that Claude gives us. The trade is what self-hosters consciously accept by choosing a smaller, locally-runnable safety classifier over a frontier model. The `0.9` floor sits above `autoRejectMin` (0.85), which means a binary "unsafe" hit auto-rejects — matching Llama Guard's native semantic of "this is unsafe."

The `reasoning` string the adapter constructs:

```
Llama Guard 3 flagged S10 (hate), S11 (self_harm). Self-host classifier; see /docs/moderation-policy.md.
```

`verdict`: the adapter computes its own pre-policy verdict the same way the policy layer will — `auto_reject` if any score ≥ 0.85, `auto_publish` if every score < 0.25, else `hold_for_review`. The provider's `verdict` is advisory; `decide()` runs over the scores again.

### 3.5 Multilingual nuance for Llama Guard

Llama Guard 3 is trained primarily on English with patchy multilingual coverage. For non-English content the provider's accuracy drops noticeably. Mitigations:

- Self-hosters running a multilingual instance and choosing Ollama get a documented warning in `docs/self-host.md`: "the Ollama provider is English-biased; consider Claude for non-English-heavy traffic." (Update of that doc lands as a follow-up; not blocking C-MOD-2.)
- The aux-model second pass uses Llama 3 base, which has wider language coverage, so `spam | misinfo | off_topic` degrade more gracefully than the native S-codes.
- The locale field is not passed to Llama Guard (its training didn't use a locale field); it is passed to the aux model in the system prompt so the aux model can calibrate.

---

## 4. Score interpretation

Per `ModerationScores` in `packages/moderation/src/provider.ts`, every value is in `[0, 1]` and absent categories are treated as `0`. This section pins what each value means and how the policy layer reads it.

### 4.1 Per-axis definitions

| Axis | "High" (≥ 0.85) means | Hardest distinction to calibrate against |
| --- | --- | --- |
| `toxicity` | Direct insults or slurs in a sustained way targeted at a person or group present in the conversation. | Heated argument vs. abuse: passionate disagreement on SDG strategy is allowed; calling another contributor a slur is not. |
| `hate` | Targeting people for an immutable characteristic (race, gender, religion, disability, sexuality, nationality). | Criticism of an ideology or institution vs. attack on members of a group. |
| `harassment` | Sustained targeting of an individual: pile-ons, doxxing prep, repeated mentions to badger. | Strong criticism in one comment vs. coordinated targeting; v0.1 has no cross-comment view, so single-message harassment must be explicit (threats, slurs, contact-info posting). |
| `sexual` | Explicit sexual material, sexual solicitation, sexual descriptions of minors (Section 5.5 covers the always-reject case). | Discussion of SDG 3 / SDG 5 reproductive health is NOT this; clinical and educational content scores low. |
| `self_harm` | Content promoting, glorifying, or providing methods for self-harm or suicide. | Help-seeking ("I'm struggling, where can I go") is NOT this and the prompt says so. The platform welcomes help-seeking and routes it (v0.2). |
| `violence` | Incitement or graphic glorification of violence against people. | News-style reporting of violence (with SDG-relevant context) is allowed; calls to harm a specific group are not. |
| `illegal` | Material that is illegal in the jurisdiction of the hosted instance. CSAM and credible threats are pinned at 1.0. | Jurisdiction varies — self-hosters configure via `docs/configuration.md`; the hosted instance defaults to the laws of its hosting jurisdiction. |
| `spam` | Commercial promotion, link-stuffing, automated/repetitive content. | Citing a paper with one link vs. dropping five affiliate links in three comments; link count is a heuristic, not a rule (Section 5.8). |
| `misinfo` | Demonstrably false factual claims on SDG-relevant topics (climate denial, vaccine misinformation, etc.). | Held for human review per `docs/moderation-policy.md` when contested. The model errs toward `hold_for_review` (a score in the 0.25–0.85 band), not auto-reject, for anything epistemically contested. |
| `off_topic` | Unrelated to the group's declared SDG codes. | Multi-SDG groups may legitimately host wide-ranging discussion; this scores high only when nothing in the group's SDG set is plausibly relevant. |

### 4.2 Calibration: what each band means in practice

The bands the prompt anchors against (Section 2.2) align with the policy thresholds:

| Band | Score | Policy outcome (default thresholds) | Author experience |
| --- | --- | --- | --- |
| Safe | 0.00–0.10 | `auto_publish` if max across axes is in this band. | Post appears. Status `published`. No notification. |
| Trace | 0.10–0.25 | `auto_publish`. | Same as safe. |
| Watch | 0.25–0.50 | `hold_for_review` (unless trusted reputation). | Author sees "under review"; queue entry created. |
| Likely | 0.50–0.85 | `hold_for_review`. | Same as watch; the reasoning text usually names the issue. |
| Reject | 0.85–1.00 | `auto_reject` (immediately). | Author sees "rejected" with reasoning. Can appeal. |

Implementation detail: the policy in `decide()` keys off the **maximum** score across all axes (`Math.max(...scores)`). A post with 0.4 on toxicity and 0.3 on spam holds for review on toxicity, not on spam — the reasoning string says so.

### 4.3 Calibration drift

Calibration is a property of the prompt + model pair, not the architecture. Two failure modes to watch:

- **Drift across model versions.** When Anthropic releases `claude-sonnet-4-6` and we bump `ANTHROPIC_MODEL`, the same input may score differently. Mitigation: every PR that bumps the model must re-record the fixtures (Section 6) and a maintainer must spot-check the diff for surprises before merge.
- **Drift across prompt edits.** Same risk; same mitigation. The prompt-version archive (Section 2.2) gives us a paper trail from any decision row back to the exact text that produced it.

### 4.4 What scores do NOT do

- They are not used for ranking, recommendation, or feed ordering. Scores influence verdict only.
- They are not aggregated per author into a "toxicity profile" — reputation is the only signal that crosses post boundaries (per `packages/trust/src/index.ts`).
- They are not exposed in any API surface to other authors. The author sees their own decision's reasoning; nobody sees anyone else's scores. (The transparency page aggregates across all decisions; it does not surface per-author data.)

---

## 5. Edge cases

The cases the prompt is calibrated against in fixtures (Section 6). Each gets at least one fixture file so the behavior is locked in by replay tests.

### 5.1 Code blocks

Triple-backtick fenced code, inline backtick code, and YAML/JSON config snippets are content. They are not penalized for "looking weird"; they ARE inspected for what they contain. A code block that spells out a slur is still toxic; a code block that demonstrates an HTTP call is not.

Calibration: the prompt explicitly mentions code blocks. Fixture `anthropic/code-block-benign.json` (a SQL query in a post about an SDG dashboard) must score low across the board. Fixture `anthropic/code-block-slur.json` (a code comment containing a slur) must score high on the right axis.

### 5.2 Quoted abusive content

"I keep seeing this thrown at me in DMs: '[slur]'. Has anyone else?" is a report of abuse, not abuse. The system prompt: "Quoting abuse to condemn it is NOT toxicity. Look at the speech act."

Calibration: the single hardest case in practice. Both directions in fixtures: `anthropic/quoted-abuse-condemnation.json` (must score low on toxicity); `anthropic/quoted-abuse-pretextual.json` — "I'm just quoting what someone said: [slur slur slur]" with no condemnation, used as cover (must score high). Occasional misclassification on the boundary is expected; that's what `hold_for_review` is for, and the appeal flow (per `docs/moderation-policy.md`) closes the loop.

### 5.3 Satire and criticism

Sharp criticism of public ideas, organizations, or policies is allowed. Mocking a billionaire's stance on climate policy is not toxicity; calling a fellow contributor a slur is. The line is at the person, not the idea.

Calibration: fixture `anthropic/satire-policy.json` — a satirical comment on a national net-zero pledge. Must score low on toxicity, low on misinfo (it's not a factual claim).

### 5.4 Mid-text language switch

"The proposal is good but يجب أن نناقش التمويل" (English then Arabic) is one post in two languages. The prompt says "score the whole." Both passes of the model should see both halves; the scores apply to the union.

Calibration: fixture `anthropic/code-switch-en-ar.json` — benign code-switch must score low. Fixture `anthropic/code-switch-abuse-hidden.json` — benign English wrapping abusive Arabic, designed to test whether the model actually reads both halves. Must score high.

### 5.5 Content under 20 characters

"Yes." "I disagree." "Run it." Very short posts can be legitimate (replies, acks) or low-effort drive-bys. The prompt does not auto-reject short content; the policy does not have a length threshold.

Calibration: fixture `anthropic/short-yes.json` — must score low. Fixture `anthropic/short-slur.json` — five characters, single slur, must score high on toxicity.

The schema does not enforce a minimum length on the input. The platform's posts table will enforce its own minimum at the application layer (out of scope here).

### 5.6 ALL-CAPS

ALL-CAPS is not by itself toxicity. The prompt says: "Do not penalize ALL-CAPS unless it pairs with abusive content."

Calibration: fixture `anthropic/all-caps-enthusiasm.json` — "I REALLY LOVED YOUR PROPOSAL" must score low. Fixture `anthropic/all-caps-abuse.json` — same energy but pointed at a person with a slur must score high on toxicity. The model should not be tricked into reading ALL-CAPS as a feature.

### 5.7 Link-stuffing

More than three external links in a single short post, especially with commercial or affiliate URLs, score high on spam. The prompt does not hard-code a link count; the heuristic is "lots of links + thin context + commercial pattern = spam."

Calibration: fixture `anthropic/links-citation.json` — three academic citations in a SDG 13 post must score low on spam. Fixture `anthropic/links-affiliate.json` — five Amazon affiliate URLs in a two-sentence post must score high. Fixture `anthropic/links-repost.json` — the same link pasted five times in one post must score high.

### 5.8 Deliberate misspelling

"k!ll y0urself" or "f@gg0t" — obfuscated abuse is still abuse. The model recognizes leetspeak and homoglyph substitutions natively; the prompt does not need to enumerate them.

Calibration: fixture `anthropic/obfuscation-slur.json` — must score high on the correct axis. We do not maintain a substitution-decoding table; we rely on the model. If a specific substitution slips through, we add a fixture (and an appeal note) — we do not patch the prompt with banned-word lists.

### 5.9 Help-seeking content (self-harm class)

"I've been having dark thoughts and I don't know where to turn" is help-seeking, not promotion. The prompt is explicit: "Help-seeking about self-harm is NOT self_harm; it is a request for support and should score at most 0.10 on that axis."

Calibration: fixture `anthropic/help-seeking-self-harm.json` — must score ≤ 0.10 on `self_harm` and low elsewhere. v0.2 will add a help-resources routing surface; v0.1 simply does not punish help-seeking.

### 5.10 Empty / whitespace-only content

The provider treats empty input as a degenerate case: all scores `0`, verdict `auto_publish`, reasoning `'no content'`. The application layer should not submit empty posts to begin with (form validation catches this) but the provider is defensive.

---

## 6. Fixture strategy

The test suite must run deterministically without burning API tokens or requiring a local Ollama server in CI. We record real provider outputs once, store them as JSON, and replay them in unit tests.

### 6.1 Directory layout

```
packages/moderation/fixtures/
  anthropic/
    benign-short.json
    benign-long.json
    code-block-benign.json
    code-block-slur.json
    quoted-abuse-condemnation.json
    quoted-abuse-pretextual.json
    satire-policy.json
    code-switch-en-ar.json
    code-switch-abuse-hidden.json
    short-yes.json
    short-slur.json
    all-caps-enthusiasm.json
    all-caps-abuse.json
    links-citation.json
    links-affiliate.json
    links-repost.json
    obfuscation-slur.json
    help-seeking-self-harm.json
    off-topic.json
    refusal.json
  ollama/
    benign-short.json
    safe.json
    unsafe-S10.json
    unsafe-multi.json
    aux-spam.json
    aux-misinfo.json
  README.md              # the recipe for re-recording
```

### 6.2 Fixture file shape

Each fixture captures the **provider response**, not just the input. This lets a test replay the entire path through the adapter — including any post-processing — against a known-good output.

```json
{
  "_meta": {
    "scenario": "quoted-abuse-condemnation",
    "recorded_at": "2026-05-18T12:34:56Z",
    "recorded_model": "claude-sonnet-4-5",
    "prompt_sha": "9f2c8e..."
  },
  "input": {
    "text": "I keep seeing this in DMs and it's awful: '[slur]'. Has anyone else dealt with this?",
    "locale": "en",
    "context": { "groupSdgCodes": ["5"], "authorReputation": 42, "targetType": "post" }
  },
  "raw_response": {
    "id": "msg_01abc...",
    "type": "message",
    "model": "claude-sonnet-4-5",
    "stop_reason": "end_turn",
    "usage": { "input_tokens": 312, "output_tokens": 187 },
    "parsed_output": {
      "scores": { "toxicity": 0.08, "hate": 0.05, "harassment": 0.10, "sexual": 0.00, "self_harm": 0.00, "violence": 0.00, "illegal": 0.00, "spam": 0.00, "misinfo": 0.00, "off_topic": 0.00 },
      "verdict": "auto_publish",
      "reasoning": "Author quotes a slur to report it as harassment they received, not to use it; speech act is help-seeking."
    }
  },
  "expected_result": {
    "scores": { "toxicity": 0.08, "harassment": 0.10 },
    "verdict": "auto_publish",
    "reasoning": "Author quotes a slur to report it as harassment they received, not to use it; speech act is help-seeking.",
    "provider": "anthropic",
    "model": "claude-sonnet-4-5"
  }
}
```

`_meta.prompt_sha` is the SHA-256 of the system prompt at recording time. If the prompt changes (Section 2.2), every fixture's `prompt_sha` mismatches and the recording script (Section 6.4) refuses to skip them — forcing a re-record.

`expected_result` is what the adapter is expected to return after post-processing — narrowing to the partial-record shape, picking provider + model identifiers, etc.

### 6.3 Replay test pattern

The test fixture loader is `packages/moderation/src/test/fixture-replay.ts` (lands with C-MOD-1):

- A mock `fetch` (or SDK transport mock — see SDK helpers in `/anthropics/anthropic-sdk-typescript`) returns the `raw_response` for the input matching the fixture.
- The adapter's `classify()` is called with the fixture `input`.
- The result is asserted against `expected_result`.

This is a behavior test of the adapter, not a test of Claude. The model's correctness is the prompt's responsibility; the adapter's correctness is the code's responsibility, and that is what fixture replay verifies.

### 6.4 Recording / re-recording

A single script under `packages/moderation/scripts/record-fixtures.ts` (lands with C-MOD-1):

```ts
// Pseudocode
for (const inputFile of listFixtureInputs('anthropic')) {
  if (existingFixture.prompt_sha === currentPromptSha && !flags.force) continue;
  const real = await realAnthropicProvider.classify(inputFile.input);
  writeFixture(inputFile.name, { input: inputFile.input, raw_response: real.raw, expected_result: real.processed });
}
```

Re-records only the fixtures whose `prompt_sha` is stale, unless `--force`. The script costs one API call per stale fixture; full re-record of 20 fixtures is ~$0.02 at Sonnet pricing (Section 7).

CI never runs the recorder. Local development runs it once before a PR that changes the prompt or model. The PR review should include "fixtures re-recorded; diffs sane."

### 6.5 Ollama fixtures

Same shape; the `raw_response` captures the Ollama generate-API response (the text returned in the `response` field, plus timing fields the adapter ignores). Recording requires a local Ollama server with `llama-guard3:8b` pulled; the script `packages/moderation/scripts/record-ollama-fixtures.ts` is the equivalent. CI does not need Ollama; it replays.

### 6.6 What fixtures do NOT cover

- Network failures, timeouts, rate limits. Those are tested with separate transport-level mocks in `anthropic.test.ts` and `ollama.test.ts`; the fixture format does not represent failure modes.
- The malformed-JSON case is mocked by a hand-written response payload, not a recorded one — by definition the SDK never produces a malformed shape.
- Cross-locale variations beyond the recorded set. Adding a Hindi or Mandarin fixture is a follow-up; v0.1 ships with the locales most heavily exercised by early users (English, plus one each of Spanish, Arabic, and an Asian-script language).

---

## 7. Cost envelope

### 7.1 Per-classification token budget (Anthropic Sonnet 4.5)

Typical short-form post on Earthropy:

- Input tokens: system prompt (~600) + user template overhead (~80) + post text (median 250 tokens, ~1000 chars). Total ~930 tokens.
- Output tokens: structured JSON with ten floats + reasoning. ~180 tokens.

At Sonnet pricing (subject to change; pin the source in `docs/configuration.md` when C-MOD-1 lands): roughly **$0.003 per classification** at the time of writing, using current public Sonnet 4.5 rates ($3/MTok input, $15/MTok output as a rule-of-thumb anchor; the real numbers go in the configuration doc with a citation).

Long-form post (1500 token body):

- Input ~2200 tokens.
- Output ~200 tokens.
- ~**$0.010 per classification**.

### 7.2 Daily / monthly back-of-envelope

A hosted instance posting 500 posts + 2000 comments per day (a generous v0.1 estimate): 2500 classifications/day × $0.003 average ≈ **$7.50/day**, monthly **~$225**. Comments are shorter on average; the realistic mix lands closer to **$150/month**. The single-digit-dollars-per-day envelope is the design target. If observed traffic doubles the estimate, see Section 7.4.

### 7.3 Cost transparency

The hosted instance publishes its monthly moderation spend on the transparency page (per `docs/moderation-policy.md` — "aggregate stats"). Self-hosters running Anthropic see the same envelope; self-hosters running Ollama see zero API cost and hardware cost they manage themselves.

### 7.4 Trigger for self-hoster swap to Ollama

The default-Anthropic stance is for the hosted instance and for self-hosters who want zero ops on the classifier. The trigger conditions for swapping to Ollama, documented in `docs/self-host.md` (update in a follow-up task):

- **Cost**: monthly Anthropic spend > self-hoster's tolerance. Concrete number per the operator; the envelope above lets them estimate.
- **Privacy**: instances where the operator must not send user content to a third party (some institutional deployments). Ollama keeps content local.
- **Latency**: Anthropic median is ~1.5s end-to-end including network; Ollama on local hardware is ~300ms for Llama Guard 3 8B on a GPU, ~3s on CPU. Latency-sensitive deployments may go either way; the hosted instance accepts ~1.5s.
- **Compliance**: GDPR or jurisdiction-specific rules that bar sending content to U.S.-hosted APIs. Ollama on EU-hosted hardware satisfies many such rules out of the box.
- **Capacity**: Anthropic rate limits at the API key level. A high-volume instance may saturate; Ollama scales by adding hardware.

The swap is a single env change (`MODERATION_PROVIDER=ollama` + the Ollama config vars). No code change.

---

## 8. Failure modes

The `decide()` policy in `packages/moderation/src/provider.ts` is the floor: it operates on a `ModerationResult` and produces a verdict. Provider-failure behavior is separate — the provider may never return a `ModerationResult` at all. The worker (C-WORKER-1) is the layer that handles failure; the design here pins what it must do.

### 8.1 Provider unavailable (network error, DNS failure)

- The adapter's HTTP/SDK call throws.
- The worker catches, increments a Prometheus counter (per `@repo/observability` log + future metrics work; for v0.1 `log.warn` is the surface), and retries with backoff: 1s, 4s, 16s.
- After three failed attempts: write a `moderation_decisions` row with `verdict='hold_for_review'`, `provider='<configured>'`, `model='<configured>'`, `scores={}`, `reasoning='provider unavailable after retries; queued for human review'`. The post stays in `pending_review` (per `contentStatus`) and the moderator queue picks it up.
- The worker does **not** write `auto_publish` on provider failure. Defaulting open would mean any provider outage publishes everything unmoderated, which violates the pre-publication promise.

### 8.2 Timeout

- Request budget: 10 seconds for Anthropic, 30 seconds for Ollama (CPU inference can be slow on small hardware).
- The adapter wraps the SDK / `fetch` call with `AbortController` at the configured timeout.
- Timeout is treated identically to unavailable: same retry, same fail-closed-to-review behavior.
- The timeout is configurable per provider (`ANTHROPIC_TIMEOUT_MS`, `OLLAMA_TIMEOUT_MS`); the defaults above ship.

### 8.3 Rate-limited

- Anthropic returns HTTP 429 with a `retry-after` header.
- The adapter respects the header. If `retry-after` ≤ 60s the worker waits and retries in-job. If > 60s, the worker requeues the job with a delay (BullMQ `delayed` queue) and moves on to the next.
- Persistent 429s (the API key is over its monthly quota) are an operator concern. The transparency page (Section 9.4) surfaces the rate; the operator either tops up or swaps providers.
- Ollama does not rate-limit in this sense (it's a local server); a 503 from Ollama means the server is overloaded and the worker treats it as timeout (Section 8.2).

### 8.4 Malformed JSON

- With `messages.parse` and a schema, the SDK validates and throws if the model emits structurally invalid output (e.g., a stop mid-stream that breaks the JSON, or a refusal that produces no `parsed_output`).
- The adapter catches the SDK validation error.
- Behavior: same as Section 8.1 — `hold_for_review` with reasoning `'provider output failed schema validation; held for human review'`. No retry, because retrying a deterministic-at-`temperature=0` call against the same input and prompt will produce the same output.
- The malformed-JSON rate is tracked; a spike means the prompt is producing edge-case outputs and needs review.

### 8.5 Refusal (Anthropic-specific)

Covered in Section 2.6. Treated as a provider-failure (no retry, hold for human).

### 8.6 Ollama: aux-model failure

If the aux model (`OLLAMA_AUX_MODEL`) is unavailable but the safety model succeeded, the adapter degrades: native-axis scores from Llama Guard, zeros for `spam | misinfo | off_topic`. The reasoning string notes the partial classification. The worker does not retry the aux call.

### 8.7 Dead-letter queue (DLQ)

BullMQ's failed-job behavior (configured in C-WORKER-1) sends repeatedly failing jobs to a DLQ after the retry budget is exhausted. A DLQ entry is operator-visible (a `moderation_queue_failed` table or a dashboard surface — C-WORKER-1 decides which). DLQ entries do NOT block the post from being held for human review; the `hold_for_review` decision is written in Section 8.1 before any DLQ handling.

### 8.8 Summary table

| Failure | Detection | Retry? | Final action |
| --- | --- | --- | --- |
| Network error / DNS | fetch/SDK throws | 3× exponential backoff | hold_for_review + reasoning |
| Timeout | AbortController fires | 3× exponential backoff | hold_for_review + reasoning |
| HTTP 429 (Anthropic) | response status | Honor `retry-after`; requeue if > 60s | Eventually succeeds or DLQ |
| HTTP 5xx | response status | 3× exponential backoff | hold_for_review + reasoning |
| Refusal (Anthropic) | `stop_reason='refusal'` or no `parsed_output` | No | hold_for_review + reasoning |
| Malformed output (schema fail) | SDK throws on parse | No | hold_for_review + reasoning |
| Ollama aux unavailable | second-call error | No | Partial result; native axes only |

The constant in all rows: never write `auto_publish` on failure. The platform's mission depends on the pre-publication gate being a real gate.

---

## 9. Logging surface

Every classification produces exactly one row in `moderation_decisions` (per `packages/database/src/schema/moderation.ts`). The schema is fixed and load-bearing for the transparency promise.

### 9.1 Field-by-field for an AI decision

| Column | Source | Example |
| --- | --- | --- |
| `id` | DB default `gen_random_uuid()` | `f3a7...e4` |
| `targetType` | The job payload | `'post'` |
| `targetId` | The job payload | the post's uuid |
| `provider` | `ModerationResult.provider` from the adapter | `'anthropic'` |
| `model` | `ModerationResult.model` from the adapter | `'claude-sonnet-4-5'` |
| `scores` | `ModerationResult.scores` serialized as jsonb | (Section 9.2) |
| `verdict` | The output of `decide()`, NOT `ModerationResult.verdict` | `'auto_publish'` |
| `reasoning` | `ModerationResult.reasoning` | "Author quotes a slur to report it..." |
| `reviewerId` | NULL (set only when a human writes the row) | NULL |
| `createdAt` | DB default `now()` | `2026-05-18 12:34:56+00` |

The column `verdict` records the **post-policy** verdict, not the provider's suggestion. The provider's `verdict` is informational and not preserved on its own — the policy verdict supersedes it. If we later want to study disagreement between provider and policy we add a column; in v0.1 we don't.

### 9.2 `scores` jsonb shape

Stored as the partial record the schema's `ModerationScores` type calls for. Absent categories are absent (not zero-filled). Example:

```json
{
  "toxicity": 0.08,
  "harassment": 0.10,
  "off_topic": 0.42
}
```

Categories scoring `< 0.05` (effectively noise) are dropped on write to keep the jsonb compact. This is an adapter-side decision, documented in code, and irrelevant to the verdict (the policy reads the dropped values as 0 anyway).

### 9.3 `reasoning` shape

A short human-readable string (≤ 280 chars per the prompt schema). Neutral tone, English. Surfaced to the author when the decision is `hold_for_review`, `auto_reject`, `human_reject`. NOT surfaced to other users; NOT surfaced when `auto_publish` (the author sees nothing because publishing is the default).

The exact UI strings around the reasoning ("This was held because..." vs the reasoning text itself) live in the `apps/app` i18n bundles; the column stores the raw reasoning only.

### 9.4 Transparency page (C-TRANS-1)

The aggregate stats the public transparency page exposes, all derivable from `moderation_decisions` + `appeals`:

- Decisions per category, last 30 days (count where `scores->>'<cat>' >= 0.5`).
- Verdict distribution (`auto_publish` / `hold_for_review` / `auto_reject` / `human_publish` / `human_reject`) over time.
- Override rate: percentage of `hold_for_review` decisions that became `human_publish` (the AI was over-cautious).
- Appeal volume and outcome (from `appeals.resolution`).
- Median time-to-resolution for held content.
- Provider + model in use (current setting).
- Provider-failure rate (rows where `scores = {}` and `reasoning` mentions provider failure or refusal).

Computation lives in C-TRANS-1; the schema lets the queries run efficiently because the `mod_decisions_target_idx` and `mod_decisions_created_idx` indexes are in place.

### 9.5 Author-visible surface

Per `docs/moderation-policy.md` "Transparency promise" — when content is held or rejected, the author sees:

- The provider id (`'anthropic'` / `'ollama-llama-guard'`).
- The model id (`'claude-sonnet-4-5'` / `'llama-guard3:8b'`).
- The reasoning string.
- A button to file an appeal (writes to `appeals`).

The author does NOT see raw scores; the calibration anchors are an internal detail and exposing them would invite "I scored 0.84, why was I held?" debates that don't help the platform.

### 9.6 Immutability

`moderation_decisions` rows are never UPDATEd or DELETEd. A moderator override is a new row with `provider='human'`, `model='manual'`, `reviewerId` set, `verdict` ∈ `{'human_publish','human_reject'}`. The content's effective state is derived from the latest row for that `(targetType, targetId)` — read query: `ORDER BY created_at DESC LIMIT 1`. This is enforced by convention (no row-level Postgres trigger in v0.1); the application layer is the only writer.

---

## 10. Open questions

None — all decisions resolved here. C-MOD-1 (Anthropic provider) and C-MOD-2 (Ollama provider) have a stable contract.
