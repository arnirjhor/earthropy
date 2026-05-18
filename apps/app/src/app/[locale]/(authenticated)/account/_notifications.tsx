'use client';

/**
 * Notification preferences — localStorage-based for v0.1.
 *
 * Decision (A-AUTH-4):
 *   The `users` table has no `notification_prefs` JSON column and adding one
 *   requires a schema migration. Per task constraints (no schema changes in
 *   this task), prefs are stored in localStorage under the key
 *   `earthropy:notif_prefs`. A v0.2 follow-up will add the column and migrate
 *   the stored values to the server on first load.
 *
 *   Default: all channels enabled. Stored shape: Record<NotifKind, { inApp: boolean; email: boolean }>.
 */

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type NotifKind = 'newPost' | 'mention' | 'groupInvite' | 'moderation';

type KindPrefs = { inApp: boolean; email: boolean };
type PrefsMap = Record<NotifKind, KindPrefs>;

const KINDS: NotifKind[] = ['newPost', 'mention', 'groupInvite', 'moderation'];
const STORAGE_KEY = 'earthropy:notif_prefs';

function defaultPrefs(): PrefsMap {
  return {
    newPost: { inApp: true, email: true },
    mention: { inApp: true, email: true },
    groupInvite: { inApp: true, email: true },
    moderation: { inApp: true, email: true },
  };
}

function loadPrefs(): PrefsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs();
    return JSON.parse(raw) as PrefsMap;
  } catch {
    return defaultPrefs();
  }
}

function savePrefs(prefs: PrefsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function NotificationPrefs() {
  const t = useTranslations('Auth.account.notifications');
  const [prefs, setPrefs] = useState<PrefsMap>(defaultPrefs);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setMounted(true);
  }, []);

  function toggle(kind: NotifKind, channel: 'inApp' | 'email') {
    setPrefs((prev) => {
      const next = {
        ...prev,
        [kind]: { ...prev[kind], [channel]: !prev[kind][channel] },
      };
      savePrefs(next);
      return next;
    });
  }

  if (!mounted) {
    // Avoid hydration mismatch — render nothing until client mounts
    return null;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-4)]">
      <p className="text-[var(--text-body-sm)] text-[var(--color-text-muted)]">
        {t('description')}
      </p>

      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-[var(--text-body)] text-[var(--color-text)]"
          aria-label="Notification channel preferences"
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="text-start py-[var(--spacing-2)] pe-[var(--spacing-6)] font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                Notification
              </th>
              <th
                scope="col"
                className="py-[var(--spacing-2)] px-[var(--spacing-4)] font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                {t('inApp')}
              </th>
              <th
                scope="col"
                className="py-[var(--spacing-2)] px-[var(--spacing-4)] font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                {t('email')}
              </th>
            </tr>
          </thead>
          <tbody>
            {KINDS.map((kind) => (
              <tr key={kind} className="border-t border-[var(--color-border)]">
                <td className="py-[var(--spacing-3)] pe-[var(--spacing-6)]">
                  {t(`kinds.${kind}`)}
                </td>
                <td className="py-[var(--spacing-3)] px-[var(--spacing-4)] text-center">
                  <input
                    type="checkbox"
                    checked={prefs[kind].inApp}
                    onChange={() => toggle(kind, 'inApp')}
                    aria-label={`${t(`kinds.${kind}`)} — ${t('inApp')}`}
                    className="h-4 w-4 accent-[var(--color-text)]"
                  />
                </td>
                <td className="py-[var(--spacing-3)] px-[var(--spacing-4)] text-center">
                  <input
                    type="checkbox"
                    checked={prefs[kind].email}
                    onChange={() => toggle(kind, 'email')}
                    aria-label={`${t(`kinds.${kind}`)} — ${t('email')}`}
                    className="h-4 w-4 accent-[var(--color-text)]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
