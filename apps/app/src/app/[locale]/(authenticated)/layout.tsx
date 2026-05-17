import type { ReactNode } from 'react';

/**
 * (authenticated) route group layout.
 * Auth gating is handled in proxy.ts before this renders.
 */
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[var(--color-paper)]">{children}</div>;
}
