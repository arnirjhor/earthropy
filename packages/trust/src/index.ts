export type Tier = 'newcomer' | 'member' | 'trusted' | 'anchor';

// Reputation thresholds. Crossing a threshold up unlocks new privileges; the
// app layer checks tierOf(user.reputation) at request time rather than caching.
export const THRESHOLDS: Record<Tier, number> = {
  newcomer: 0,
  member: 10,
  trusted: 100,
  anchor: 500,
};

export function tierOf(reputation: number): Tier {
  if (reputation >= THRESHOLDS.anchor) return 'anchor';
  if (reputation >= THRESHOLDS.trusted) return 'trusted';
  if (reputation >= THRESHOLDS.member) return 'member';
  return 'newcomer';
}

export type Capability =
  | 'post.create'
  | 'comment.create'
  | 'post.autopublish_borderline' // skip pending_review for borderline content
  | 'group.create'
  | 'group.moderate' // requires moderator role within a group
  | 'appeal.review';

export function can(
  capability: Capability,
  reputation: number,
  opts: { groupRole?: 'owner' | 'moderator' | 'member'; accountAgeHours?: number } = {},
): boolean {
  const tier = tierOf(reputation);
  switch (capability) {
    case 'post.create':
    case 'comment.create':
      return (opts.accountAgeHours ?? 0) >= 24 || tier !== 'newcomer';
    case 'post.autopublish_borderline':
      return tier === 'trusted' || tier === 'anchor';
    case 'group.create':
      return tier !== 'newcomer';
    case 'group.moderate':
      return opts.groupRole === 'owner' || opts.groupRole === 'moderator';
    case 'appeal.review':
      return tier === 'anchor';
  }
}

// Deltas applied via reputation_events. Kept conservative; tuned against signal.
export const DELTAS = {
  post_accepted: 5,
  post_rejected: -3,
  comment_accepted: 1,
  comment_rejected: -1,
  helpful_reaction: 1,
  moderator_grant: 25,
  appeal_resolved_for_user: 2,
} as const;
