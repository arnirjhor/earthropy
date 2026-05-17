import { revokeSession } from '@repo/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Sign-out page — clears the session cookie and redirects to /signin.
 * No UI needed; this is a server action triggered via navigation.
 */
export default async function SignOutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;

  if (sessionId) {
    await revokeSession(sessionId).catch(() => {
      // Ignore errors — session may already be gone
    });
    jar.delete('earthropy_session');
  }

  redirect(`/${locale}/signin`);
}
