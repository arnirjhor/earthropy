import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers, groupSdgs } from '@repo/database/schema';
import { getGroupBySlug } from '@repo/groups';
import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PostCreateForm } from './_form.tsx';

export default async function NewPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  // ── Auth check ─────────────────────────────────────────────────────────────

  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) {
    redirect(`/${locale}/signin?next=/${locale}/g/${slug}/post/new`);
  }

  const user = await getSession(sessionId);
  if (!user) {
    redirect(`/${locale}/signin?next=/${locale}/g/${slug}/post/new`);
  }

  // ── Group check ────────────────────────────────────────────────────────────

  const group = await getGroupBySlug(slug);
  if (!group) notFound();

  // ── Membership check ───────────────────────────────────────────────────────

  const memberRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (!memberRows[0]) {
    // Not a member — return 403-equivalent (redirect to group page with error)
    redirect(`/${locale}/g/${slug}`);
  }

  // ── Fetch group's SDG defaults (with primary flag) ─────────────────────────

  const sdgRows = await db
    .select({ sdgId: groupSdgs.sdgId, primary: groupSdgs.primary })
    .from(groupSdgs)
    .where(eq(groupSdgs.groupId, group.id));

  const groupSdgIds = sdgRows.map((r) => r.sdgId);
  const primaryRow = sdgRows.find((r) => r.primary);
  const groupPrimarySdgId = primaryRow?.sdgId ?? groupSdgIds[0] ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[720px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
    >
      <header className="mb-[var(--spacing-8)]">
        <Link
          href={`/${locale}/g/${slug}`}
          className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
        >
          {group.name}
        </Link>
        <h1 className="mt-[var(--spacing-4)] text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] font-medium text-[var(--color-text)]">
          New post
        </h1>
        <p className="mt-[var(--spacing-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
          Write in Markdown. Your post will be reviewed by our AI moderator before publishing.
        </p>
      </header>

      <PostCreateForm
        groupId={group.id}
        groupSlug={group.slug}
        locale={locale}
        groupSdgIds={groupSdgIds}
        groupPrimarySdgId={groupPrimarySdgId}
      />
    </main>
  );
}
