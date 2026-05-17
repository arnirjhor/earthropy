'use client';

import DOMPurify from 'dompurify';
import { marked } from 'marked';

export interface MarkdownBodyProps {
  readonly md: string;
  readonly className?: string;
}

/**
 * Renders Markdown as sanitized HTML.
 *
 * Uses marked for parsing and DOMPurify for XSS sanitization.
 * Must run on the client because DOMPurify requires a DOM environment.
 */
export function MarkdownBody({ md, className }: MarkdownBodyProps) {
  // marked() is synchronous when called directly (no async options)
  const raw = marked(md) as string;
  const sanitized = DOMPurify.sanitize(raw);

  const combined = ['prose prose-sm max-w-none text-[var(--color-text)]', className ?? '']
    .join(' ')
    .trim();

  return (
    <div
      data-testid="markdown-body"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify.sanitize upstream
      dangerouslySetInnerHTML={{ __html: sanitized }}
      className={combined}
    />
  );
}
