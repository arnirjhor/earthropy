'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { createCommentAction } from './_actions.ts';

export interface ReplyFormProps {
  readonly postId: string;
  readonly parentCommentId: string | null;
  readonly locale: string;
  /** If null, the trigger button is not shown (top-level form). */
  readonly replyLabel: string | null;
  readonly cancelLabel: string;
  readonly submitLabel: string;
  readonly submittingLabel: string;
  readonly placeholderText: string;
  /** When true the form is always visible (top-level use case). */
  readonly alwaysExpanded?: boolean;
}

export function ReplyForm({
  postId,
  parentCommentId,
  locale,
  replyLabel,
  cancelLabel,
  submitLabel,
  submittingLabel,
  placeholderText,
  alwaysExpanded = false,
}: ReplyFormProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleReplyClick() {
    setExpanded(true);
    // Focus the textarea on next tick
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleCancel() {
    if (!alwaysExpanded) {
      setExpanded(false);
    }
    setError(null);
    if (formRef.current) formRef.current.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = (formData.get('body') as string | null)?.trim() ?? '';
    if (!body) return;

    setError(null);
    startTransition(async () => {
      const result = await createCommentAction(formData);
      if (result.ok) {
        if (formRef.current) formRef.current.reset();
        if (!alwaysExpanded) setExpanded(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  // No-JS fallback: the form's action attribute uses the Server Action URL
  // so the browser can submit the form natively when JS is disabled.

  if (!expanded && replyLabel !== null) {
    return (
      <button
        type="button"
        onClick={handleReplyClick}
        className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
      >
        {replyLabel}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="w-full flex flex-col gap-[var(--spacing-3)]"
      // No-JS fallback: action is handled by the server action via the hidden inputs
      // biome-ignore lint/suspicious/noExplicitAny: Next.js Server Action on form action
      action={createCommentAction as any}
    >
      {/* Hidden fields */}
      <input type="hidden" name="postId" value={postId} />
      {parentCommentId !== null && (
        <input type="hidden" name="parentCommentId" value={parentCommentId} />
      )}
      <input type="hidden" name="locale" value={locale} />

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        name="body"
        data-testid="comment-body-input"
        required
        minLength={1}
        maxLength={10000}
        placeholder={placeholderText}
        rows={3}
        disabled={isPending}
        aria-label={placeholderText}
        className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)] disabled:opacity-50"
      />

      {/* Error */}
      {error !== null && (
        <p
          role="alert"
          className="font-mono text-[length:var(--text-mono)] text-[color:var(--sdg-1)]"
        >
          {error}
        </p>
      )}

      {/* Buttons */}
      <div className="flex flex-wrap gap-[var(--spacing-3)]">
        <button
          type="submit"
          data-testid="comment-submit"
          disabled={isPending}
          aria-busy={isPending}
          className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider px-[var(--spacing-4)] py-[var(--spacing-2)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-[var(--radius-xs)] hover:border-[var(--color-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
        >
          {isPending ? submittingLabel : submitLabel}
        </button>
        {(!alwaysExpanded || parentCommentId !== null) && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider px-[var(--spacing-4)] py-[var(--spacing-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-text)] focus-visible:outline-offset-2"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}
