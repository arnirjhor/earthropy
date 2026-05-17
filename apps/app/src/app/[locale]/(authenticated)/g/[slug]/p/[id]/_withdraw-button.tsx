'use client';

import { withdrawPostAction } from '@/app/[locale]/(authenticated)/p/_actions.ts';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export interface WithdrawButtonProps {
  readonly postId: string;
  readonly locale: string;
  readonly slug: string;
  readonly withdrawLabel: string;
  readonly withdrawingLabel: string;
}

export function WithdrawButton({
  postId,
  locale,
  slug,
  withdrawLabel,
  withdrawingLabel,
}: WithdrawButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleWithdraw() {
    startTransition(async () => {
      const result = await withdrawPostAction(postId);
      if (result.ok) {
        router.push(`/${locale}/g/${slug}/p/${postId}`);
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleWithdraw();
      }}
    >
      <button
        type="submit"
        data-testid="withdraw-button"
        disabled={isPending}
        aria-busy={isPending}
        className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider px-[var(--spacing-4)] py-[var(--spacing-2)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-[var(--radius-xs)] hover:border-[color:var(--sdg-1)] hover:text-[color:var(--sdg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? withdrawingLabel : withdrawLabel}
      </button>
    </form>
  );
}
