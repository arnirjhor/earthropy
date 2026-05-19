/**
 * OllamaCommunityAgentProvider — self-hostable fallback.
 *
 * Uses Ollama /api/chat with format: 'json' for structured outputs.
 * No SDK; raw fetch to the Ollama HTTP API (pattern from packages/moderation).
 */

import { getOllamaAgentModel, getOllamaAgentTimeoutMs, getOllamaBaseUrl } from './env.ts';
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
// Ollama HTTP helpers
// ---------------------------------------------------------------------------

interface OllamaChatResponse {
  model: string;
  message: { content: string };
  done: boolean;
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
        options: { temperature: 0, num_predict: 2048 },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new AgentProviderUnavailable(`Ollama /api/chat returned HTTP ${res.status}`);
    }
    return (await res.json()) as OllamaChatResponse;
  } catch (err) {
    if (err instanceof AgentProviderUnavailable) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AgentProviderTimeout(`Ollama request timed out after ${timeoutMs}ms`, err);
    }
    if (err instanceof Error) {
      throw new AgentProviderUnavailable(`Ollama request failed: ${err.message}`, err);
    }
    throw new AgentProviderUnavailable('Ollama request failed with unknown error', err);
  } finally {
    clearTimeout(timer);
  }
}

function parseJson<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const SUGGEST_GROUPS_SYSTEM = `You are a community-manager assistant for a sustainable development platform. Given a user's SDG interests and a list of candidate groups, return a JSON object with a "suggestions" array. Each item must have: groupId (string), relevanceScore (number 0-1), reason (string). Order by relevance descending. Output only JSON, no prose.`;

const STALE_DISCUSSIONS_SYSTEM = `You are a community-manager assistant. Given stale discussions in a group, return a JSON object with a "discussions" array. Each item must have: postId (string), suggestionText (string, 1-2 sentences re-engagement prompt). Output only JSON, no prose.`;

const DRAFT_DIGEST_SYSTEM =
  'You are a community-manager assistant. Write a weekly digest for a group. Return a JSON object with: subjectLine (string, max 60 chars), summaryText (string, 2-3 sentences), items (array of {postId, excerpt}). Output only JSON, no prose.';

// ---------------------------------------------------------------------------
// Main provider class
// ---------------------------------------------------------------------------

export class OllamaCommunityAgentProvider implements CommunityAgentProvider {
  private readonly baseUrl: string;
  readonly model: string;
  private readonly timeoutMs: number;

  constructor(baseUrl?: string, model?: string, timeoutMs?: number) {
    this.baseUrl = baseUrl ?? getOllamaBaseUrl();
    this.model = model ?? getOllamaAgentModel();
    this.timeoutMs = timeoutMs ?? getOllamaAgentTimeoutMs();
  }

