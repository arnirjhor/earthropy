// The moderation contract. New providers implement ModerationProvider; the
// rest of Earthropy depends only on this interface. Self-hosters can swap
// providers via the MODERATION_PROVIDER env var without code changes.

export type ModerationCategory =
  | 'toxicity'
  | 'hate'
  | 'harassment'
  | 'sexual'
  | 'self_harm'
  | 'violence'
  | 'illegal'
  | 'spam'
  | 'misinfo'
  | 'off_topic';

export type ModerationScores = Partial<Record<ModerationCategory, number>>;

export type ModerationVerdict = 'auto_publish' | 'hold_for_review' | 'auto_reject';

export interface PostContext {
  /** Group SDG codes — used to judge whether content is off-topic for the group. */
  readonly groupSdgCodes?: readonly string[];
  /** Author reputation; provider may use as a soft prior, but the policy layer applies thresholds. */
  readonly authorReputation?: number;
  /** What kind of artifact we're classifying. */
  readonly targetType: 'post' | 'comment';
}

export interface ModerationInput {
  readonly text: string;
  readonly locale: string;
  readonly context: PostContext;
}

export interface ModerationResult {
  /** Scores in [0, 1]; absent categories should be treated as 0. */
  readonly scores: ModerationScores;
  /** Provider's chosen verdict before policy thresholds apply. The policy layer may override. */
  readonly verdict: ModerationVerdict;
  /** Short human-readable reasoning. Surfaced to the author when content is held or rejected. */
  readonly reasoning: string;
  /** Provider identifier, e.g. 'anthropic'. */
  readonly provider: string;
  /** Model identifier, e.g. 'claude-opus-4-5'. */
  readonly model: string;
}

export interface ModerationProvider {
  classify(input: ModerationInput): Promise<ModerationResult>;
}

// Policy thresholds — applied AFTER the provider returns scores. A provider may
// suggest a verdict; the policy decides the final verdict using these knobs.
export interface ModerationPolicy {
  readonly autoPublishMax: number; // verdict=auto_publish if every score < this
  readonly autoRejectMin: number;  // verdict=auto_reject if any score >= this
  readonly trustedReputation: number; // trusted authors skip pending_review for borderline content
}

export const DEFAULT_POLICY: ModerationPolicy = {
  autoPublishMax: 0.25,
  autoRejectMin: 0.85,
  trustedReputation: 500,
};

export function decide(
  result: ModerationResult,
  policy: ModerationPolicy,
  authorReputation: number,
): ModerationVerdict {
  const scores = Object.values(result.scores);
  const max = scores.length === 0 ? 0 : Math.max(...scores);
  if (max >= policy.autoRejectMin) return 'auto_reject';
  if (max < policy.autoPublishMax) return 'auto_publish';
  if (authorReputation >= policy.trustedReputation) return 'auto_publish';
  return 'hold_for_review';
}
