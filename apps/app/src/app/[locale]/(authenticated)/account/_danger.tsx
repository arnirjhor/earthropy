'use client';

/**
 * Danger zone: delete account.
 * Requires re-entering email as confirmation (auth.md §2 disabled state).
 */

import { Button, Input, Label } from '@repo/design-system/components/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import type { AccountActionState } from './_actions/account.ts';
import { deleteAccountAction } from './_actions/account.ts';

const initialState: AccountActionState = { ok: false, errors: {} };

export function DangerZone() {
  const t = useTranslations('Auth.account.danger');
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialState);

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--sdg-1)] p-[var(--spacing-6)]">
      <p className="mb-[var(--spacing-4)] text-[var(--text-body)] leading-[var(--text-body--line-height)] text-[var(--color-text-muted)]">
        {t('description')}
      </p>

      <form action={formAction} className="flex flex-col gap-[var(--spacing-4)]">
        {state.errors?.form && (
          <div
            role="alert"
            className="px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[color-mix(in_srgb,var(--sdg-1)_10%,var(--color-paper))] border border-[var(--sdg-1)] rounded-[var(--radius-sm)] text-[var(--text-body-sm)] text-[var(--color-text)]"
          >
            {state.errors.form}
          </div>
        )}

        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="delete-email"
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('confirm')}
          </Label>
          <Input
            id="delete-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-describedby={state.errors?.email ? 'delete-email-error' : undefined}
            aria-invalid={!!state.errors?.email}
            className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
            placeholder={t('email')}
          />
          {state.errors?.email && (
            <p
              id="delete-email-error"
              role="alert"
              className="text-[var(--text-body-sm)] text-[var(--color-destructive)]"
            >
              {state.errors.email}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="destructive"
          disabled={pending}
          className="self-start font-mono text-[var(--text-mono)] uppercase tracking-wider"
        >
          {pending ? t('submitting') : t('submit')}
        </Button>
      </form>
    </div>
  );
}
