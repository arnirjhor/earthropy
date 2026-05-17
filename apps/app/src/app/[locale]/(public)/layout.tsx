import type { ReactNode } from 'react';

/**
 * (public) route group layout — no session required.
 * Provides the auth shell: centered card on paper background.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-paper)] flex items-start justify-center pt-[var(--spacing-16)] px-[var(--spacing-4)]">
      {children}
    </div>
  );
}
