'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Thin wrapper that applies Field Record token defaults.
// Uses prefers-color-scheme via theme="system" (Sonner's default).
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--color-surface)',
          '--normal-text': 'var(--color-text)',
          '--normal-border': 'var(--color-border)',
          '--success-bg': 'var(--color-surface)',
          '--success-text': 'var(--color-text)',
          '--error-bg': 'var(--color-surface)',
          '--error-text': 'var(--sdg-1)',
          '--toast-font-family': 'var(--font-mono)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
