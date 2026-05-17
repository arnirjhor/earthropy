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
