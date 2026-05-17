import type { ReactNode } from 'react';

/**
 * Group browse nested layout.
 * Renders full-width inside the (public) route-group shell by stretching
 * to the container's available width. The outer (public) layout provides
 * the `bg-[var(--color-paper)]` background; this segment resets the
 * inner constraint so the grid can breathe.
 */
export default function GroupBrowseLayout({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-none">{children}</div>;
}
