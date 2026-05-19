// Scaffold for notifications. Phase B fills in:
//   - notify(userId, kind, payload) → writes to notifications table + fans out
//   - In-app delivery via server-sent events (or websocket in v0.2)

// ---------------------------------------------------------------------------
// In-app fan-out (B-NOTIF-1, not yet implemented)
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'post_published'
  | 'post_held'
  | 'post_rejected'
  | 'comment_reply'
  | 'group_invite'
  | 'moderation_assigned'
  | 'appeal_resolved'
  | 'mention'
  | 'group_suggestion'
  | 'stale_discussion_alert'
  | 'digest_ready';

export interface NotifyInput {
  readonly userId: string;
  readonly kind: NotificationKind;
  readonly payload: Record<string, unknown>;
}

export { notify } from './notify.ts';
export { notificationEmitter } from './emitter.ts';
export type { NotificationEvent } from './emitter.ts';

// ---------------------------------------------------------------------------
// Transactional email (A-AUTH-2)
// ---------------------------------------------------------------------------

export { sendTransactional } from './sendTransactional.ts';
export type {
  SendTransactionalInput,
  TemplateName,
  VerifyEmailProps,
  MagicLinkProps,
  PasswordResetProps,
  GroupInviteProps,
} from './sendTransactional.ts';

// Template components (for preview tooling + testing)
export { VerifyEmail } from './emails/verify-email.tsx';
export { MagicLink } from './emails/magic-link.tsx';
export { PasswordReset } from './emails/password-reset.tsx';
export { GroupInvite } from './emails/group-invite.tsx';

// Transport interface (for custom adapters)
export type { MailTransport, MailMessage } from './transport.ts';
export { SmtpTransport, createTransport } from './transport.ts';
