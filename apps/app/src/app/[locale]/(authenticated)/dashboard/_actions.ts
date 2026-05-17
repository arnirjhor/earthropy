'use server';

import { getSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { followedSdgs } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

async function requireSession() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

/**
 * Follow an SDG — inserts a `user_followed_sdgs` row.
 * Silently ignores duplicate (onConflictDoNothing).
 */
export async function followSdgAction(sdgId: number): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const id = Number(sdgId);
  if (!Number.isInteger(id) || id < 1 || id > 17) {
    return { ok: false, error: 'invalid_sdg_id' };
  }

  try {
    await db.insert(followedSdgs).values({ userId: user.id, sdgId: id }).onConflictDoNothing();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }

  revalidatePath('/[locale]/(authenticated)/dashboard', 'page');
  return { ok: true };
}

/**
 * Unfollow an SDG — deletes the `user_followed_sdgs` row.
 */
export async function unfollowSdgAction(sdgId: number): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const id = Number(sdgId);
  if (!Number.isInteger(id) || id < 1 || id > 17) {
    return { ok: false, error: 'invalid_sdg_id' };
  }

  try {
    await db
      .delete(followedSdgs)
      .where(and(eq(followedSdgs.userId, user.id), eq(followedSdgs.sdgId, id)));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }

  revalidatePath('/[locale]/(authenticated)/dashboard', 'page');
  return { ok: true };
}
