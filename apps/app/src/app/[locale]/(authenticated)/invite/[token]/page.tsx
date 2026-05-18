import { getSession } from '@repo/auth';
import { hashToken } from '@repo/auth';
import { db } from '@repo/database/client';
import { tokens } from '@repo/database/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { claimInviteAction } from './_actions.ts';

/**
 * GET-interstitial: shows invite details and a "Join group" confirm button.
 * The button submits a form (POST) that calls claimInviteAction.
 * Pre-fetchers that GET this page do NOT consume the token.
 */
export default async function InviteClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, token } = await params;
  const { error } = await searchParams;

  // Auth check — authenticated layout handles redirect but we double-check
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) {
    redirect(`/${locale}/signin?next=/${locale}/invite/${token}`);
  }

  const user = await getSession(sessionId);
  if (!user) {
    redirect(`/${locale}/signin?next=/${locale}/invite/${token}`);
  }

  // Peek at the token (without consuming) to show invite details
  const hashed = hashToken(token);
  const now = new Date();

  const tokenRows = await db
    .select({
      userId: tokens.userId,
      payload: tokens.payload,
      expiresAt: tokens.expiresAt,
    })
    .from(tokens)
    .where(
      and(
        eq(tokens.id, hashed),
        eq(tokens.purpose, 'group_invite'),
        gt(tokens.expiresAt, now),
        isNull(tokens.consumedAt),
      ),
    )
    .limit(1);

  const tokenRow = tokenRows[0];
  const isInvalid = !tokenRow || error === 'invalid';

  // Parse payload
  let groupName = 'this group';
  let inviteRole = 'member';

  if (tokenRow?.payload) {
    const payload = tokenRow.payload;
    const colonIdx = payload.lastIndexOf(':');
    if (colonIdx >= 0) {
      const groupId = payload.slice(0, colonIdx);
      inviteRole = payload.slice(colonIdx + 1);

      // Look up group name
      const { groups } = await import('@repo/database/schema');
      const groupRows = await db
        .select({ name: groups.name })
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1);
      if (groupRows[0]) groupName = groupRows[0].name;
    }
  }

  // Look up inviter display name
  let inviterName = 'A group member';
  if (tokenRow) {
    // The token userId is the invitee — we don't have inviter info stored in this pattern
    // Show a generic message
    inviterName = 'Someone';
  }

  const isForCurrentUser = tokenRow?.userId === user.id;

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[480px] px-[var(--spacing-6)] py-[var(--spacing-12)]"
    >
      <header className="mb-[var(--spacing-8)]">
        <Link
          href={`/${locale}/dashboard`}
          className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
          style={{ transitionDuration: 'var(--duration-base)' }}
        >
          Earthropy
        </Link>

        <h1 className="mt-[var(--spacing-4)] text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] font-medium text-[var(--color-text)]">
          {isInvalid ? 'Invite not found' : 'Group invitation'}
        </h1>
      </header>

      {isInvalid ? (
        <div
          role="alert"
          className="mb-[var(--spacing-4)] px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[color-mix(in_srgb,var(--color-text)_5%,var(--color-paper))] border border-[var(--color-border)] text-[length:var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          This invitation link is invalid, expired, or has already been used.
        </div>
      ) : !isForCurrentUser ? (
        <div
          role="alert"
          className="mb-[var(--spacing-4)] px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[color-mix(in_srgb,var(--color-text)_5%,var(--color-paper))] border border-[var(--color-border)] text-[length:var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          This invitation was sent to a different account. Please sign in with the correct account.
        </div>
      ) : (
        <>
          <p className="mb-[var(--spacing-6)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]">
            {inviterName} has invited you to join{' '}
            <strong className="text-[var(--color-text)]">{groupName}</strong> as a{' '}
            <strong className="text-[var(--color-text)]">{inviteRole}</strong>.
          </p>

          <form
            action={async () => {
              'use server';
              await claimInviteAction(locale, token);
            }}
          >
            <button
              type="submit"
              className="w-full inline-flex justify-center items-center px-[var(--spacing-5)] py-[var(--spacing-3)] bg-[var(--color-text)] text-[var(--color-paper)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
              style={{
                borderRadius: 'var(--radius-xs)',
                transitionDuration: 'var(--duration-base)',
              }}
            >
              Join {groupName}
            </button>
          </form>

          <p className="mt-[var(--spacing-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            This invitation expires on{' '}
            {tokenRow?.expiresAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            .
          </p>
        </>
      )}
    </main>
  );
}
