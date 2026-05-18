'use client';

/**
 * Active sessions list with revoke buttons.
 * auth.md §3.5 — shows User-Agent + creation timestamp + revoke button.
 */

import { Button } from '@repo/design-system/components/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import type { SessionActionState, SessionRow } from './_actions/sessions.ts';
import { revokeOtherSessionsAction, revokeSessionAction } from './_actions/sessions.ts';

interface SessionsListProps {
  sessions: SessionRow[];
}

const initialState: SessionActionState = { ok: false, errors: {} };

function formatCreatedAgo(createdAt: Date): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (86400 * 1000));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function truncateUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown browser';
  // Extract a readable browser/OS snippet
  if (ua.length <= 60) return ua;
  return `${ua.slice(0, 57)}…`;
}

function SessionItem({ session }: { session: SessionRow }) {
  const t = useTranslations('Auth.account.sessions');
  const [state, formAction, pending] = useActionState(revokeSessionAction, initialState);

  return (
    <li className="flex items-center justify-between gap-[var(--spacing-4)] py-[var(--spacing-3)] border-b border-[var(--color-border)] last:border-b-0">
      <div className="flex flex-col gap-[var(--spacing-1)]">
        <span className="text-[var(--text-body)] text-[var(--color-text)]">
          {truncateUserAgent(session.userAgent)}
          {session.isCurrent && (
            <span className="ms-[var(--spacing-2)] font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]">
              — {t('currentDevice')}
            </span>
          )}
        </span>
        <span className="font-mono text-[var(--text-mono)] text-[var(--color-text-muted)]">
          {formatCreatedAgo(session.createdAt)}
        </span>
      </div>
      {!session.isCurrent && (
        <form action={formAction}>
          <input type="hidden" name="sessionId" value={session.id} />
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={pending}
            aria-label={`${pending ? t('revoking') : t('revoke')} — ${truncateUserAgent(session.userAgent)}`}
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider"
          >
            {pending ? t('revoking') : t('revoke')}
          </Button>
          {state.errors?.form && (
            <p
              role="alert"
              className="mt-1 text-[var(--text-body-sm)] text-[var(--color-destructive)]"
            >
              {state.errors.form}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

export function SessionsList({ sessions }: SessionsListProps) {
  const t = useTranslations('Auth.account.sessions');
  const [isPending, startTransition] = useTransition();

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  async function handleRevokeAll() {
    startTransition(async () => {
      await revokeOtherSessionsAction();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-4)]">
      {sessions.length === 0 ? (
        <p className="text-[var(--text-body)] text-[var(--color-text-muted)]">
          {t('noOtherSessions')}
        </p>
      ) : (
        <ul aria-label="Active sessions" className="list-none p-0 m-0">
          {sessions.map((session) => (
            <SessionItem key={session.id} session={session} />
          ))}
        </ul>
      )}

      {otherSessions.length > 0 && (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleRevokeAll}
          className="self-start font-mono text-[var(--text-mono)] uppercase tracking-wider"
        >
          {isPending ? t('revoking') : t('revokeAll')}
        </Button>
      )}
    </div>
  );
}
