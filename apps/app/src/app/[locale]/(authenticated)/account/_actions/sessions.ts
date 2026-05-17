'use server';

/**
 * Server Actions for session management.
 * §3.5, §3.6 of docs/architecture/auth.md.
 */

import { getSession, revokeOtherSessions, revokeSession } from '@repo/auth';
import { db } from '@repo/database/client';
import { sessions } from '@repo/database/schema';
import { log } from '@repo/observability';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionActionState = {
  ok: boolean;
  errors: Record<string, string>;
};

export type SessionRow = {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
};

export type SessionsListResult = {
  sessions: SessionRow[];
};

// ── Helper: require authenticated user ────────────────────────────────────────

async function requireUser() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return { user: null, sessionId: null };
  const user = await getSession(sessionId);
  return { user, sessionId };
}

// ── listSessionsAction ────────────────────────────────────────────────────────

export async function listSessionsAction(): Promise<SessionsListResult> {
  const { user, sessionId } = await requireUser();
  if (!user) return { sessions: [] };

  const now = new Date();
  const rows = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, now)))
    .orderBy(sessions.createdAt);

  return {
    sessions: rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      isCurrent: row.id === sessionId,
    })),
  };
}

// ── revokeSessionAction ───────────────────────────────────────────────────────

export async function revokeSessionAction(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const { user, sessionId: currentSessionId } = await requireUser();
  if (!user || !currentSessionId) {
    return { ok: false, errors: { form: 'Not signed in.' } };
  }

  const parsed = z.string().min(1).safeParse(formData.get('sessionId'));
  if (!parsed.success) {
    return { ok: false, errors: { form: 'Session id is required.' } };
  }

  const targetId = parsed.data;

  // Revoke with userId guard so a user cannot revoke someone else's session
  await revokeSession(targetId, user.id);

  log.info('sessions: session revoked', { userId: user.id, targetId });

  // If revoking the current session, clear cookie and redirect to sign-in
  if (targetId === currentSessionId) {
    const jar = await cookies();
    jar.delete('earthropy_session');
    redirect('/en/signin');
  }

  return { ok: true, errors: {} };
}

// ── revokeOtherSessionsAction ─────────────────────────────────────────────────

export async function revokeOtherSessionsAction(): Promise<void> {
  const { user, sessionId } = await requireUser();
  if (!user || !sessionId) return;

  await revokeOtherSessions(user.id, sessionId);
  log.info('sessions: other sessions revoked', { userId: user.id });
}
