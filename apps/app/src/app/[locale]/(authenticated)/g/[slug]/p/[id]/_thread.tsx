import { MarkdownBody } from '@/lib/markdown.tsx';
import { getSession } from '@repo/auth';
import { listCommentsForPost } from '@repo/comments';
import type { CommentRow } from '@repo/comments';
import { db } from '@repo/database/client';
import { groupMembers } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { ReplyForm } from './_reply.tsx';
import { WithdrawCommentButton } from './_withdraw-comment-button.tsx';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CommentNode extends CommentRow {
  children: CommentNode[];
}

// ── Tree derivation ────────────────────────────────────────────────────────────

export function buildCommentTree(flat: CommentRow[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const c of flat) {
    map.set(c.id, { ...c, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentCommentId === null) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentCommentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphan — parent was filtered out or deleted; surface at root.
        roots.push(node);
      }
    }
  }

  return roots;
}

// ── Visibility filter ──────────────────────────────────────────────────────────

export function isCommentVisible(
  comment: CommentRow,
  viewerId: string | null,
  viewerIsMod: boolean,
): boolean {
  switch (comment.status) {
    case 'published':
      return true;
    case 'pending_ai':
    case 'pending_review':
      return viewerIsMod || comment.authorId === viewerId;
    case 'rejected':
    case 'withdrawn':
      return viewerIsMod || comment.authorId === viewerId;
    default:
      return false;
  }
}

// ── Relative timestamp ─────────────────────────────────────────────────────────

export function relativeTime(date: Date, locale: string): string {
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (absSec < 60) return rtf.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  const absMin = Math.abs(diffMin);
  if (absMin < 60) return rtf.format(diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  const absHr = Math.abs(diffHr);
  if (absHr < 24) return rtf.format(diffHr, 'hour');
  const diffDay = Math.round(diffHr / 24);
  const absDay = Math.abs(diffDay);
  if (absDay < 30) return rtf.format(diffDay, 'day');
  const diffMonth = Math.round(diffDay / 30);
  const absMonth = Math.abs(diffMonth);
  if (absMonth < 12) return rtf.format(diffMonth, 'month');
  const diffYear = Math.round(diffMonth / 12);
  return rtf.format(diffYear, 'year');
}

// ── Session helpers ────────────────────────────────────────────────────────────

async function getViewer() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

async function isGroupModerator(groupId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  return rows.some((r) => r.role === 'moderator');
}

// ── CommentItem sub-component ──────────────────────────────────────────────────

interface CommentItemProps {
  node: CommentNode;
  viewerId: string | null;
  viewerIsMod: boolean;
  postId: string;
  locale: string;
  depth: number;
  t: Awaited<ReturnType<typeof getTranslations<'CommentThread'>>>;
}

function CommentItem({ node, viewerId, viewerIsMod, postId, locale, depth, t }: CommentItemProps) {
  const isAuthor = viewerId !== null && viewerId === node.authorId;
  const canWithdraw = isAuthor && node.status === 'published';
  const timestamp = relativeTime(node.createdAt, locale);

  // Status indicator for non-published comments
  const statusLabel =
    node.status !== 'published'
      ? t(`commentStatus.${node.status}` as Parameters<typeof t>[0])
      : null;

  // Indent nested comments (max 4 levels visually)
  const indentLevel = Math.min(depth, 4);
  const indentStyle =
    indentLevel > 0
      ? { paddingInlineStart: `calc(${indentLevel} * var(--spacing-8, 2rem))` }
      : undefined;

  return (
    <li
      data-testid="comment-item"
      data-comment-id={node.id}
      data-comment-status={node.status}
      className="list-none"
      style={indentStyle}
    >
      <article className="py-[var(--spacing-4)] border-b border-[var(--color-border)]">
        {/* Header */}
        <header className="flex flex-wrap items-center gap-[var(--spacing-3)] mb-[var(--spacing-2)]">
          <span className="font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)]">
            @{node.authorId}
          </span>
          <time
            dateTime={node.createdAt.toISOString()}
            className="font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)]"
          >
            {timestamp}
          </time>
          {statusLabel !== null && (
            <span
              className="inline-flex items-center px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-xs)] bg-[color-mix(in_srgb,var(--color-text)_8%,var(--color-paper))] border border-[var(--color-border)]"
              aria-label={statusLabel}
            >
              <span className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]">
                {statusLabel}
              </span>
            </span>
          )}
        </header>

        {/* Body */}
        <MarkdownBody md={node.body} className="mb-[var(--spacing-3)]" />

        {/* Actions */}
        <div className="flex flex-wrap gap-[var(--spacing-3)]">
          <ReplyForm
            postId={postId}
            parentCommentId={node.id}
            locale={locale}
            replyLabel={t('reply')}
            cancelLabel={t('cancel')}
            submitLabel={t('submitReply')}
            submittingLabel={t('submitting')}
            placeholderText={t('replyPlaceholder')}
          />
          {canWithdraw && (
            <WithdrawCommentButton
              commentId={node.id}
              withdrawLabel={t('withdrawComment')}
              withdrawingLabel={t('withdrawingComment')}
            />
          )}
        </div>
      </article>

      {/* Recursive children */}
      {node.children.length > 0 && (
        <ul className="list-none p-0 m-0">
          {node.children
            .filter((child) => isCommentVisible(child, viewerId, viewerIsMod))
            .map((child) => (
              <CommentItem
                key={child.id}
                node={child}
                viewerId={viewerId}
                viewerIsMod={viewerIsMod}
                postId={postId}
                locale={locale}
                depth={depth + 1}
                t={t}
              />
            ))}
        </ul>
      )}
    </li>
  );
}

