import { db } from '@repo/database/client';
import { postSdgs, posts } from '@repo/database/schema';
import { isSdgId } from '@repo/sdg';
import type { SdgId } from '@repo/sdg';

export interface CreatePostInput {
  groupId: string;
  authorId: string;
  title: string;
  body: string;
  locale: string;
  sdgIds: SdgId[];
}

export interface CreatedPost {
  id: string;
  groupId: string;
  authorId: string;
  title: string;
  body: string;
  locale: string;
  status: 'pending_ai';
  statusReason: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new post.
 *
 * - Validates all SDG ids via @repo/sdg.
 * - Requires at least one SDG id.
 * - Wraps the posts insert + post_sdgs M2M in a single transaction.
 * - Always sets status to `pending_ai`.
 */
export async function createPost(input: CreatePostInput): Promise<CreatedPost> {
  const { groupId, authorId, title, body, locale, sdgIds } = input;

  if (sdgIds.length === 0) {
    throw new Error('At least one SDG id is required');
  }

  for (const id of sdgIds) {
    if (!isSdgId(id)) {
      throw new Error(`Invalid SDG id: ${String(id)}`);
    }
  }

  const result = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({
        groupId,
        authorId,
        title,
        body,
        locale,
        status: 'pending_ai',
      })
      .returning();

    if (!post) throw new Error('Post insert returned no rows');

    await tx.insert(postSdgs).values(sdgIds.map((sdgId) => ({ postId: post.id, sdgId })));

    return post;
  });

  return result as CreatedPost;
}
