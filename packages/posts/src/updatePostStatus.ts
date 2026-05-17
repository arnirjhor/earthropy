import { db } from '@repo/database/client';
import { posts } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { emitStatusChange } from './events.ts';

export type ContentStatus =
  | 'pending_ai'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'withdrawn';

export class IllegalTransitionError extends Error {
  readonly from: ContentStatus;
  readonly to: ContentStatus;
  constructor(from: ContentStatus, to: ContentStatus) {
    super(`Illegal status transition: ${from} → ${to}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Legal transitions per the state machine documented in B-POST-1.md:
 *
 * pending_ai  → published | pending_review | rejected
 * pending_review → published | rejected
 * published   → withdrawn
 * rejected    → published  (appeal upheld)
 */
const LEGAL_TRANSITIONS: Record<ContentStatus, ReadonlySet<ContentStatus>> = {
  pending_ai: new Set(['published', 'pending_review', 'rejected']),
  pending_review: new Set(['published', 'rejected']),
  published: new Set(['withdrawn']),
  rejected: new Set(['published']),
  withdrawn: new Set(),
};

export interface UpdatePostStatusInput {
  newStatus: ContentStatus;
  reason?: string;
  actorId?: string;
}

export interface UpdatedPost {
  id: string;
  status: ContentStatus;
  statusReason: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

/**
 * Transition a post to a new status.
 *
 * - Enforces the state machine; throws `IllegalTransitionError` on bad transitions.
 * - Sets `published_at` when transitioning into `published`.
 * - Records `status_reason` when provided.
 * - Emits a `posts.statusChanged` event after each successful transition.
 */
export async function updatePostStatus(
  id: string,
  input: UpdatePostStatusInput,
): Promise<UpdatedPost> {
  const { newStatus, reason, actorId: _actorId } = input;

  // Fetch current status
  const existing = await db
    .select({ id: posts.id, status: posts.status })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);

  const post = existing[0];
  if (!post) throw new Error(`Post not found: ${id}`);

  const currentStatus = post.status as ContentStatus;

  const allowed = LEGAL_TRANSITIONS[currentStatus];
  if (!allowed.has(newStatus)) {
    throw new IllegalTransitionError(currentStatus, newStatus);
  }

  const now = new Date();
  const values: Partial<{
    status: ContentStatus;
    statusReason: string | null;
    publishedAt: Date | null;
    updatedAt: Date;
  }> = {
    status: newStatus,
    statusReason: reason ?? null,
    updatedAt: now,
  };

  if (newStatus === 'published') {
    values.publishedAt = now;
  }

  const [updated] = await db.update(posts).set(values).where(eq(posts.id, id)).returning({
    id: posts.id,
    status: posts.status,
    statusReason: posts.statusReason,
    publishedAt: posts.publishedAt,
    updatedAt: posts.updatedAt,
  });

  if (!updated) throw new Error(`Post update returned no rows: ${id}`);

  emitStatusChange({ postId: id, from: currentStatus, to: newStatus, reason });

  return updated as UpdatedPost;
}
