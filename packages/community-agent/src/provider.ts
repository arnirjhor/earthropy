// The community-agent contract. New providers implement CommunityAgentProvider;
// the rest of Earthropy depends only on this interface. Self-hosters can swap
// providers via the COMMUNITY_AGENT_PROVIDER env var without code changes.
//
// Pattern follows packages/moderation/src/provider.ts exactly.

import type {
  CandidateGroup,
  CandidatePost,
  DigestContent,
  GroupSuggestion,
  StaleDiscussion,
} from './types.ts';

export interface SuggestGroupsInput {
  readonly userId: string;
  /** SDG codes the user has expressed interest in (from user_followed_sdgs). */
  readonly userSdgCodes: readonly string[];
  /** Candidate groups to rank. Provider chooses from these; no external lookup. */
  readonly candidateGroups: readonly CandidateGroup[];
  /** Max number of suggestions to return. Default: 5. */
  readonly maxSuggestions?: number;
}

export interface FindStaleDiscussionsInput {
  readonly groupId: string;
  /** Posts in this group sorted by last-activity ascending. */
  readonly posts: readonly {
    readonly id: string;
    readonly title: string;
    readonly authorId: string;
    readonly lastActivityAt: Date;
    readonly daysSinceActivity: number;
    readonly sdgCodes: readonly string[];
  }[];
  /** How many days of inactivity before a post is considered stale. */
  readonly staleDays: number;
}

export interface DraftDigestInput {
  readonly groupId: string;
  readonly groupName: string;
  readonly period: 'weekly';
  readonly periodStart: Date;
  readonly periodEnd: Date;
  /** Published posts in the period, ordered by publishedAt descending. */
  readonly posts: readonly CandidatePost[];
}

export interface CommunityAgentProvider {
  /**
   * Rank and filter candidate groups for a new or existing user based on their
   * stated SDG interests.
   */
  suggestGroupsForUser(input: SuggestGroupsInput): Promise<readonly GroupSuggestion[]>;

  /**
   * Identify stale posts within a group and generate a re-engagement prompt for
   * each one, to be surfaced to group admins.
   */
  findStaleDiscussions(input: FindStaleDiscussionsInput): Promise<readonly StaleDiscussion[]>;

  /**
   * Draft a weekly digest for a group, producing a subject line, summary, and
   * per-post excerpts from the period's published content.
   */
  draftDigest(input: DraftDigestInput): Promise<DigestContent>;
}
