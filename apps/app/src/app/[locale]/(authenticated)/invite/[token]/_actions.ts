'use server';

import { getSession } from '@repo/auth';
import { claimInvite } from '@repo/groups';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Claim a group invite token.
 *
 * GET-interstitial pattern: the token arrives in the URL path; this action
 * is called on form submit (POST). A pre-fetcher that GETs the page does NOT
 * consume the token.
 */
export async function claimInviteAction(locale: string, rawToken: string): Promise<void> {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) {
    redirect(`/${locale}/signin?next=/${locale}/invite/${rawToken}`);
  }

  const user = await getSession(sessionId);
  if (!user) {
    redirect(`/${locale}/signin?next=/${locale}/invite/${rawToken}`);
  }

  try {
    const result = await claimInvite(rawToken, user.id);
    // Redirect to the group page (we only have groupId, not slug — do a DB lookup)
    const { db } = await import('@repo/database/client');
    const { groups } = await import('@repo/database/schema');
    const { eq } = await import('drizzle-orm');
    const groupRows = await db
      .select({ slug: groups.slug })
      .from(groups)
      .where(eq(groups.id, result.groupId))
      .limit(1);

    const slug = groupRows[0]?.slug;
    if (slug) {
      redirect(`/${locale}/g/${slug}`);
    } else {
      redirect(`/${locale}/dashboard`);
    }
  } catch {
    // Token invalid/expired — let page handle display via searchParam
    redirect(`/${locale}/invite/${rawToken}?error=invalid`);
  }
}
