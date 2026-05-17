import { SdgChip } from '@repo/design-system/components/SdgChip';
import type { PostRow } from '@repo/posts';
import type { SdgId } from '@repo/sdg';
import Link from 'next/link';

export interface PostCardProps {
  readonly post: PostRow;
  readonly postSdgIds: SdgId[];
  readonly locale: string;
  readonly groupSlug: string;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PostCard({ post, postSdgIds, locale, groupSlug }: PostCardProps) {
  const href = `/${locale}/g/${groupSlug}/p/${post.id}`;
  const timestamp = post.publishedAt ?? post.createdAt;

  return (
    <article
      className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden transition-transform hover:border-[var(--color-text)] hover:-translate-y-px motion-reduce:hover:translate-y-0"
      style={{
        borderRadius: 'var(--radius-sm)',
        transitionDuration: 'var(--duration-base)',
        transitionTimingFunction: 'var(--ease-out)',
      }}
    >
      <Link
        href={href}
        className="block p-[var(--spacing-5)] no-underline text-[var(--color-text)]"
        aria-label={post.title}
      >
        <h3 className="m-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] font-medium text-[var(--color-text)] line-clamp-2">
          {post.title}
        </h3>

        {postSdgIds.length > 0 && (
          <ul
            aria-label="SDGs addressed by this post"
            className="mt-[var(--spacing-3)] flex flex-wrap gap-[var(--spacing-2)] list-none p-0 m-0"
          >
            {postSdgIds.map((sdgId) => (
              <li key={sdgId} className="contents">
                <SdgChip sdg={sdgId} size="sm" />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-[var(--spacing-3)] flex items-center gap-[var(--spacing-3)]">
          <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
            @{post.authorId}
          </span>
          <span aria-hidden="true" className="text-[var(--color-text-muted)]">
            ·
          </span>
          <time
            dateTime={timestamp.toISOString()}
            className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {relativeTime(timestamp)}
          </time>
        </div>
      </Link>
    </article>
  );
}
