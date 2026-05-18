'use server';

import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers } from '@repo/database/schema';
import { inviteToGroup, revokeInvite, setMemberRole, transferOwnership } from '@repo/groups';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';

// ── Session helper ─────────────────────────────────────────────────────────────

async function requireSession() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── Action result type ─────────────────────────────────────────────────────────

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

// ── inviteMemberAction ─────────────────────────────────────────────────────────

const InviteSchema = z.object({
  groupId: z.string().uuid(),
  slug: z.string().min(1),
  locale: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['member', 'moderator']),
});

export async function inviteMemberAction(
  formData: FormData,
): Promise<ActionResult<{ rawToken: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const parsed = InviteSchema.safeParse({
    groupId: formData.get('groupId'),
    slug: formData.get('slug'),
    locale: formData.get('locale'),
    email: formData.get('email'),
    role: formData.get('role') ?? 'member',
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }

  const { groupId, slug, locale, email, role } = parsed.data;

  try {
    const result = await inviteToGroup({ groupId, inviterId: user.id, email, role });
    revalidatePath(`/${locale}/g/${slug}/members`);
    return { ok: true, data: { rawToken: result.rawToken } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── revokeInviteAction ─────────────────────────────────────────────────────────

export async function revokeInviteAction(
  rawToken: string,
  slug: string,
  locale: string,
): Promise<ActionResult<{ revoked: true }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  try {
    await revokeInvite(rawToken, user.id);
    revalidatePath(`/${locale}/g/${slug}/members`);
    return { ok: true, data: { revoked: true } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── setRoleAction ──────────────────────────────────────────────────────────────

const SetRoleSchema = z.object({
  groupId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  newRole: z.enum(['member', 'moderator']),
  slug: z.string().min(1),
  locale: z.string().min(2),
});

export async function setRoleAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const parsed = SetRoleSchema.safeParse({
    groupId: formData.get('groupId'),
    targetUserId: formData.get('targetUserId'),
    newRole: formData.get('newRole'),
    slug: formData.get('slug'),
    locale: formData.get('locale'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }

  const { groupId, targetUserId, newRole, slug, locale } = parsed.data;

  try {
    await setMemberRole(groupId, targetUserId, newRole, user.id);
    revalidatePath(`/${locale}/g/${slug}/members`);
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── transferOwnershipAction ───────────────────────────────────────────────────

const TransferSchema = z.object({
  groupId: z.string().uuid(),
  newOwnerId: z.string().uuid(),
  slug: z.string().min(1),
  locale: z.string().min(2),
});

export async function transferOwnershipAction(
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const parsed = TransferSchema.safeParse({
    groupId: formData.get('groupId'),
    newOwnerId: formData.get('newOwnerId'),
    slug: formData.get('slug'),
    locale: formData.get('locale'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }

  const { groupId, newOwnerId, slug, locale } = parsed.data;

  try {
    await transferOwnership(groupId, newOwnerId, user.id);
    revalidatePath(`/${locale}/g/${slug}/members`);
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── removeMemberAction ────────────────────────────────────────────────────────

export async function removeMemberAction(
  groupId: string,
  targetUserId: string,
  slug: string,
  locale: string,
): Promise<ActionResult<{ removed: true }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  // Only owners can remove members
  const actorRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  const actorMember = actorRows[0];
  if (!actorMember || actorMember.role !== 'owner') {
    return { ok: false, error: 'not_authorized' };
  }

  try {
    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)));
    revalidatePath(`/${locale}/g/${slug}/members`);
    return { ok: true, data: { removed: true } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
