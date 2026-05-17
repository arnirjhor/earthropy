import { db } from '@repo/database/client';
import { comments } from '@repo/database/schema';
import { and, asc, eq } from 'drizzle-orm';

export interface ListCommentsForPostInput {
  status?: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
  limit?: number;
  offset?: number;
}

export interface CommentRow {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  locale: string;
  status: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
  statusReason: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * List comments for a post as a flat list ordered by createdAt ascending.
 *
 * Defaults to `published` when no status filter is given.
 * Tree derivation (parent-first nesting) is left to callers.
 */
export async function listCommentsForPost(
  postId: string,
  input: ListCommentsForPostInput,
): Promise<CommentRow[]> {
  const { status = 'published', limit = 100, offset = 0 } = input;

  const rows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      parentCommentId: comments.parentCommentId,
      body: comments.body,
      locale: comments.locale,
      status: comments.status,
      statusReason: comments.statusReason,
      publishedAt: comments.publishedAt,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .where(and(eq(comments.postId, postId), eq(comments.status, status)))
    .orderBy(asc(comments.createdAt))
    .limit(limit)
    .offset(offset);

  return rows as CommentRow[];
}
