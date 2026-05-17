/**
 * Synchronous event helper for comment status changes.
 *
 * This is a no-op stub for v0.1. The moderation pipeline (C-PIPE-1) and
 * notification fan-out (B-NOTIF-1) hook into this later by replacing or
 * wrapping the default handler.
 */

export interface StatusChangedEvent {
  commentId: string;
  from: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
  to: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
  reason?: string;
}

/** No-op handler; replaced by C-PIPE-1 / B-NOTIF-1 at integration time. */
let _handler: (event: StatusChangedEvent) => void = (_e: StatusChangedEvent) => {
  // intentional no-op stub
};

/**
 * Register a synchronous handler for `comments.statusChanged`.
 * The last registered handler wins (single-slot for now).
 */
export function onStatusChange(handler: (event: StatusChangedEvent) => void): void {
  _handler = handler;
}

/**
 * Emit a `comments.statusChanged` event synchronously.
 * Called by `updateCommentStatus` after every successful transition.
 */
export function emitStatusChange(event: StatusChangedEvent): void {
  _handler(event);
}
