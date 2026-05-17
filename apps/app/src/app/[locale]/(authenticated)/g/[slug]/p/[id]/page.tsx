import { getPostById } from '@repo/posts';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const STATUS_LABELS: Record<string, string> = {
  pending_ai: 'Under AI review',
  pending_review: 'Pending moderator review',
  published: 'Published',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; id: string }>;
}) {
  const { locale, slug, id } = await params;

  const post = await getPostById(id);
  if (!post) notFound();

  const statusLabel = STATUS_LABELS[post.status] ?? post.status;

  return (
    <main className="mx-auto max-w-[720px] px-[var(--spacing-6)] py-[var(--spacing-12)]">
      <header className="mb-[var(--spacing-8)]">
        <Link
          href={`/${locale}/g/${slug}`}
          className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
        >
          {slug}
        </Link>
        <h1 className="mt-[var(--spacing-4)] text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] font-medium text-[var(--color-text)]">
          {post.title}
        </h1>

        <div
          data-post-status={post.status}
          className="mt-[var(--spacing-3)] inline-flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[var(--radius-xs)] bg-[color-mix(in_srgb,var(--color-text)_8%,var(--color-paper))] border border-[var(--color-border)]"
        >
          <span className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]">
            {statusLabel}
          </span>
        </div>
      </header>

      <div className="prose prose-sm max-w-none text-[var(--color-text)]">
        <pre className="whitespace-pre-wrap font-sans text-[length:var(--text-body)] leading-[var(--text-body--line-height)]">
          {post.body}
        </pre>
      </div>
    </main>
  );
}
