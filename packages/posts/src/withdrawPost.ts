import { db } from '@repo/database/client';
import { posts } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { emitStatusChange } from './events.ts';
import { IllegalTransitionError } from './updatePostStatus.ts';
import type { ContentStatus } from './updatePostStatus.ts';

export interface WithdrawnPost {
  id: string;
  status: 'withdrawn';
  updatedAt: Date;
}

/**
 * Withdraw a post. Only the original author may withdraw.
 *
 * - Verifies the caller is the post's author.
 * - Delegates the `published → withdrawn` transition to the state machine rules
 *   (throws `IllegalTransitionError` if the current status is not `published`).
 */
export async function withdrawPost(postId: string, actorId: string): Promise<WithdrawnPost> {
  const existing = await db
    .select({ id: posts.id, authorId: posts.authorId, status: posts.status })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  const post = existing[0];
  if (!post) throw new Error(`Post not found: ${postId}`);

  if (post.authorId !== actorId) {
    throw new Error('Forbidden: actor is not the author of this post');
  }

  const currentStatus = post.status as ContentStatus;
  if (currentStatus !== 'published') {
    throw new IllegalTransitionError(currentStatus, 'withdrawn');
  }

  const now = new Date();
  const [updated] = await db
    .update(posts)
    .set({ status: 'withdrawn', updatedAt: now })
    .where(eq(posts.id, postId))
    .returning({ id: posts.id, status: posts.status, updatedAt: posts.updatedAt });

  if (!updated) throw new Error(`Post update returned no rows: ${postId}`);

  emitStatusChange({ postId, from: 'published', to: 'withdrawn' });

  return updated as WithdrawnPost;
}