// ── Thread server component ────────────────────────────────────────────────────

export interface CommentThreadProps {
  postId: string;
  groupId: string;
  locale: string;
}

export async function CommentThread({ postId, groupId, locale }: CommentThreadProps) {
  const t = await getTranslations('CommentThread');
  const viewer = await getViewer();
  const viewerId = viewer?.id ?? null;
  const viewerIsMod = viewerId !== null ? await isGroupModerator(groupId, viewerId) : false;

  // Fetch all statuses; we filter by visibility below.
  const statuses = ['published', 'pending_ai', 'pending_review', 'rejected', 'withdrawn'] as const;

  const allRows = (
    await Promise.all(statuses.map((status) => listCommentsForPost(postId, { status, limit: 200 })))
  ).flat();

  // Deduplicate (same id from multiple fetches is impossible here but safe)
  const seen = new Set<string>();
  const unique = allRows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  // Sort by createdAt ascending (preserve tree order)
  unique.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const visible = unique.filter((c) => isCommentVisible(c, viewerId, viewerIsMod));
  const tree = buildCommentTree(visible);

  return (
    <section
      data-testid="comment-thread"
      aria-label={t('sectionLabel')}
      className="mt-[var(--spacing-12)] pt-[var(--spacing-8)] border-t border-[var(--color-border)]"
    >
      <h2 className="text-[length:var(--text-h4)] leading-[var(--text-h4--line-height)] font-medium text-[var(--color-text)] mb-[var(--spacing-6)]">
        {t('heading')}
      </h2>

      {/* Top-level reply form */}
      <div className="mb-[var(--spacing-8)]">
        <ReplyForm
          postId={postId}
          parentCommentId={null}
          locale={locale}
          replyLabel={null}
          cancelLabel={t('cancel')}
          submitLabel={t('submitComment')}
          submittingLabel={t('submitting')}
          placeholderText={t('commentPlaceholder')}
          alwaysExpanded
        />
      </div>

      {/* Comment tree */}
      {tree.length === 0 ? (
        <p className="font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)]">
          {t('empty')}
        </p>
      ) : (
        <ul className="list-none p-0 m-0" aria-label={t('listLabel')}>
          {tree.map((node) => (
            <CommentItem
              key={node.id}
              node={node}
              viewerId={viewerId}
              viewerIsMod={viewerIsMod}
              postId={postId}
              locale={locale}
              depth={0}
              t={t}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
