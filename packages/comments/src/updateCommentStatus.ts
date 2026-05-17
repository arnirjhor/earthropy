import { db } from '@repo/database/client';
import { comments } from '@repo/database/schema';
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

export interface UpdateCommentStatusInput {
  newStatus: ContentStatus;
  reason?: string;
  actorId?: string;
}

export interface UpdatedComment {
  id: string;
  status: ContentStatus;
  statusReason: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

/**
 * Transition a comment to a new status.
 *
 * - Enforces the state machine; throws `IllegalTransitionError` on bad transitions.
 * - Sets `published_at` when transitioning into `published`.
 * - Records `status_reason` when provided.
 * - Emits a `comments.statusChanged` event after each successful transition.
 */
export async function updateCommentStatus(
  id: string,
  input: UpdateCommentStatusInput,
): Promise<UpdatedComment> {
  const { newStatus, reason, actorId: _actorId } = input;

  const existing = await db
    .select({ id: comments.id, status: comments.status })
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);

  const comment = existing[0];
  if (!comment) throw new Error(`Comment not found: ${id}`);

  const currentStatus = comment.status as ContentStatus;

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

  const [updated] = await db.update(comments).set(values).where(eq(comments.id, id)).returning({
    id: comments.id,
    status: comments.status,
    statusReason: comments.statusReason,
    publishedAt: comments.publishedAt,
    updatedAt: comments.updatedAt,
  });

  if (!updated) throw new Error(`Comment update returned no rows: ${id}`);

  emitStatusChange({ commentId: id, from: currentStatus, to: newStatus, reason });

  return updated as UpdatedComment;
}
