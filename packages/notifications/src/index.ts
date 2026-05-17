// Scaffold for notifications. Phase B fills in:
//   - notify(userId, kind, payload) → writes to notifications table + fans out
//   - SMTP transport via Nodemailer (Resend optional adapter)
//   - In-app delivery via server-sent events (or websocket in v0.2)

export type NotificationKind =
  | 'post_published'
  | 'post_held'
  | 'post_rejected'
  | 'comment_reply'
  | 'group_invite'
  | 'moderation_assigned'
  | 'appeal_resolved'
  | 'mention';

export interface NotifyInput {
  readonly userId: string;
  readonly kind: NotificationKind;
  readonly payload: Record<string, unknown>;
}

// biome-ignore lint/correctness/noUnusedVariables: stub
export async function notify(_input: NotifyInput): Promise<void> {
  throw new Error('@repo/notifications not yet implemented (Phase B).');
}
