'use client';

import { createPostAction } from '@/app/[locale]/(authenticated)/p/_actions.ts';
import { SdgMultiSelect } from '@repo/design-system/components/SdgMultiSelect';
import { Button } from '@repo/design-system/components/ui';
import { Input } from '@repo/design-system/components/ui';
import { Label } from '@repo/design-system/components/ui';
import type { SdgId } from '@repo/sdg';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { useActionState } from 'react';

// ── Constants ──────────────────────────────────────────────────────────────────

const TITLE_MAX = 500;
const BODY_MAX = 50_000;

// ── Tab type ───────────────────────────────────────────────────────────────────

type Tab = 'write' | 'preview';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface PostCreateFormProps {
  readonly groupId: string;
  readonly groupSlug: string;
  readonly locale: string;
  /** SDG ids inherited from the group (all selected by default). */
  readonly groupSdgIds: number[];
  /** The group's primary SDG id (pre-selected as post primary). */
  readonly groupPrimarySdgId: number | null;
}

// ── Sanitized preview renderer ─────────────────────────────────────────────────

interface PreviewPaneProps {
  readonly html: string;
}

/**
 * Renders DOMPurify-sanitized HTML from marked.
 * Content must be cleaned by DOMPurify.sanitize() before being stored in state.
 */
