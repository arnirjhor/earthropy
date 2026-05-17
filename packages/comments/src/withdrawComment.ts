import { db } from '@repo/database/client';
import { comments } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { emitStatusChange } from './events.ts';
import { IllegalTransitionError } from './updateCommentStatus.ts';
import type { ContentStatus } from './updateCommentStatus.ts';

export interface WithdrawnComment {
  id: string;
  status: 'withdrawn';
  updatedAt: Date;
}

/**
 * Withdraw a comment. Only the original author may withdraw.
 *
 * - Verifies the caller is the comment's author.
 * - Delegates the `published → withdrawn` transition to the state machine rules
 *   (throws `IllegalTransitionError` if the current status is not `published`).
 */
export async function withdrawComment(
  commentId: string,
  actorId: string,
): Promise<WithdrawnComment> {
  const existing = await db
    .select({ id: comments.id, authorId: comments.authorId, status: comments.status })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  const comment = existing[0];
  if (!comment) throw new Error(`Comment not found: ${commentId}`);

  if (comment.authorId !== actorId) {
    throw new Error('Forbidden: actor is not the author of this comment');
  }

  const currentStatus = comment.status as ContentStatus;
  if (currentStatus !== 'published') {
    throw new IllegalTransitionError(currentStatus, 'withdrawn');
  }

  const now = new Date();
  const [updated] = await db
    .update(comments)
    .set({ status: 'withdrawn', updatedAt: now })
    .where(eq(comments.id, commentId))
    .returning({ id: comments.id, status: comments.status, updatedAt: comments.updatedAt });

  if (!updated) throw new Error(`Comment update returned no rows: ${commentId}`);

  emitStatusChange({ commentId, from: 'published', to: 'withdrawn' });

  return updated as WithdrawnComment;
}
