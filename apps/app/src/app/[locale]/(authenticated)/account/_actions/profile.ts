'use server';

/**
 * Server Actions for profile management.
 * §10.1 of docs/architecture/auth.md — display_name, handle, locale.
 */

import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { users } from '@repo/database/schema';
import { LOCALES } from '@repo/i18n/locales';
import { log } from '@repo/observability';
import { RateLimitError, rateLimitAction } from '@repo/ratelimit';
import { eq, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ProfileActionState = {
  ok: boolean;
  errors: Record<string, string>;
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const DisplayNameSchema = z
  .string()
  .min(1, 'Display name cannot be empty.')
  .max(80, 'Display name must be at most 80 characters.');

const HandleSchema = z
  .string()
  .min(3, 'Handle must be at least 3 characters.')
  .max(30, 'Handle must be at most 30 characters.')
  .regex(/^[a-z0-9-]+$/, 'Handles use a–z, 0–9, hyphen, 3–30 characters.');

const LocaleSchema = z.enum(LOCALES, { message: 'Invalid locale.' });

// ── Helper: require authenticated user ────────────────────────────────────────

async function requireUser() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── updateDisplayNameAction ───────────────────────────────────────────────────

export async function updateDisplayNameAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();
  if (!user) return { ok: false, errors: { form: 'Not signed in.' } };

  const parsed = DisplayNameSchema.safeParse(formData.get('displayName'));
  if (!parsed.success) {
    return {
      ok: false,
      errors: { displayName: parsed.error.errors[0]?.message ?? 'Invalid value.' },
    };
  }

  await db
    .update(users)
    .set({ displayName: parsed.data, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  log.info('profile: display name updated', { userId: user.id });
  return { ok: true, errors: {} };
}

// ── updateHandleAction ────────────────────────────────────────────────────────

export async function updateHandleAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();
  if (!user) return { ok: false, errors: { form: 'Not signed in.' } };

  const parsed = HandleSchema.safeParse(formData.get('handle'));
  if (!parsed.success) {
    return {
      ok: false,
      errors: { handle: parsed.error.errors[0]?.message ?? 'Invalid value.' },
    };
  }

  const handle = parsed.data;

  // Rate limit: one change per 30 days per user (auth.md §7)
  try {
    await rateLimitAction({ key: `handle:userId:${user.id}`, windowSec: 30 * 24 * 3600, max: 1 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      const retryDate = new Date(Date.now() + e.retryAfterSec * 1000);
      const dateStr = retryDate.toLocaleDateString('en', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      log.info('handle-change: rate limited', { userId: user.id });
      return {
        ok: false,
        errors: {
          handle: `You changed your handle recently. You can change it again on ${dateStr}.`,
        },
      };
    }
    throw e;
  }

  // Uniqueness check: look for any other user with the same lower(handle)
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.handle}) = lower(${handle})`)
    .limit(1);

  if (existing.length > 0 && existing[0]?.id !== user.id) {
    return { ok: false, errors: { handle: 'That handle is taken.' } };
  }

  await db.update(users).set({ handle, updatedAt: new Date() }).where(eq(users.id, user.id));

  log.info('profile: handle updated', { userId: user.id });
  return { ok: true, errors: {} };
}

// ── updateLocaleAction ────────────────────────────────────────────────────────

export async function updateLocaleAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();
  if (!user) return { ok: false, errors: { form: 'Not signed in.' } };

  const parsed = LocaleSchema.safeParse(formData.get('locale'));
  if (!parsed.success) {
    return {
      ok: false,
      errors: { locale: parsed.error.errors[0]?.message ?? 'Invalid locale.' },
    };
  }

  const locale = parsed.data;

  await db.update(users).set({ locale, updatedAt: new Date() }).where(eq(users.id, user.id));

  log.info('profile: locale updated', { userId: user.id, locale });

  // Redirect to the account page under the new locale (auth.md §locale-change)
  redirect(`/${locale}/account`);
}
