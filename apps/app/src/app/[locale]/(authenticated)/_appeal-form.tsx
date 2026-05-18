'use client';

/**
 * AppealForm — inline appeal submission form.
 *
 * Rendered when post/comment status is 'rejected'. The author sees a trigger
 * button that expands a textarea + submit button using useTransition (not
 * useActionState which requires a specific call signature).
 */

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { submitAppealAction } from './moderation/_appeal-actions.ts';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AppealFormProps {
  readonly targetType: 'post' | 'comment';
  readonly targetId: string;
  readonly submitLabel: string;
  readonly submittingLabel: string;
  readonly placeholderText: string;
  readonly cancelLabel: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AppealForm({
  targetType,
  targetId,
  submitLabel,
  submittingLabel,
  placeholderText,
  cancelLabel,
}: AppealFormProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleOpen() {
    setExpanded(true);
    // Focus textarea on next tick
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleCancel() {
    setExpanded(false);
    setError(null);
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = (formData.get('message') as string | null)?.trim() ?? '';
    if (!message) return;

    setError(null);
    startTransition(async () => {
      const result = await submitAppealAction({ targetType, targetId, message });
      if (result.ok) {
        setSubmitted(true);
        setExpanded(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (submitted) {
    return (
      <p
        data-testid="appeal-submitted"
        className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
      >
        {submitLabel} — submitted
      </p>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        data-testid="appeal-trigger"
        onClick={handleOpen}
        className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        style={{ transitionDuration: 'var(--duration-base)' }}
        aria-label={`${submitLabel} for this ${targetType}`}
      >
        {submitLabel}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      data-testid="appeal-form"
      dir="auto"
      onSubmit={handleSubmit}
      className="flex flex-col gap-[var(--spacing-3)]"
    >
      <textarea
        ref={textareaRef}
        name="message"
        data-testid="appeal-message-input"
        required
        minLength={1}
        maxLength={5000}
        placeholder={placeholderText}
        rows={4}
        disabled={isPending}
        aria-label={placeholderText}
        className="w-full resize-y border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] disabled:opacity-50"
        style={{ borderRadius: 'var(--radius-sm)' }}
      />

      {error !== null && (
        <p
          role="alert"
          className="font-mono text-[length:var(--text-mono)] text-[color:var(--sdg-1)]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-[var(--spacing-3)]">
        <button
          type="submit"
          data-testid="appeal-submit"
          disabled={isPending}
          aria-busy={isPending}
          className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider px-[var(--spacing-4)] py-[var(--spacing-2)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderRadius: 'var(--radius-xs)',
            transitionDuration: 'var(--duration-base)',
          }}
        >
          {isPending ? submittingLabel : submitLabel}
        </button>

        <button
          type="button"
          data-testid="appeal-cancel"
          disabled={isPending}
          onClick={handleCancel}
          className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider px-[var(--spacing-4)] py-[var(--spacing-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
          style={{ transitionDuration: 'var(--duration-base)' }}
        >
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}
