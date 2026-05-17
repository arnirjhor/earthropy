'use server';

/**
 * Server Actions for account lifecycle.
 * §2 (disabled state), §3.6 (revocation cascade) of docs/architecture/auth.md.
 */

import { getSession, revokeAllForUser } from '@repo/auth';
import { db } from '@repo/database/client';
import { users } from '@repo/database/schema';
import { log } from '@repo/observability';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountActionState = {
  ok: boolean;
  errors: Record<string, string>;
};

// ── Helper: require authenticated user ────────────────────────────────────────

async function requireUser() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── deleteAccountAction ───────────────────────────────────────────────────────

/**
 * Soft-disable the account:
 *   1. Confirm the submitted email matches the signed-in user's email.
 *   2. SET users.disabled_at = now() (auth.md §2 disabled state).
 *   3. revokeAllForUser (auth.md §3.6 revocation cascade).
 *   4. Clear the session cookie.
 *   5. Redirect to landing.
 */
export async function deleteAccountAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await requireUser();
  if (!user) return { ok: false, errors: { form: 'Not signed in.' } };

  const parsed = z.string().min(1, 'Enter your email to confirm.').safeParse(formData.get('email'));
  if (!parsed.success) {
    return {
      ok: false,
      errors: { email: parsed.error.errors[0]?.message ?? 'Enter your email to confirm.' },
    };
  }

  const confirmedEmail = parsed.data;

  // Email confirmation must match exactly (case-insensitive)
  if (confirmedEmail.toLowerCase() !== user.email.toLowerCase()) {
    return {
      ok: false,
      errors: { email: 'Email does not match. Enter your account email to confirm.' },
    };
  }

  // Soft-disable: set disabled_at
  await db
    .update(users)
    .set({ disabledAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Revoke all sessions
  await revokeAllForUser(user.id);

  // Clear the session cookie
  const jar = await cookies();
  jar.delete('earthropy_session');

  log.warn('account: disabled', { userId: user.id });

  redirect('/en');
}
