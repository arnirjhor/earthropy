import { db } from '@repo/database/client';
import { comments, groupSdgs, posts, users } from '@repo/database/schema';
import { enqueueModeration } from '@repo/queue';
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
  status: 'pending_ai' | 'published';
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
 * - After the insert commits, enqueues a moderation job.
 * - If MODERATION_DISABLED=1 (or REDIS_URL is unset), skips the queue and
 *   immediately transitions the comment to published (dev fast-path).
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

  const moderationDisabled = process.env.MODERATION_DISABLED === '1';

  if (moderationDisabled) {
    const now = new Date();
    await db
      .update(comments)
      .set({ status: 'published', publishedAt: now, updatedAt: now })
      .where(eq(comments.id, comment.id));
    return { ...comment, status: 'published', publishedAt: now, updatedAt: now } as CreatedComment;
  }

  // Resolve context for the moderation job (fire-and-forget after insert).
  const [postRows, userRows] = await Promise.all([
    db.select({ groupId: posts.groupId }).from(posts).where(eq(posts.id, postId)).limit(1),
    db.select({ reputation: users.reputation }).from(users).where(eq(users.id, authorId)).limit(1),
  ]);

  const groupId = postRows[0]?.groupId;
  const authorReputation = userRows[0]?.reputation ?? 0;

  const sdgRows = groupId
    ? await db
        .select({ sdgId: groupSdgs.sdgId })
        .from(groupSdgs)
        .where(eq(groupSdgs.groupId, groupId))
    : [];

  const groupSdgCodes = sdgRows.map((r) => String(r.sdgId));

  enqueueModeration({
    targetType: 'comment',
    targetId: comment.id,
    text: body,
    locale,
    context: { groupSdgCodes, authorReputation, targetType: 'comment' },
  }).catch(() => {
    // Fire-and-forget: enqueue failure must not fail the create call.
  });

  return comment as CreatedComment;
}
