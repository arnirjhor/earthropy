/**
 * AnthropicCommunityAgentProvider
 *
 * Implements CommunityAgentProvider using the Anthropic Messages API.
 * Uses JSON-mode prompts (tool_use with a schema) to get structured outputs.
 *
 * Three tasks:
 *   - suggestGroupsForUser  — ranks candidate groups for a user
 *   - findStaleDiscussions  — identifies stale posts and drafts re-engagement prompts
 *   - draftDigest           — drafts weekly digest content for a group
 */

import Anthropic from '@anthropic-ai/sdk';
import { getApiKey, getModel, getTimeoutMs } from './env.ts';
import {
  AgentProviderMalformed,
  AgentProviderTimeout,
  AgentProviderUnavailable,
} from './errors.ts';
import type {
  CommunityAgentProvider,
  DraftDigestInput,
  FindStaleDiscussionsInput,
  SuggestGroupsInput,
} from './provider.ts';
import type { DigestContent, GroupSuggestion, StaleDiscussion } from './types.ts';

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSuggestGroupsPrompt(input: SuggestGroupsInput): string {
  const groups = input.candidateGroups
    .map(
      (g) =>
        `- id: ${g.id}, slug: ${g.slug}, name: "${g.name}", sdgs: [${g.sdgCodes.join(', ')}], description: "${g.description.slice(0, 200)}"`,
    )
    .join('\n');

  return `You are a community-manager agent for Earthropy, a platform for coordinating global action on the 17 UN Sustainable Development Goals (SDGs).

A user (id: ${input.userId}) follows these SDG codes: [${input.userSdgCodes.join(', ')}].

Candidate groups available on the platform:
${groups}

Return up to ${input.maxSuggestions ?? 5} group suggestions ordered by relevance to the user's SDG interests. For each suggestion provide a brief reason (1-2 sentences).`;
}

function buildStaleDiscussionsPrompt(input: FindStaleDiscussionsInput): string {
  const posts = input.posts
    .map(
      (p) =>
        `- postId: ${p.id}, title: "${p.title}", daysInactive: ${p.daysSinceActivity}, sdgs: [${p.sdgCodes.join(', ')}], authorId: ${p.authorId}`,
    )
    .join('\n');

  return `You are a community-manager agent for Earthropy. A group (id: ${input.groupId}) has the following posts that have been inactive for ${input.staleDays}+ days:

${posts}

For each stale post, write a short re-engagement suggestion (1-2 sentences) that group admins can use to revive the discussion. Focus on the SDG themes and encourage meaningful follow-ups.`;
}

function buildDigestPrompt(input: DraftDigestInput): string {
  const posts = input.posts
    .map(
      (p) =>
        `- postId: ${p.id}, title: "${p.title}", author: @${p.authorHandle}, sdgs: [${p.sdgCodes.join(', ')}], publishedAt: ${p.publishedAt.toISOString()}, excerpt: "${p.body.slice(0, 300)}"`,
    )
    .join('\n');

  return `You are a community-manager agent for Earthropy. Write a weekly digest for the group "${input.groupName}" (id: ${input.groupId}).

Period: ${input.periodStart.toISOString()} to ${input.periodEnd.toISOString()}
Published posts this week:
${posts.length > 0 ? posts : '(no posts this week)'}

Provide:
1. A concise email subject line (max 60 chars)
2. A 2-3 sentence summary of the week's activity
3. A one-sentence excerpt for each post, highlighting the SDG relevance`;
}

// ---------------------------------------------------------------------------
// Tool schemas for structured output
// ---------------------------------------------------------------------------

const SUGGEST_GROUPS_TOOL: Anthropic.Tool = {
  name: 'output_suggestions',
  description: 'Return group suggestions for the user.',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            groupId: { type: 'string' },
            relevanceScore: { type: 'number', minimum: 0, maximum: 1 },
            reason: { type: 'string' },
          },
          required: ['groupId', 'relevanceScore', 'reason'],
        },
      },
    },
    required: ['suggestions'],
  },
};

