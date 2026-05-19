// Shared types for the community-agent package.
// All provider implementations and task modules depend on these.

export interface GroupSuggestion {
  readonly groupId: string;
  readonly groupSlug: string;
  readonly groupName: string;
  readonly sdgCodes: readonly string[];
  readonly relevanceScore: number;
  /** Short explanation for why this group was suggested. */
  readonly reason: string;
}

export interface StaleDiscussion {
  readonly postId: string;
  readonly postTitle: string;
  readonly groupId: string;
  readonly authorId: string;
  readonly lastActivityAt: Date;
  readonly daysSinceActivity: number;
  /** Suggested re-engagement prompt for group admins. */
  readonly suggestionText: string;
}

export interface DigestItem {
  readonly postId: string;
  readonly postTitle: string;
  readonly authorHandle: string;
  readonly publishedAt: Date;
  readonly sdgCodes: readonly string[];
  readonly excerpt: string;
}

export interface DigestContent {
  readonly groupId: string;
  readonly groupName: string;
  readonly period: 'weekly';
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly subjectLine: string;
  readonly summaryText: string;
  readonly items: readonly DigestItem[];
  /** Provider identifier, e.g. 'anthropic'. */
  readonly provider: string;
  /** Model identifier. */
  readonly model: string;
}

export interface CandidateGroup {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly sdgCodes: readonly string[];
}

export interface CandidatePost {
  readonly id: string;
  readonly title: string;
  readonly authorHandle: string;
  readonly publishedAt: Date;
  readonly sdgCodes: readonly string[];
  readonly body: string;
}
