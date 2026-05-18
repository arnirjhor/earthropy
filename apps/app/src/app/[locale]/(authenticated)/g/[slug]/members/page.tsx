import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers, tokens, users } from '@repo/database/schema';
import { getGroupBySlug } from '@repo/groups';
import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  inviteMemberAction,
  removeMemberAction,
  setRoleAction,
  transferOwnershipAction,
} from './_actions.ts';

// ── Types ──────────────────────────────────────────────────────────────────────

type MemberRole = 'owner' | 'moderator' | 'member';

interface MemberRow {
  userId: string;
  handle: string;
  displayName: string;
  email: string;
  role: MemberRole;
  joinedAt: Date;
}

interface PendingInvite {
  tokenId: string;
  email: string;
  role: string;
  expiresAt: Date;
}

// ── Data fetchers ──────────────────────────────────────────────────────────────

async function getMembers(groupId: string): Promise<MemberRow[]> {
  const rows = await db
    .select({
      userId: groupMembers.userId,
      handle: users.handle,
      displayName: users.displayName,
      email: users.email,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.joinedAt);

  return rows as MemberRow[];
}

async function getPendingInvites(groupId: string): Promise<PendingInvite[]> {
  const now = new Date();
  // Pending invites: tokens with purpose='group_invite', payload starts with groupId, not expired
  const rows = await db
    .select({
      id: tokens.id,
      email: users.email,
      payload: tokens.payload,
      expiresAt: tokens.expiresAt,
    })
    .from(tokens)
    .innerJoin(users, eq(tokens.userId, users.id))
    .where(and(eq(tokens.purpose, 'group_invite')));

  return rows
    .filter((r) => {
      const payload = r.payload ?? '';
      return payload.startsWith(`${groupId}:`) && r.expiresAt > now;
    })
    .map((r) => {
      const colonIdx = (r.payload ?? '').lastIndexOf(':');
      return {
        tokenId: r.id,
        email: r.email,
        role: colonIdx >= 0 ? (r.payload ?? '').slice(colonIdx + 1) : 'member',
        expiresAt: r.expiresAt,
      };
    });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function GroupMembersPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  // Auth check
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) redirect(`/${locale}/signin?next=/${locale}/g/${slug}/members`);

  const user = await getSession(sessionId);
  if (!user) redirect(`/${locale}/signin?next=/${locale}/g/${slug}/members`);

  // Group check
  const group = await getGroupBySlug(slug);
  if (!group) notFound();

  // Role check: owner or moderator only
  const actorRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)))
    .limit(1);

  const actorRole = actorRows[0]?.role as MemberRole | undefined;
  if (!actorRole || actorRole === 'member') {
    redirect(`/${locale}/g/${slug}`);
  }

  const isOwner = actorRole === 'owner';

  // Fetch data
  const [memberList, pendingInvites] = await Promise.all([
    getMembers(group.id),
    getPendingInvites(group.id),
  ]);

  return (
    <main className="mx-auto max-w-[900px] px-[var(--spacing-6)] py-[var(--spacing-12)]">
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <header className="mb-[var(--spacing-8)]">
        <nav aria-label="Breadcrumb">
          <Link
            href={`/${locale}/g/${slug}`}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] no-underline hover:text-[var(--color-text)] transition-colors"
            style={{ transitionDuration: 'var(--duration-base)' }}
          >
            {group.name}
          </Link>
        </nav>
        <h1 className="mt-[var(--spacing-4)] text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] font-medium text-[var(--color-text)]">
          Members
        </h1>
        <p className="mt-[var(--spacing-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
          {memberList.length} {memberList.length === 1 ? 'member' : 'members'}
          {pendingInvites.length > 0
            ? ` · ${pendingInvites.length} pending ${pendingInvites.length === 1 ? 'invite' : 'invites'}`
            : ''}
        </p>
      </header>

      {/* ── Invite form ────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="invite-heading"
        className="mb-[var(--spacing-10)] bg-[var(--color-surface)] border border-[var(--color-border)] p-[var(--spacing-6)]"
        style={{ borderRadius: 'var(--radius-sm)' }}
      >
        <h2
          id="invite-heading"
          className="m-0 mb-[var(--spacing-4)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] font-medium text-[var(--color-text)]"
        >
          Invite by email
        </h2>

        <form
          action={inviteMemberAction as unknown as (formData: FormData) => Promise<void>}
          className="flex flex-wrap gap-[var(--spacing-3)] items-end"
        >
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="locale" value={locale} />

          <div className="flex-1 min-w-[220px]">
            <label
              htmlFor="invite-email"
              className="block mb-[var(--spacing-1)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
            >
              Email address
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="user@example.com"
              className="w-full px-[var(--spacing-3)] py-[var(--spacing-2)] bg-[var(--color-paper)] border border-[var(--color-border)] text-[length:var(--text-body-sm)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-text)]"
              style={{
                borderRadius: 'var(--radius-xs)',
                transitionDuration: 'var(--duration-base)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="invite-role"
              className="block mb-[var(--spacing-1)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
            >
              Role
            </label>
            <select
              id="invite-role"
              name="role"
              className="px-[var(--spacing-3)] py-[var(--spacing-2)] bg-[var(--color-paper)] border border-[var(--color-border)] text-[length:var(--text-body-sm)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-text)]"
              style={{ borderRadius: 'var(--radius-xs)' }}
            >
              <option value="member">Member</option>
              {isOwner && <option value="moderator">Moderator</option>}
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex items-center px-[var(--spacing-5)] py-[var(--spacing-2)] bg-[var(--color-text)] text-[var(--color-paper)] font-mono text-[length:var(--text-mono)] uppercase tracking-wider border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
            style={{ borderRadius: 'var(--radius-xs)', transitionDuration: 'var(--duration-base)' }}
          >
            Send invite
          </button>
        </form>
      </section>

      {/* ── Pending invites ────────────────────────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <section aria-labelledby="pending-heading" className="mb-[var(--spacing-10)]">
          <h2
            id="pending-heading"
            className="m-0 mb-[var(--spacing-4)] text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]"
          >
            Pending invites
          </h2>

          <ul className="list-none p-0 m-0 space-y-[var(--spacing-2)]">
            {pendingInvites.map((invite) => (
              <li
                key={invite.tokenId}
                className="flex items-center justify-between gap-[var(--spacing-4)] bg-[var(--color-surface)] border border-[var(--color-border)] px-[var(--spacing-5)] py-[var(--spacing-3)]"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <div>
                  <span className="text-[length:var(--text-body-sm)] text-[var(--color-text)]">
                    {invite.email}
                  </span>
                  <span className="ms-[var(--spacing-3)] font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                    {invite.role}
                  </span>
                </div>
                <form
                  action={async () => {
                    'use server';
                    // revokeInviteAction needs rawToken — not available here (only hash stored)
                    // This is a limitation: we'd need to expose the hash-based revoke
                  }}
                >
                  <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Expires {invite.expiresAt.toLocaleDateString()}
                  </span>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Members list ───────────────────────────────────────────────────── */}
      <section aria-labelledby="members-heading">
        <h2
          id="members-heading"
          className="m-0 mb-[var(--spacing-4)] text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] font-medium text-[var(--color-text)]"
        >
          Current members
        </h2>

        {memberList.length === 0 ? (
          <p className="text-[length:var(--text-body)] text-[var(--color-text-muted)]">
            No members yet.
          </p>
        ) : (
          <ul
            className="list-none p-0 m-0 divide-y divide-[var(--color-border)] border border-[var(--color-border)]"
            style={{ borderRadius: 'var(--radius-sm)' }}
            aria-label="Group members"
          >
            {memberList.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-[var(--spacing-4)] px-[var(--spacing-5)] py-[var(--spacing-4)]"
              >
                {/* Identity */}
                <div className="flex items-center gap-[var(--spacing-3)] min-w-0">
                  <div className="min-w-0">
                    <p className="m-0 text-[length:var(--text-body-sm)] font-medium text-[var(--color-text)] truncate">
                      {member.displayName}
                    </p>
                    <p className="m-0 font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
                      @{member.handle}
                    </p>
                  </div>
                </div>

                {/* Role badge + actions */}
                <div className="flex items-center gap-[var(--spacing-3)] shrink-0">
                  <span
                    className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)]"
                    aria-label={`Role: ${member.role}`}
                  >
                    {member.role}
                  </span>

                  {/* Owner can change roles of non-owners */}
                  {isOwner && member.userId !== user.id && member.role !== 'owner' && (
                    <>
                      {member.role === 'member' && (
                        <form
                          action={setRoleAction as unknown as (formData: FormData) => Promise<void>}
                        >
                          <input type="hidden" name="groupId" value={group.id} />
                          <input type="hidden" name="targetUserId" value={member.userId} />
                          <input type="hidden" name="newRole" value="moderator" />
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="locale" value={locale} />
                          <button
                            type="submit"
                            className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors bg-transparent border-0 cursor-pointer p-0"
                            style={{ transitionDuration: 'var(--duration-base)' }}
                          >
                            Promote
                          </button>
                        </form>
                      )}
                      {member.role === 'moderator' && (
                        <form
                          action={setRoleAction as unknown as (formData: FormData) => Promise<void>}
                        >
                          <input type="hidden" name="groupId" value={group.id} />
                          <input type="hidden" name="targetUserId" value={member.userId} />
                          <input type="hidden" name="newRole" value="member" />
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="locale" value={locale} />
                          <button
                            type="submit"
                            className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors bg-transparent border-0 cursor-pointer p-0"
                            style={{ transitionDuration: 'var(--duration-base)' }}
                          >
                            Demote
                          </button>
                        </form>
                      )}

                      {/* Transfer ownership */}
                      <form
                        action={
                          transferOwnershipAction as unknown as (
                            formData: FormData,
                          ) => Promise<void>
                        }
                      >
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="newOwnerId" value={member.userId} />
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="locale" value={locale} />
                        <button
                          type="submit"
                          className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors bg-transparent border-0 cursor-pointer p-0"
                          style={{ transitionDuration: 'var(--duration-base)' }}
                        >
                          Make owner
                        </button>
                      </form>

                      {/* Remove member */}
                      <form
                        action={async () => {
                          'use server';
                          await removeMemberAction(group.id, member.userId, slug, locale);
                        }}
                      >
                        <button
                          type="submit"
                          className="font-mono text-[length:var(--text-micro)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors bg-transparent border-0 cursor-pointer p-0"
                          style={{ transitionDuration: 'var(--duration-base)' }}
                          aria-label={`Remove ${member.displayName} from group`}
                        >
                          Remove
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
