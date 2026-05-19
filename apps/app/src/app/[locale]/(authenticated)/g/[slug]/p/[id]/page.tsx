import { AppealForm } from '@/app/[locale]/(authenticated)/_appeal-form.tsx';
import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers } from '@repo/database/schema';
import { SdgChip } from '@repo/design-system/components/SdgChip';
import { getPostById } from '@repo/posts';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CommentThread } from './_thread.tsx';
import { TranslateToggle } from './_translate-toggle.tsx';
import { WithdrawButton } from './_withdraw-button.tsx';

// ── Session helper ─────────────────────────────────────────────────────────────

async function getViewer() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── Moderator check ────────────────────────────────────────────────────────────

async function isGroupModerator(groupId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  return rows.some((r) => r.role === 'moderator');
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; id: string }>;
}) {
  const { locale, slug, id } = await params;
  const t = await getTranslations('PostDetail');

  const [post, viewer] = await Promise.all([getPostById(id), getViewer()]);
  if (!post) notFound();

  const isAuthor = viewer !== null && viewer.id === post.authorId;
  const isMod =
    viewer !== null && !isAuthor ? await isGroupModerator(post.groupId, viewer.id) : false;

  // ── Visibility enforcement ─────────────────────────────────────────────────
  switch (post.status) {
    case 'pending_ai':
    case 'pending_review':
      if (!isAuthor && !isMod) notFound();
      break;
    case 'rejected':
      if (!isAuthor) notFound();
      break;
    case 'withdrawn':
      if (!isAuthor && !isMod) notFound();
      break;
    default:
      // published — always visible
      break;
  }

  // ── Banner ─────────────────────────────────────────────────────────────────
  let bannerText: string | null = null;
  if (post.status !== 'published') {
    switch (post.status) {
      case 'pending_ai':
        bannerText = t('banner.pendingAi');
        break;
      case 'pending_review':
        bannerText = t('banner.pendingReview');
        break;
      case 'rejected':
        bannerText = post.statusReason
          ? t('banner.rejected', { reason: post.statusReason })
          : t('banner.rejectedNoReason');
        break;
      case 'withdrawn':
        bannerText = t('banner.withdrawn');
        break;
    }
  }

  const showWithdraw = isAuthor && post.status === 'published';
  const showAppeal = isAuthor && post.status === 'rejected';

  // ── Status pill label ──────────────────────────────────────────────────────
  const statusKey =
    post.status === 'pending_ai'
      ? 'pending_ai'
      : post.status === 'pending_review'
        ? 'pending_review'
        : post.status === 'published'
          ? 'published'
          : post.status === 'rejected'
            ? 'rejected'
            : 'withdrawn';

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[720px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
      lang={post.locale}
    >
      {/* ── Moderation banner ──────────────────────────────────────────────── */}
      {bannerText !== null && (
        <output
          data-post-status-banner={post.status}
          className="mb-[var(--spacing-6)] block px-[var(--spacing-4)] py-[var(--spacing-3)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text)_6%,var(--color-paper))] text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text)]"
        >
          {bannerText}
        </output>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="mb-[var(--spacing-8)]">
        {/* Breadcrumb: group slug */}
        <Link
          href={`/${locale}/g/${slug}`}
          className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
        >
          {slug}
        </Link>

        {/* Title */}
        <h1 className="mt-[var(--spacing-4)] text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] font-medium text-[var(--color-text)]">
          {post.title}
        </h1>

        {/* Meta row: author handle + status pill */}
        <div className="mt-[var(--spacing-3)] flex flex-wrap items-center gap-[var(--spacing-3)]">
          {/* Author handle */}
          {viewer !== null && (
            <Link
              href={`/${locale}/u/${isAuthor ? viewer.handle : post.authorId}`}
              className="font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors no-underline"
            >
              @{isAuthor ? viewer.handle : post.authorId}
            </Link>
          )}

          {/* Status pill */}
          <span
            data-post-status={post.status}
            className="inline-flex items-center px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[var(--radius-xs)] bg-[color-mix(in_srgb,var(--color-text)_8%,var(--color-paper))] border border-[var(--color-border)]"
          >
            <span className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]">
              {t(`statusLabel.${statusKey}`)}
            </span>
          </span>
        </div>

        {/* SDG chips row */}
        {post.sdgIds.length > 0 && (
          <ul
            aria-label="SDGs addressed by this post"
            className="mt-[var(--spacing-4)] flex flex-wrap gap-[var(--spacing-2)] list-none p-0 m-0"
          >
            {post.sdgIds.map((sdgId) => (
              <li key={sdgId} className="contents">
                <SdgChip sdg={sdgId as Parameters<typeof SdgChip>[0]['sdg']} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <TranslateToggle
        originalBody={post.body}
        sourceLocale={post.locale}
        targetLocale={locale}
        postId={post.id}
        commentId={null}
        className="mb-[var(--spacing-8)]"
        labels={{
          translate: t('translate'),
          showOriginal: t('showOriginal'),
          translating: t('translating'),
          translatedFrom: t('translatedFrom'),
          error: t('translateError'),
        }}
      />

      {/* ── Comment thread ────────────────────────────────────────────────── */}
      <CommentThread postId={post.id} groupId={post.groupId} locale={locale} />

      {/* ── Withdraw action ────────────────────────────────────────────────── */}
      {showWithdraw && (
        <footer className="mt-[var(--spacing-8)] pt-[var(--spacing-6)] border-t border-[var(--color-border)]">
          <WithdrawButton
            postId={post.id}
            locale={locale}
            slug={slug}
            withdrawLabel={t('withdraw')}
            withdrawingLabel={t('withdrawing')}
          />
        </footer>
      )}

      {/* ── Appeal action ──────────────────────────────────────────────────── */}
      {showAppeal && (
        <footer className="mt-[var(--spacing-8)] pt-[var(--spacing-6)] border-t border-[var(--color-border)]">
          <AppealForm
            targetType="post"
            targetId={post.id}
            submitLabel={t('appeal')}
            submittingLabel={t('appealing')}
            placeholderText={t('appealPlaceholder')}
            cancelLabel={t('cancel')}
          />
        </footer>
      )}
    </main>
  );
}
