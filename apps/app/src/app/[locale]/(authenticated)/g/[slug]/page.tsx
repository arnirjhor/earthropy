import { getGroupBySlug } from '@repo/groups';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function GroupPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const group = await getGroupBySlug(slug);

  if (!group) notFound();

  return (
    <main className="mx-auto max-w-[1200px] px-[var(--spacing-6)] py-[var(--spacing-12)]">
      <header className="mb-[var(--spacing-8)]">
        <Link
          href={`/${locale}/dashboard`}
          className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
        >
          Earthropy
        </Link>
        <h1
          data-group-name
          className="mt-[var(--spacing-4)] text-[length:var(--text-h1)] leading-[var(--text-h1--line-height)] font-medium text-[var(--color-text)]"
        >
          {group.name}
        </h1>
        {group.description && (
          <p className="mt-[var(--spacing-3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)] max-w-[640px]">
            {group.description}
          </p>
        )}
      </header>

      <div className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
        /g/{group.slug}
      </div>
    </main>
  );
}
