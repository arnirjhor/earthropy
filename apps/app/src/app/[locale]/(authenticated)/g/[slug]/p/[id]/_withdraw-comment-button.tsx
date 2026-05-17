'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { withdrawCommentAction } from './_actions.ts';

export interface WithdrawCommentButtonProps {
  readonly commentId: string;
  readonly withdrawLabel: string;
  readonly withdrawingLabel: string;
}

export function WithdrawCommentButton({
  commentId,
  withdrawLabel,
  withdrawingLabel,
}: WithdrawCommentButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleWithdraw() {
    startTransition(async () => {
      const result = await withdrawCommentAction(commentId);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      data-testid="withdraw-comment-button"
      data-comment-id={commentId}
      onClick={handleWithdraw}
      disabled={isPending}
      aria-busy={isPending}
      className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[color:var(--sdg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? withdrawingLabel : withdrawLabel}
    </button>
  );
}
