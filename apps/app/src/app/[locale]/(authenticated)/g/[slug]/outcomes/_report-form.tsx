'use client';

import { Button } from '@repo/design-system/components/ui';
import { Input } from '@repo/design-system/components/ui';
import { Label } from '@repo/design-system/components/ui';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { reportOutcomeAction } from './_actions.ts';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface IndicatorOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  readonly description: string;
}

export interface ReportOutcomeFormProps {
  readonly groupId: string;
  readonly indicators: readonly IndicatorOption[];
  readonly locale?: string;
  readonly groupSlug?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportOutcomeForm({
  groupId,
  indicators,
  locale,
  groupSlug,
}: ReportOutcomeFormProps) {
  const router = useRouter();
  const initialState = { ok: false as const, error: '' };

  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData): Promise<typeof initialState> => {
      const result = await reportOutcomeAction(formData);
      if (!result.ok) return result as typeof initialState;
      if (locale && groupSlug) {
        router.refresh();
      }
      return initialState;
    },
    initialState,
  );

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="reportedAt" value={new Date().toISOString()} />

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

      <div className="flex flex-col gap-[var(--spacing-5)]">
        {/* Indicator select */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="outcome-indicator"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Indicator
          </Label>
          <select
            id="outcome-indicator"
            name="indicatorId"
            required
            disabled={isPending}
            aria-label="Indicator"
            className="flex w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[length:var(--text-body-sm)] text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select an indicator…</option>
            {indicators.map((ind) => (
              <option key={ind.id} value={ind.id}>
                {ind.code} — {ind.name} ({ind.unit})
              </option>
            ))}
          </select>
        </div>

        {/* Value */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="outcome-value"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Value
          </Label>
          <Input
            id="outcome-value"
            name="value"
            type="number"
            step="any"
            required
            disabled={isPending}
            aria-label="Value"
            placeholder="e.g. 42.5"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="outcome-description"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Description
          </Label>
          <textarea
            id="outcome-description"
            name="description"
            rows={4}
            maxLength={2000}
            required
            disabled={isPending}
            aria-label="Description"
            placeholder="Describe what was achieved and how the value was measured…"
            className="flex w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[length:var(--text-body-sm)] text-[var(--color-text)] resize-y transition-colors placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Evidence URL (optional) */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="outcome-evidence"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Evidence URL
            <span className="ml-[var(--spacing-2)] text-[var(--color-text-muted)] normal-case tracking-normal font-sans text-[length:var(--text-body-sm)]">
              (optional)
            </span>
          </Label>
          <Input
            id="outcome-evidence"
            name="evidenceUrl"
            type="url"
            disabled={isPending}
            aria-label="Evidence URL"
            placeholder="https://example.org/report.pdf"
          />
          <p className="text-[length:var(--text-mono)] font-mono text-[var(--color-text-muted)]">
            Link to an external source supporting this outcome (report, article, photo, etc.)
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-[var(--spacing-4)] pt-[var(--spacing-2)]">
          <Button
            type="submit"
            disabled={isPending}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider"
          >
            {isPending ? 'Reporting…' : 'Report outcome'}
          </Button>
        </div>
      </div>
    </form>
  );
}
