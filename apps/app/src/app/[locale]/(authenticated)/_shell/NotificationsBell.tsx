'use client';

/**
 * NotificationsBell — real-time in-app notifications via SSE.
 *
 * - Opens an EventSource on mount to /api/notifications/stream.
 * - Shows unread count badge (capped at 99+).
 * - Click opens a dropdown listing the last 10 notifications.
 * - Mark-as-read and mark-all-as-read server actions.
 * - Without JS: the bell links to /notifications (full-page fallback).
 */

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { markAllAsReadAction, markAsReadAction } from '../_actions/notifications.ts';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

interface Props {
  initialNotifications: NotificationRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function badgeLabel(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'post_published':
      return 'Post published';
    case 'post_held':
      return 'Post held for review';
    case 'post_rejected':
      return 'Post rejected';
    case 'comment_reply':
      return 'New comment reply';
    case 'group_invite':
      return 'Group invitation';
    case 'moderation_assigned':
      return 'Moderation assigned';
    case 'appeal_resolved':
      return 'Appeal resolved';
    case 'mention':
      return 'You were mentioned';
    default:
      return kind;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationsBell({ initialNotifications }: Props) {
  const t = useTranslations('Notifications');
  const [notifications, setNotifications] = useState<NotificationRow[]>(initialNotifications);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // ── SSE subscription ────────────────────────────────────────────────────────

  useEffect(() => {
    const es = new EventSource('/api/notifications/stream');

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const notif = JSON.parse(event.data) as NotificationRow;
        // Parse dates from JSON strings
        if (typeof notif.createdAt === 'string') {
          notif.createdAt = new Date(notif.createdAt);
        }
        if (typeof notif.readAt === 'string') {
          notif.readAt = new Date(notif.readAt);
        }
        setNotifications((prev) => {
          // Avoid duplicates
          if (prev.some((n) => n.id === notif.id)) return prev;
          return [notif, ...prev].slice(0, 10);
        });
      } catch {
        // Malformed event — ignore
      }
    };

    return () => {
      es.close();
    };
  }, []);

  // ── Close dropdown on outside click or Escape ────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleMarkAsRead(id: string) {
    await markAsReadAction(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)));
  }

  async function handleMarkAllAsRead() {
    await markAllAsReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })));
    setOpen(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const recent = notifications.slice(0, 10);

  return (
    <div ref={dropdownRef} className="relative">
      {/* No-JS fallback: direct link to the notifications page */}
      <noscript>
        <a
          href="/notifications"
          className="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 2a6 6 0 0 1 6 6v3l1.5 3H2.5L4 11V8a6 6 0 0 1 6-6Z" />
            <path d="M8 17a2 2 0 0 0 4 0" />
          </svg>
          <span className="sr-only">{t('bell.label')}</span>
        </a>
      </noscript>

      {/* Bell button — JS-enhanced */}
      <button
        type="button"
        aria-label={t('bell.label')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]"
      >
        {/* Bell SVG — accessible, no emoji */}
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 2a6 6 0 0 1 6 6v3l1.5 3H2.5L4 11V8a6 6 0 0 1 6-6Z" />
          <path d="M8 17a2 2 0 0 0 4 0" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            data-testid="notif-badge"
            aria-label={t('bell.unreadCount', { count: unreadCount })}
            className="absolute top-0.5 end-0.5 min-w-[1.1rem] h-[1.1rem] flex items-center justify-center rounded-full bg-[var(--color-text)] text-[var(--color-paper)] text-[0.6rem] font-mono font-bold leading-none px-0.5 pointer-events-none"
          >
            {badgeLabel(unreadCount)}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <dialog
          open
          aria-label={t('dropdown.label')}
          className="static m-0 absolute end-0 top-full mt-2 w-80 bg-[var(--color-paper)] border border-[var(--color-border)] rounded shadow-lg z-50 overflow-hidden p-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-[var(--text-body-sm)] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('dropdown.title')}
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllAsRead()}
                aria-label={t('dropdown.markAll')}
                className="text-[var(--text-body-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors font-mono uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
              >
                {t('dropdown.markAll')}
              </button>
            )}
          </div>

          {/* List */}
          {recent.length === 0 ? (
            <div
              data-testid="notif-empty"
              className="px-4 py-8 text-center text-[var(--text-body-sm)] text-[var(--color-text-muted)]"
            >
              {t('dropdown.empty')}
            </div>
          ) : (
            <ul
              aria-label={t('dropdown.listLabel')}
              aria-live="polite"
              aria-atomic="false"
              className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)]"
            >
              {recent.map((n) => (
                <li
                  key={n.id}
                  data-testid="notification-item"
                  className={`px-4 py-3 flex items-start gap-3 ${!n.readAt ? 'bg-[var(--color-border)]' : ''}`}
                >
                  {/* Unread dot */}
                  {!n.readAt && (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-[var(--color-text)]"
                    />
                  )}
                  {n.readAt && <span className="flex-shrink-0 w-2" aria-hidden="true" />}

                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-body-sm)] text-[var(--color-text)] leading-snug">
                      {kindLabel(n.kind)}
                    </p>
                    <p className="text-[0.7rem] text-[var(--color-text-muted)] font-mono mt-0.5">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {!n.readAt && (
                    <button
                      type="button"
                      onClick={() => void handleMarkAsRead(n.id)}
                      aria-label={t('dropdown.markRead', { kind: kindLabel(n.kind) })}
                      className="flex-shrink-0 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
                    >
                      {t('dropdown.read')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Footer: link to full page */}
          <div className="border-t border-[var(--color-border)] px-4 py-2 text-center">
            <a
              href="/notifications"
              className="text-[var(--text-body-sm)] font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
            >
              {t('dropdown.viewAll')}
            </a>
          </div>
        </dialog>
      )}
    </div>
  );
}