const STALE_DISCUSSIONS_TOOL: Anthropic.Tool = {
  name: 'output_stale_discussions',
  description: 'Return stale discussion entries with re-engagement suggestions.',
  input_schema: {
    type: 'object' as const,
    properties: {
      discussions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            postId: { type: 'string' },
            suggestionText: { type: 'string' },
          },
          required: ['postId', 'suggestionText'],
        },
      },
    },
    required: ['discussions'],
  },
};

const DRAFT_DIGEST_TOOL: Anthropic.Tool = {
  name: 'output_digest',
  description: 'Return the weekly digest content.',
  input_schema: {
    type: 'object' as const,
    properties: {
      subjectLine: { type: 'string' },
      summaryText: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            postId: { type: 'string' },
            excerpt: { type: 'string' },
          },
          required: ['postId', 'excerpt'],
        },
      },
    },
    required: ['subjectLine', 'summaryText', 'items'],
  },
};

// ---------------------------------------------------------------------------
// Internal schema types for tool use inputs
// ---------------------------------------------------------------------------

interface SuggestOutput {
  suggestions: Array<{
    groupId: string;
    relevanceScore: number;
    reason: string;
  }>;
}

interface StaleOutput {
  discussions: Array<{
    postId: string;
    suggestionText: string;
  }>;
}

interface DigestOutput {
  subjectLine: string;
  summaryText: string;
  items: Array<{
    postId: string;
    excerpt: string;
  }>;
}

// ---------------------------------------------------------------------------
// Error rethrow helper
// ---------------------------------------------------------------------------

function rethrowAnthropicError(err: unknown, timeoutMs: number): never {
  if (
    err instanceof AgentProviderMalformed ||
    err instanceof AgentProviderUnavailable ||
    err instanceof AgentProviderTimeout
  ) {
    throw err;
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    throw new AgentProviderTimeout(
      `Anthropic community-agent request timed out after ${timeoutMs}ms`,
      err,
    );
  }
  if (err instanceof Error && err.name === 'AbortError') {
    throw new AgentProviderTimeout(
      `Anthropic community-agent request aborted (timeout ${timeoutMs}ms)`,
      err,
    );
  }
  if (err instanceof Anthropic.APIConnectionError) {
    throw new AgentProviderUnavailable('Anthropic API connection failed', err);
  }
  if (err instanceof Anthropic.RateLimitError) {
    throw new AgentProviderUnavailable('Anthropic rate limit hit', err);
  }
  if (err instanceof Anthropic.APIError && err.status !== undefined && err.status >= 500) {
    throw new AgentProviderUnavailable(`Anthropic server error (${err.status})`, err);
  }
  if (err instanceof Error) {
    throw new AgentProviderUnavailable(`Unexpected provider error: ${err.message}`, err);
  }
  throw new AgentProviderUnavailable('Unknown provider error', err);
}

// ---------------------------------------------------------------------------
// Main provider class
// ---------------------------------------------------------------------------

export class AnthropicCommunityAgentProvider implements CommunityAgentProvider {
  private readonly client: Anthropic;
  readonly model: string;
  private readonly timeoutMs: number;

  constructor(apiKey?: string, model?: string, timeoutMs?: number) {
    this.model = model ?? getModel();
    this.timeoutMs = timeoutMs ?? getTimeoutMs();
    this.client = new Anthropic({
      apiKey: apiKey ?? getApiKey(),
      maxRetries: 0,
      timeout: this.timeoutMs,
    });
  }

