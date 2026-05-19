'use client';

import { MarkdownBody } from '@/lib/markdown.tsx';
import { useCallback, useState } from 'react';
import { translateContentAction } from './_actions.ts';

export interface TranslateToggleProps {
  /** The original body markdown text. */
  originalBody: string;
  /** The locale the content was written in (BCP-47). */
  sourceLocale: string;
  /** The viewer's current UI locale (BCP-47). */
  targetLocale: string;
  /** The post id — required for caching. */
  postId: string;
  /** The comment id — null for post-body translations. */
  commentId: string | null;
  /** className forwarded to the container div. */
  className?: string;
  /** UI strings (passed from server component so they are translated). */
  labels: {
    translate: string;
    showOriginal: string;
    translating: string;
    translatedFrom: string;
    error: string;
  };
}

type State =
  | { mode: 'original' }
  | { mode: 'loading' }
  | { mode: 'translated'; text: string; provider: string }
  | { mode: 'error'; message: string };

export function TranslateToggle({
  originalBody,
  sourceLocale,
  targetLocale,
  postId,
  commentId,
  className,
  labels,
}: TranslateToggleProps) {
  const [state, setState] = useState<State>({ mode: 'original' });

  const requestTranslation = useCallback(async () => {
    setState({ mode: 'loading' });
    const fd = new FormData();
    fd.set('postId', postId);
    if (commentId !== null) fd.set('commentId', commentId);
    fd.set('text', originalBody);
    fd.set('sourceLocale', sourceLocale);
    fd.set('targetLocale', targetLocale);

    const result = await translateContentAction(fd);
    if (result.ok) {
      setState({
        mode: 'translated',
        text: result.data.translatedText,
        provider: result.data.provider,
      });
    } else {
      setState({ mode: 'error', message: result.error });
    }
  }, [postId, commentId, originalBody, sourceLocale, targetLocale]);

  const showOriginal = useCallback(() => {
    setState({ mode: 'original' });
  }, []);

  const showingTranslated = state.mode === 'translated';
  const isLoading = state.mode === 'loading';
  const displayBody = showingTranslated ? state.text : originalBody;

  return (
    <div className={className}>
      <MarkdownBody md={displayBody} />

      {/* Translation attribution bar */}
      {showingTranslated && (
        <p
          aria-live="polite"
          className="mt-[var(--spacing-2)] font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)]"
        >
          {labels.translatedFrom} {sourceLocale.toUpperCase()} · {state.provider}
        </p>
      )}

      {/* Error message */}
      {state.mode === 'error' && (
        <p
          role="alert"
          className="mt-[var(--spacing-2)] font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)]"
        >
          {labels.error}
        </p>
      )}

      {/* Translate / Show original toggle */}
      <div className="mt-[var(--spacing-3)]">
        {showingTranslated ? (
          <button
            type="button"
            onClick={showOriginal}
            className="font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)] transition-colors"
          >
            {labels.showOriginal}
          </button>
        ) : (
          <button
            type="button"
            onClick={requestTranslation}
            disabled={isLoading}
            aria-busy={isLoading}
            className="font-mono text-[length:var(--text-mono)] text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? labels.translating : labels.translate}
          </button>
        )}
      </div>
    </div>
  );
}
