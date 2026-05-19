// MCP tool definitions for Earthropy.
// Each tool corresponds to a core Earthropy action that AI agents may invoke.
// The domain packages (groups, posts) use a module-level db singleton, so
// this layer is a thin orchestration wrapper — no business logic is duplicated.
//
// The MCP SDK's registerTool accepts a ZodRawShapeCompat for inputSchema —
// a plain Record<string, ZodType>, NOT a z.object() instance.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getGroupBySlug, listGroups } from '@repo/groups';
import { log } from '@repo/observability/log';
import type { PluginRegistry } from '@repo/plugin-sdk/registry';
import { createPost, listPostsInGroup } from '@repo/posts';
import type { SdgId } from '@repo/sdg';
import { isSdgId } from '@repo/sdg';
import { SDGS } from '@repo/sdg/data';
import { z } from 'zod';

export interface ToolDeps {
  readonly pluginRegistry: PluginRegistry;
}

/**
 * Register all Earthropy MCP tools on the provided server instance.
 */
export function registerTools(server: McpServer, deps: ToolDeps): void {
  const { pluginRegistry } = deps;

  // ------------------------------------------------------------------
  // getSDGs — list the 17 UN Sustainable Development Goals
  // ------------------------------------------------------------------
  server.registerTool(
    'getSDGs',
    {
      description:
        'Return the full list of the 17 UN Sustainable Development Goals with codes, names, and colors.',
    },
    async () => {
      const sdgs = SDGS.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        color: s.color,
        description: s.description,
      }));
      return { content: [{ type: 'text' as const, text: JSON.stringify(sdgs, null, 2) }] };
    },
  );

  // ------------------------------------------------------------------
  // listGroups — paginated list of groups
  // ------------------------------------------------------------------
  server.registerTool(
    'listGroups',
    {
      description: 'List Earthropy groups. Supports pagination and optional SDG id filter.',
      inputSchema: {
        sdgIds: z
          .array(z.number().int().min(1).max(17))
          .optional()
          .describe('Filter by SDG ids (1–17), e.g. [1, 13]'),
        visibility: z
          .enum(['public', 'listed', 'private'])
          .optional()
          .describe('Filter by group visibility'),
        limit: z.number().int().min(1).max(100).default(20).describe('Page size (default 20)'),
        offset: z.number().int().min(0).default(0).describe('Page offset (default 0)'),
      },
    },
    async ({ sdgIds, visibility, limit, offset }) => {
      try {
        const result = await listGroups({ sdgIds, visibility, limit, offset });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        log.error('mcp.listGroups.error', { err: String(err) });
        return {
          content: [{ type: 'text' as const, text: `Error listing groups: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ------------------------------------------------------------------
  // getGroup — fetch a single group by slug
  // ------------------------------------------------------------------
  server.registerTool(
    'getGroup',
    {
      description: 'Get a single Earthropy group by its URL slug.',
      inputSchema: {
        slug: z.string().describe('Group URL slug, e.g. "climate-action-global"'),
      },
    },
    async ({ slug }) => {
      try {
        const group = await getGroupBySlug(slug);
        if (group == null) {
          return {
            content: [{ type: 'text' as const, text: `Group not found: ${slug}` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(group, null, 2) }] };
      } catch (err) {
        log.error('mcp.getGroup.error', { slug, err: String(err) });
        return {
          content: [{ type: 'text' as const, text: `Error fetching group: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ------------------------------------------------------------------
  // createPost — create a new post in a group
  // ------------------------------------------------------------------
  server.registerTool(
    'createPost',
    {
      description:
        'Create a new post in an Earthropy group. Triggers the AI moderation pipeline before publishing. Requires at least one SDG id.',
      inputSchema: {
        groupId: z.string().uuid().describe('UUID of the target group'),
        authorId: z.string().uuid().describe('UUID of the author'),
        title: z.string().min(1).max(300).describe('Post title'),
        body: z.string().min(1).describe('Post body (markdown supported)'),
        locale: z.string().default('en').describe('BCP-47 locale code (default "en")'),
        sdgIds: z
          .array(z.number().int().min(1).max(17))
          .min(1)
          .describe('SDG ids this post relates to (1–17, at least one required)'),
      },
    },
    async ({ groupId, authorId, title, body, locale, sdgIds }) => {
      try {
        const validSdgIds = sdgIds.filter(isSdgId) as SdgId[];
        if (validSdgIds.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No valid SDG ids provided (must be 1–17)' }],
            isError: true,
          };
        }

        await pluginRegistry.call('beforePublish', { postId: '', authorId, groupId, title });

        const post = await createPost({
          groupId,
          authorId,
          title,
          body,
          locale,
          sdgIds: validSdgIds,
        });

        await pluginRegistry.call('afterPublish', {
          postId: post.id,
          authorId,
          groupId,
          title,
          publishedAt: post.createdAt.toISOString(),
        });

        return { content: [{ type: 'text' as const, text: JSON.stringify(post, null, 2) }] };
      } catch (err) {
        log.error('mcp.createPost.error', { groupId, authorId, err: String(err) });
        return {
          content: [{ type: 'text' as const, text: `Error creating post: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ------------------------------------------------------------------
  // getModeratedPosts — list posts by moderation status
  // ------------------------------------------------------------------
  server.registerTool(
    'getModeratedPosts',
    {
      description:
        'List posts in a group filtered by moderation status. Useful for reviewing held or rejected content.',
      inputSchema: {
        groupId: z.string().uuid().describe('UUID of the group'),
        status: z
          .enum(['pending_ai', 'pending_review', 'published', 'rejected', 'withdrawn'])
          .default('pending_review')
          .describe('Moderation status filter (default "pending_review")'),
        limit: z.number().int().min(1).max(100).default(20).describe('Page size (default 20)'),
        offset: z.number().int().min(0).default(0).describe('Page offset (default 0)'),
      },
    },
    async ({ groupId, status, limit, offset }) => {
      try {
        const posts = await listPostsInGroup({ groupId, status, limit, offset });
        return { content: [{ type: 'text' as const, text: JSON.stringify(posts, null, 2) }] };
      } catch (err) {
        log.error('mcp.getModeratedPosts.error', { groupId, status, err: String(err) });
        return {
          content: [
            { type: 'text' as const, text: `Error listing moderated posts: ${String(err)}` },
          ],
          isError: true,
        };
      }
    },
  );
}
