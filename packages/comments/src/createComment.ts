import { db } from '@repo/database/client';
import { comments } from '@repo/database/schema';
import { eq } from 'drizzle-orm';

export interface CreateCommentInput {
  postId: string;
  authorId: string;
  parentCommentId?: string;
  body: string;
  locale: string;
}

export interface CreatedComment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  locale: string;
  status: 'pending_ai';
  statusReason: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new comment.
 *
 * - Always sets status to `pending_ai`.
 * - If `parentCommentId` is given, verifies the parent belongs to the same post;
 *   throws if not (prevents cross-post threading).
 */
export async function createComment(input: CreateCommentInput): Promise<CreatedComment> {
  const { postId, authorId, parentCommentId, body, locale } = input;

  if (parentCommentId) {
    const parentRows = await db
      .select({ id: comments.id, postId: comments.postId })
      .from(comments)
      .where(eq(comments.id, parentCommentId))
      .limit(1);

    const parent = parentRows[0];
    if (!parent) throw new Error(`Parent comment not found: ${parentCommentId}`);
    if (parent.postId !== postId) {
      throw new Error(
        `Parent comment belongs to a different post (parent post: ${parent.postId}, given post: ${postId})`,
      );
    }
  }

  const [comment] = await db
    .insert(comments)
    .values({
      postId,
      authorId,
      parentCommentId: parentCommentId ?? null,
      body,
      locale,
      status: 'pending_ai',
    })
    .returning();

  if (!comment) throw new Error('Comment insert returned no rows');

  return comment as CreatedComment;
}
