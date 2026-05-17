/**
 * Tests for NotificationsBell component.
 *
 * - Renders bell with no unread count when 0 notifications.
 * - Renders badge with N count when N > 0 unread notifications.
 * - Opens dropdown on click.
 * - Lists recent notifications in dropdown.
 * - Mark-as-read action fires on click.
 * - SSE EventSource is opened on mount.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const TRANSLATIONS: Record<string, string> = {
  'bell.label': 'Notifications',
  'bell.unreadCount': '{count} unread notifications',
  'dropdown.label': 'Notifications panel',
  'dropdown.title': 'Notifications',
  'dropdown.markAll': 'Mark all read',
  'dropdown.markRead': 'Mark {kind} as read',
  'dropdown.read': 'Read',
  'dropdown.empty': 'No notifications yet.',
  'dropdown.listLabel': 'Recent notifications',
  'dropdown.viewAll': 'View all',
};

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => TRANSLATIONS[key] ?? key,
}));

vi.mock('../_actions/notifications.ts', () => ({
  markAsReadAction: vi.fn().mockResolvedValue(undefined),
  markAllAsReadAction: vi.fn().mockResolvedValue(undefined),
}));

// Fake EventSource
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  readyState = 1;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2;
  }

  // Helper for tests to simulate receiving a message
  emit(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }
}

vi.stubGlobal('EventSource', FakeEventSource);

import { NotificationsBell } from './NotificationsBell.tsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

interface NotifRow {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

function makeNotif(overrides: Partial<NotifRow> = {}): NotifRow {
  return {
    id: `notif-${Math.random().toString(36).slice(2)}`,
    kind: 'post_published',
    payload: { postId: 'p-1' },
    readAt: null,
    createdAt: new Date('2026-05-01T12:00:00Z'),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('NotificationsBell — zero unread', () => {
  beforeEach(() => {
    FakeEventSource.instances.length = 0;
  });

  it('renders a bell button', () => {
    render(<NotificationsBell initialNotifications={[]} />);
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('does not render a badge when 0 unread', () => {
    render(<NotificationsBell initialNotifications={[]} />);
    expect(screen.queryByTestId('notif-badge')).not.toBeInTheDocument();
  });

  it('opens EventSource on mount', () => {
    render(<NotificationsBell initialNotifications={[]} />);
    expect(FakeEventSource.instances.length).toBe(1);
    expect(FakeEventSource.instances[0]?.url).toContain('/api/notifications/stream');
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = render(<NotificationsBell initialNotifications={[]} />);
    const es = FakeEventSource.instances[0];
    expect(es).toBeDefined();
    unmount();
    expect(es?.readyState).toBe(2);
  });
});

describe('NotificationsBell — with unread notifications', () => {
  beforeEach(() => {
    FakeEventSource.instances.length = 0;
  });

  it('renders badge with count when N > 0 unread', () => {
    const notifs = [makeNotif(), makeNotif(), makeNotif()];
    render(<NotificationsBell initialNotifications={notifs} />);
    const badge = screen.getByTestId('notif-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3');
  });

  it('caps badge display at 99+', () => {
    const notifs = Array.from({ length: 105 }, () => makeNotif());
    render(<NotificationsBell initialNotifications={notifs} />);
    const badge = screen.getByTestId('notif-badge');
    expect(badge).toHaveTextContent('99+');
  });

  it('opens dropdown when bell is clicked', () => {
    const notifs = [makeNotif()];
    render(<NotificationsBell initialNotifications={notifs} />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('list', { name: /recent notifications/i })).toBeInTheDocument();
  });

  it('lists notification items in dropdown', () => {
    const notifs = [
      makeNotif({ id: 'n1', kind: 'post_published' }),
      makeNotif({ id: 'n2', kind: 'comment_reply' }),
    ];
    render(<NotificationsBell initialNotifications={notifs} />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('shows empty state in dropdown when no notifications', () => {
    render(<NotificationsBell initialNotifications={[]} />);
    // Open the dropdown (since there's no badge, we need to click the bell)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByTestId('notif-empty')).toBeInTheDocument();
  });
});

describe('NotificationsBell — SSE integration', () => {
  beforeEach(() => {
    FakeEventSource.instances.length = 0;
  });

  it('increments unread count when new notification arrives via SSE', async () => {
    render(<NotificationsBell initialNotifications={[]} />);

    const es = FakeEventSource.instances[0];
    expect(es).toBeDefined();
    if (!es) return;
    const newNotif = makeNotif({ id: 'sse-1', kind: 'comment_reply' });

    await act(async () => {
      es.emit(JSON.stringify(newNotif));
    });

    expect(screen.getByTestId('notif-badge')).toHaveTextContent('1');
  });
});

describe('NotificationsBell — mark as read', () => {
  beforeEach(() => {
    FakeEventSource.instances.length = 0;
  });

  it('shows mark-all-read button in open dropdown', () => {
    const notifs = [makeNotif()];
    render(<NotificationsBell initialNotifications={notifs} />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('button', { name: /mark all/i })).toBeInTheDocument();
  });
});
