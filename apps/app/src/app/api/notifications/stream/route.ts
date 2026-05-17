/**
 * GET /api/notifications/stream — Server-Sent Events endpoint.
 *
 * - Authenticated: requires earthropy_session cookie.
 * - Pings every 25s to keep the connection alive through proxies.
 * - Sends a JSON event for each new notification for the connected user.
 * - Cleans up listener on disconnect.
 */
import { getSession } from '@repo/auth';
import { notificationEmitter } from '@repo/notifications';
import type { NotificationEvent } from '@repo/notifications';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
// Disable response caching for SSE
export const revalidate = 0;

export async function GET(): Promise<Response> {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const user = await getSession(sessionId);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = user.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection comment to flush headers immediately
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Ping every 25s to prevent proxy timeouts
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // Connection closed
          clearInterval(pingInterval);
        }
      }, 25_000);

      // Listen for notifications for this user
      function onNotification(event: NotificationEvent) {
        if (event.userId !== userId) return;
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Connection closed — clean up
          notificationEmitter.off('notification', onNotification);
          clearInterval(pingInterval);
        }
      }

      notificationEmitter.on('notification', onNotification);

      // Clean up when the stream is cancelled (client disconnects)
      return () => {
        clearInterval(pingInterval);
        notificationEmitter.off('notification', onNotification);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