function PreviewPane({ html }: PreviewPaneProps) {
  return (
    <div
      data-testid="markdown-preview"
      /* Content is DOMPurify.sanitize()'d by handleTabChange before being stored in state.
         Raw user input never reaches this prop directly. */
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify upstream
      dangerouslySetInnerHTML={{ __html: html }}
      className="prose prose-sm max-w-none min-h-[200px] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--spacing-4)] py-[var(--spacing-3)] text-[var(--color-text)]"
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PostCreateForm({
  groupId,
  groupSlug,
  locale,
  groupSdgIds,
  groupPrimarySdgId,
}: PostCreateFormProps) {
  const router = useRouter();
  const initialState = { ok: false as const, error: '' };

  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData): Promise<typeof initialState> => {
      // Build combined sdgIds from SdgMultiSelect hidden inputs
      const primaryId = formData.get('primarySdgId');
      const additionalRaw = formData.get('additionalSdgIds');
      let additionalIds: number[] = [];
      try {
        additionalIds = JSON.parse((additionalRaw ?? '[]') as string) as number[];
      } catch {
        additionalIds = [];
      }
      const sdgIds = [...(primaryId ? [Number(primaryId)] : []), ...additionalIds];
      formData.set('sdgIds', JSON.stringify(sdgIds));

      const result = await createPostAction(formData);
      if (!result.ok) return result as typeof initialState;
      router.push(`/${locale}/g/${groupSlug}/p/${result.data.id}`);
      return initialState;
    },
    initialState,
  );

  const [tab, setTab] = useState<Tab>('write');
  const [body, setBody] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const previewRenderedRef = useRef(false);

  const handleTabChange = useCallback(
    async (next: Tab) => {
      if (next === 'preview' && !previewRenderedRef.current) {
        const [{ marked }, DOMPurify] = await Promise.all([import('marked'), import('dompurify')]);
        const raw = await marked(body);
        setPreviewHtml(DOMPurify.default.sanitize(raw));
        previewRenderedRef.current = true;
      } else if (next === 'write') {
        previewRenderedRef.current = false;
      }
      setTab(next);
    },
    [body],
  );

  const handleBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    previewRenderedRef.current = false;
  }, []);

  const bodyRemaining = BODY_MAX - body.length;

  return (
    <form action={formAction} noValidate>
      {/* Hidden fields */}
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="locale" value={locale} />

      {/* Form-level error */}
      {!state.ok && state.error && (
        <div
          role="alert"
          data-error="form"
          className="mb-[var(--spacing-4)] px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[color-mix(in_srgb,var(--color-text)_5%,var(--color-paper))] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[length:var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-[var(--spacing-6)]">
        {/* Title */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="post-title"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Title
          </Label>
          <Input
            id="post-title"
            name="title"
            type="text"
            required
            minLength={1}
            maxLength={TITLE_MAX}
            disabled={isPending}
            aria-label="Title"
          />
        </div>

        {/* Body with tab toggle */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          {/* Tab controls (JS-enhanced) */}
          <div className="flex items-center gap-0 border-b border-[var(--color-border)]">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'write'}
              aria-controls="post-body-write-panel"
              onClick={() => {
                void handleTabChange('write');
              }}
              className={[
                'font-mono text-[length:var(--text-mono)] uppercase tracking-wider px-[var(--spacing-4)] py-[var(--spacing-2)] border-b-2 transition-colors',
                tab === 'write'
                  ? 'border-[var(--color-text)] text-[var(--color-text)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              Write
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'preview'}
              aria-controls="post-body-preview-panel"
              aria-label="Preview"
              onClick={() => {
                void handleTabChange('preview');
              }}
              className={[
                'font-mono text-[length:var(--text-mono)] uppercase tracking-wider px-[var(--spacing-4)] py-[var(--spacing-2)] border-b-2 transition-colors',
                tab === 'preview'
                  ? 'border-[var(--color-text)] text-[var(--color-text)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              Preview
            </button>
          </div>

          {/* Write panel */}
          <div id="post-body-write-panel" role="tabpanel" hidden={tab !== 'write'}>
            <Label
              htmlFor="post-body"
              className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] mb-[var(--spacing-2)] block"
            >
              Body
            </Label>
            <textarea
              id="post-body"
              name="body"
              rows={16}
              maxLength={BODY_MAX}
              required
              disabled={isPending}
              value={body}
              onChange={handleBodyChange}
              aria-label="Body"
              className="flex w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[length:var(--text-body-sm)] text-[var(--color-text)] resize-y transition-colors placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Write your post in Markdown..."
            />
            <p className="mt-[var(--spacing-1)] text-[length:var(--text-mono)] font-mono text-[var(--color-text-muted)]">
              <span aria-live="polite" aria-label={`${bodyRemaining} characters remaining`}>
                {bodyRemaining}
              </span>{' '}
              remaining
            </p>
          </div>

          {/* Preview panel */}
          <div id="post-body-preview-panel" role="tabpanel" hidden={tab !== 'preview'}>
            <noscript>
              <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] italic">
                JavaScript is required for the rendered preview. Your markdown will be rendered when
                you submit.
              </p>
            </noscript>
            {tab === 'preview' && <PreviewPane html={previewHtml} />}
          </div>
        </div>

        {/* SDG multi-select */}
        <div className="flex flex-col gap-[var(--spacing-3)]">
          <div className="flex flex-col gap-[var(--spacing-1)]">
            <span className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]">
              Sustainable Development Goals
            </span>
            <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
              Select the SDGs this post addresses. Mark one as primary.
            </p>
          </div>
          <SdgMultiSelect
            namePrefix="sdg"
            disabled={isPending}
            defaultSelectedIds={
              groupSdgIds.filter((id): id is SdgId => id >= 1 && id <= 17) as SdgId[]
            }
            defaultPrimaryId={
              groupPrimarySdgId !== null &&
              groupPrimarySdgId !== undefined &&
              groupPrimarySdgId >= 1 &&
              groupPrimarySdgId <= 17
                ? (groupPrimarySdgId as SdgId)
                : undefined
            }
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-[var(--spacing-4)] pt-[var(--spacing-2)]">
          <Button
            type="submit"
            disabled={isPending}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider"
          >
            {isPending ? 'Creating...' : 'Create post'}
          </Button>
          <a
            href={`/${locale}/g/${groupSlug}`}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors no-underline"
          >
            Cancel
          </a>
        </div>
      </div>
    </form>
  );
}