  async suggestGroupsForUser(input: SuggestGroupsInput): Promise<readonly GroupSuggestion[]> {
    const userText = JSON.stringify({
      userId: input.userId,
      userSdgCodes: input.userSdgCodes,
      maxSuggestions: input.maxSuggestions ?? 5,
      candidateGroups: input.candidateGroups.map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        sdgCodes: g.sdgCodes,
        description: g.description.slice(0, 200),
      })),
    });

    const resp = await callOllamaChat(
      this.baseUrl,
      this.model,
      SUGGEST_GROUPS_SYSTEM,
      userText,
      this.timeoutMs,
    );

    const parsed = parseJson<{ suggestions?: unknown[] }>(resp.message?.content ?? '{}');
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      throw new AgentProviderMalformed(
        'OllamaCommunityAgentProvider.suggestGroupsForUser: malformed JSON response',
      );
    }

    const groupMap = new Map(input.candidateGroups.map((g) => [g.id, g]));

    return (parsed.suggestions as Array<Record<string, unknown>>)
      .filter(
        (s): s is { groupId: string; relevanceScore: number; reason: string } =>
          !!s && typeof s.groupId === 'string',
      )
      .map((s) => {
        const group = groupMap.get(s.groupId);
        if (!group) return null;
        return {
          groupId: group.id,
          groupSlug: group.slug,
          groupName: group.name,
          sdgCodes: group.sdgCodes,
          relevanceScore: Math.min(
            1,
            Math.max(0, typeof s.relevanceScore === 'number' ? s.relevanceScore : 0),
          ),
          reason: typeof s.reason === 'string' ? s.reason : '',
        } satisfies GroupSuggestion;
      })
      .filter((s): s is GroupSuggestion => s !== null);
  }

  async findStaleDiscussions(
    input: FindStaleDiscussionsInput,
  ): Promise<readonly StaleDiscussion[]> {
    if (input.posts.length === 0) return [];

    const userText = JSON.stringify({
      groupId: input.groupId,
      staleDays: input.staleDays,
      posts: input.posts.map((p) => ({
        id: p.id,
        title: p.title,
        authorId: p.authorId,
        daysInactive: p.daysSinceActivity,
        sdgCodes: p.sdgCodes,
      })),
    });

    const resp = await callOllamaChat(
      this.baseUrl,
      this.model,
      STALE_DISCUSSIONS_SYSTEM,
      userText,
      this.timeoutMs,
    );

    const parsed = parseJson<{ discussions?: unknown[] }>(resp.message?.content ?? '{}');
    if (!parsed || !Array.isArray(parsed.discussions)) {
      throw new AgentProviderMalformed(
        'OllamaCommunityAgentProvider.findStaleDiscussions: malformed JSON response',
      );
    }

    const postMap = new Map(input.posts.map((p) => [p.id, p]));

    return (parsed.discussions as Array<Record<string, unknown>>)
      .filter(
        (d): d is { postId: string; suggestionText: string } => !!d && typeof d.postId === 'string',
      )
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
          suggestionText: typeof d.suggestionText === 'string' ? d.suggestionText : '',
        } satisfies StaleDiscussion;
      })
      .filter((d): d is StaleDiscussion => d !== null);
  }

  async draftDigest(input: DraftDigestInput): Promise<DigestContent> {
    const userText = JSON.stringify({
      groupId: input.groupId,
      groupName: input.groupName,
      period: input.period,
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
      posts: input.posts.map((p) => ({
        id: p.id,
        title: p.title,
        authorHandle: p.authorHandle,
        publishedAt: p.publishedAt.toISOString(),
        sdgCodes: p.sdgCodes,
        body: p.body.slice(0, 300),
      })),
    });

    const resp = await callOllamaChat(
      this.baseUrl,
      this.model,
      DRAFT_DIGEST_SYSTEM,
      userText,
      this.timeoutMs,
    );

    const parsed = parseJson<{
      subjectLine?: string;
      summaryText?: string;
      items?: unknown[];
    }>(resp.message?.content ?? '{}');

    if (
      !parsed ||
      typeof parsed.subjectLine !== 'string' ||
      typeof parsed.summaryText !== 'string' ||
      !Array.isArray(parsed.items)
    ) {
      throw new AgentProviderMalformed(
        'OllamaCommunityAgentProvider.draftDigest: malformed JSON response',
      );
    }

    const postMap = new Map(input.posts.map((p) => [p.id, p]));

    const items = (parsed.items as Array<Record<string, unknown>>)
      .filter(
        (item): item is { postId: string; excerpt: string } =>
          !!item && typeof item.postId === 'string',
      )
      .map((item) => {
        const post = postMap.get(item.postId);
        if (!post) return null;
        return {
          postId: post.id,
          postTitle: post.title,
          authorHandle: post.authorHandle,
          publishedAt: post.publishedAt,
          sdgCodes: post.sdgCodes,
          excerpt: typeof item.excerpt === 'string' ? item.excerpt : '',
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
      provider: 'ollama',
      model: this.model,
    };
  }
}