  async suggestGroupsForUser(input: SuggestGroupsInput): Promise<readonly GroupSuggestion[]> {
    const prompt = buildSuggestGroupsPrompt(input);

    let raw: unknown;
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        temperature: 0,
        tools: [SUGGEST_GROUPS_TOOL],
        tool_choice: { type: 'tool', name: 'output_suggestions' },
        messages: [{ role: 'user', content: prompt }],
      });

      const toolUse = response.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new AgentProviderMalformed('No tool_use block in suggestGroupsForUser response');
      }
      raw = toolUse.input;
    } catch (err) {
      rethrowAnthropicError(err, this.timeoutMs);
    }

    const parsed = raw as SuggestOutput;
    if (!Array.isArray(parsed?.suggestions)) {
      throw new AgentProviderMalformed('suggestGroupsForUser: missing suggestions array');
    }

    const groupMap = new Map(input.candidateGroups.map((g) => [g.id, g]));

    return parsed.suggestions
      .filter((s): s is NonNullable<typeof s> => !!s && typeof s.groupId === 'string')
      .map((s) => {
        const group = groupMap.get(s.groupId);
        if (!group) return null;
        return {
          groupId: group.id,
          groupSlug: group.slug,
          groupName: group.name,
          sdgCodes: group.sdgCodes,
          relevanceScore: Math.min(1, Math.max(0, s.relevanceScore ?? 0)),
          reason: s.reason ?? '',
        } satisfies GroupSuggestion;
      })
      .filter((s): s is GroupSuggestion => s !== null);
  }

  async findStaleDiscussions(
    input: FindStaleDiscussionsInput,
  ): Promise<readonly StaleDiscussion[]> {
    if (input.posts.length === 0) return [];

    const prompt = buildStaleDiscussionsPrompt(input);

    let raw: unknown;
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        temperature: 0,
        tools: [STALE_DISCUSSIONS_TOOL],
        tool_choice: { type: 'tool', name: 'output_stale_discussions' },
        messages: [{ role: 'user', content: prompt }],
      });

      const toolUse = response.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new AgentProviderMalformed('No tool_use block in findStaleDiscussions response');
      }
      raw = toolUse.input;
    } catch (err) {
      rethrowAnthropicError(err, this.timeoutMs);
    }

    const parsed = raw as StaleOutput;
    if (!Array.isArray(parsed?.discussions)) {
      throw new AgentProviderMalformed('findStaleDiscussions: missing discussions array');
    }

    const postMap = new Map(input.posts.map((p) => [p.id, p]));

    return parsed.discussions
      .filter((d): d is NonNullable<typeof d> => !!d && typeof d.postId === 'string')
      .map((d) => {
        const post = postMap.get(d.postId);
        if (!post) return null;
        return {
          postId: post.id,
          postTitle: post.title,
          groupId: input.groupId,
          authorId: post.authorId,
          lastActivityAt: post.lastActivityAt,
          daysSinceActivity: post.daysSinceActivity,
          suggestionText: d.suggestionText ?? '',
        } satisfies StaleDiscussion;
      })
      .filter((d): d is StaleDiscussion => d !== null);
  }

  async draftDigest(input: DraftDigestInput): Promise<DigestContent> {
    const prompt = buildDigestPrompt(input);

    let raw: unknown;
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        temperature: 0.2,
        tools: [DRAFT_DIGEST_TOOL],
        tool_choice: { type: 'tool', name: 'output_digest' },
        messages: [{ role: 'user', content: prompt }],
      });

      const toolUse = response.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new AgentProviderMalformed('No tool_use block in draftDigest response');
      }
      raw = toolUse.input;
    } catch (err) {
      rethrowAnthropicError(err, this.timeoutMs);
    }

    const parsed = raw as DigestOutput;
    if (
      typeof parsed?.subjectLine !== 'string' ||
      typeof parsed?.summaryText !== 'string' ||
      !Array.isArray(parsed?.items)
    ) {
      throw new AgentProviderMalformed('draftDigest: missing required fields in response');
    }

    const postMap = new Map(input.posts.map((p) => [p.id, p]));

    const items = parsed.items
      .filter((item): item is NonNullable<typeof item> => !!item && typeof item.postId === 'string')
      .map((item) => {
        const post = postMap.get(item.postId);
        if (!post) return null;
        return {
          postId: post.id,
          postTitle: post.title,
          authorHandle: post.authorHandle,
          publishedAt: post.publishedAt,
          sdgCodes: post.sdgCodes,
          excerpt: item.excerpt ?? '',
        };
      })
      .filter(<T>(x: T | null): x is T => x !== null);

    return {
      groupId: input.groupId,
      groupName: input.groupName,
      period: input.period,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      subjectLine: parsed.subjectLine,
      summaryText: parsed.summaryText,
      items,
      provider: 'anthropic',
      model: this.model,
    };
  }
}
