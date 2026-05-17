import { db } from '@repo/database/client';
import { comments } from '@repo/database/schema';
import { eq } from 'drizzle-orm';

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
 * Fetch a single comment by its UUID.
 * Returns null when no comment with that id exists.
 */
export async function getCommentById(id: string): Promise<CommentRow | null> {
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
    .where(eq(comments.id, id))
    .limit(1);

  const row = rows[0];
  return row ? (row as CommentRow) : null;
}
