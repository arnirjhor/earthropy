import { pgEnum } from 'drizzle-orm/pg-core';

export const contentStatus = pgEnum('content_status', [
  'pending_ai',
  'pending_review',
  'published',
  'rejected',
  'withdrawn',
]);

export const groupVisibility = pgEnum('group_visibility', ['public', 'listed', 'private']);

export const memberRole = pgEnum('member_role', ['owner', 'moderator', 'member']);

export const moderationVerdict = pgEnum('moderation_verdict', [
  'auto_publish',
  'hold_for_review',
  'auto_reject',
  'human_publish',
  'human_reject',
]);

export const moderationTarget = pgEnum('moderation_target', ['post', 'comment']);

export const reputationKind = pgEnum('reputation_kind', [
  'post_accepted',
  'post_rejected',
  'comment_accepted',
  'comment_rejected',
  'helpful_reaction',
  'moderator_grant',
  'appeal_resolved_for_user',
  'admin_adjust',
]);

export const tokenPurpose = pgEnum('token_purpose', [
  'email_verification',
  'magic_link',
  'password_reset',
  'group_invite',
]);

export const notificationKind = pgEnum('notification_kind', [
  'post_published',
  'post_held',
  'post_rejected',
  'comment_reply',
  'group_invite',
  'moderation_assigned',
  'appeal_resolved',
  'mention',
  'group_suggestion',
  'stale_discussion_alert',
  'digest_ready',
]);
