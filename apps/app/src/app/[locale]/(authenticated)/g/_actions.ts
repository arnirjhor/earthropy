'use server';

import { getSession } from '@repo/auth';
import { createGroup, updateGroup } from '@repo/groups';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// ── Zod schemas ────────────────────────────────────────────────────────────────

const SdgIdSchema = z.number().int().min(1).max(17);

const CreateGroupSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: z
    .string()
    .max(80)
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  description: z.string().max(2000).trim().default(''),
  primarySdgId: SdgIdSchema,
  additionalSdgIds: z.array(SdgIdSchema).default([]),
  visibility: z.enum(['public', 'listed', 'private']).default('public'),
  preferredLocale: z.string().min(2).max(20).default('en'),
  locationText: z.string().max(200).trim().nullable().default(null),
});

const UpdateGroupSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  visibility: z.enum(['public', 'listed', 'private']).optional(),
  preferredLocale: z.string().min(2).max(20).optional(),
  locationText: z.string().max(200).trim().nullable().optional(),
});

// ── Action result type ─────────────────────────────────────────────────────────

export type ActionError = { ok: false; error: string };
export type ActionOk<T> = { ok: true; data: T };
export type ActionResult<T> = ActionOk<T> | ActionError;

// ── Session helper ─────────────────────────────────────────────────────────────

async function requireSession() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── createGroupAction ──────────────────────────────────────────────────────────

/**
 * Create a new group from a FormData submission.
 *
 * Expects fields:
 *   name, description, primarySdgId (numeric string), additionalSdgIds (JSON array string),
 *   visibility, preferredLocale, locationText.
 *
 * On success, redirects to /g/<slug>.
 * On validation or auth failure, returns ActionError (caller handles).
 */
export async function createGroupAction(
  formData: FormData,
): Promise<ActionResult<{ slug: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const raw = {
    name: formData.get('name'),
    slug: formData.get('slug') ?? undefined,
    description: formData.get('description') ?? '',
    primarySdgId: Number(formData.get('primarySdgId')),
    additionalSdgIds: (() => {
      const v = formData.get('additionalSdgIds');
      if (!v) return [];
      try {
        return JSON.parse(v as string) as unknown;
      } catch {
        return [];
      }
    })(),
    visibility: formData.get('visibility') ?? 'public',
    preferredLocale: formData.get('preferredLocale') ?? 'en',
    locationText: formData.get('locationText') ?? null,
  };

  const parsed = CreateGroupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }

  const data = parsed.data;

  let slug: string;
  try {
    const group = await createGroup({
      name: data.name,
      slug: data.slug,
      description: data.description,
      primarySdgId: data.primarySdgId as Parameters<typeof createGroup>[0]['primarySdgId'],
      additionalSdgIds: data.additionalSdgIds as Parameters<
        typeof createGroup
      >[0]['additionalSdgIds'],
      visibility: data.visibility,
      preferredLocale: data.preferredLocale,
      locationText: data.locationText,
      createdBy: user.id,
    });
    slug = group.slug;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }

  redirect(`/g/${slug}`);
}

// ── joinGroupAction ────────────────────────────────────────────────────────────

/**
 * Join a group as a member.
 *
 * Stub: directly inserts into `group_members` with role='member'.
 * TODO B-GROUP-5: replace with `joinGroup` from @repo/groups once that package
 * exposes a proper service function with invite-token support.
 *
 * On success, revalidates + redirects back to the group detail page.
 */
export async function joinGroupAction(
  groupId: string,
  slug: string,
  locale: string,
): Promise<ActionResult<{ joined: true }>> {
  const { db } = await import('@repo/database/client');
  const { groupMembers } = await import('@repo/database/schema');

  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  try {
    await db
      .insert(groupMembers)
      .values({ groupId, userId: user.id, role: 'member' })
      .onConflictDoNothing();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }

  redirect(`/${locale}/g/${slug}`);
}

// ── leaveGroupAction ───────────────────────────────────────────────────────────

/**
 * Leave a group (delete the caller's membership row).
 *
 * Owners cannot leave; they must transfer ownership first (not yet
 * implemented — returns an error for owners).
 *
 * On success, revalidates + redirects back to the group detail page.
 */
export async function leaveGroupAction(
  groupId: string,
  slug: string,
  locale: string,
): Promise<ActionResult<{ left: true }>> {
  const { db } = await import('@repo/database/client');
  const { groupMembers } = await import('@repo/database/schema');
  const { eq, and } = await import('drizzle-orm');

  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  // Check current role
  const rows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)));

  const membership = rows[0];
  if (!membership) return { ok: false, error: 'not_a_member' };
  if (membership.role === 'owner') return { ok: false, error: 'owners_cannot_leave' };

  try {
    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }

  redirect(`/${locale}/g/${slug}`);
}

// ── updateGroupAction ──────────────────────────────────────────────────────────

/**
 * Update an existing group.
 *
 * @param id   - UUID of the group to update.
 * @param formData - Fields to update (all optional).
 */
export async function updateGroupAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const raw = {
    name: formData.get('name') ?? undefined,
    description: formData.get('description') ?? undefined,
    visibility: formData.get('visibility') ?? undefined,
    preferredLocale: formData.get('preferredLocale') ?? undefined,
    locationText: formData.get('locationText') ?? undefined,
  };

  // Remove undefined keys so Zod .optional() fields work correctly
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== null),
  );

  const parsed = UpdateGroupSchema.safeParse(cleaned);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }

  try {
    const updated = await updateGroup(id, parsed.data, { actorId: user.id });
    return { ok: true, data: { id: updated.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}
