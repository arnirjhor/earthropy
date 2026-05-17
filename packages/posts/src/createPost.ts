import { db } from '@repo/database/client';
import { groupSdgs, postSdgs, posts, users } from '@repo/database/schema';
import { enqueueModeration } from '@repo/queue';
import { isSdgId } from '@repo/sdg';
import type { SdgId } from '@repo/sdg';
import { eq } from 'drizzle-orm';

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
  status: 'pending_ai' | 'published';
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
 * - After the transaction commits, enqueues a moderation job.
 * - If MODERATION_DISABLED=1 (or REDIS_URL is unset), skips the queue and
 *   immediately transitions the post to published (dev fast-path).
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

  const moderationDisabled = process.env.MODERATION_DISABLED === '1';

  if (moderationDisabled) {
    const now = new Date();
    await db
      .update(posts)
      .set({ status: 'published', publishedAt: now, updatedAt: now })
      .where(eq(posts.id, result.id));
    return { ...result, status: 'published', publishedAt: now, updatedAt: now } as CreatedPost;
  }

  // Resolve context for the moderation job (fire-and-forget after commit).
  const [sdgRows, userRows] = await Promise.all([
    db.select({ sdgId: groupSdgs.sdgId }).from(groupSdgs).where(eq(groupSdgs.groupId, groupId)),
    db.select({ reputation: users.reputation }).from(users).where(eq(users.id, authorId)).limit(1),
  ]);

  const groupSdgCodes = sdgRows.map((r) => String(r.sdgId));
  const authorReputation = userRows[0]?.reputation ?? 0;

  enqueueModeration({
    targetType: 'post',
    targetId: result.id,
    text: `${title}\n\n${body}`,
    locale,
    context: { groupSdgCodes, authorReputation, targetType: 'post' },
  }).catch(() => {
    // Fire-and-forget: enqueue failure must not fail the create call.
  });

  return result as CreatedPost;
}
