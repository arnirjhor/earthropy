'use client';

import { Button, Input, Label } from '@repo/design-system/components/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { resetPasswordAction } from '../../_actions/auth.ts';

interface ResetPasswordFormProps {
  token: string;
  locale: string;
}

export function ResetPasswordForm({ token, locale: _locale }: ResetPasswordFormProps) {
  const t = useTranslations('Auth');
  const [state, formAction, isPending] = useActionState(resetPasswordAction, {
    ok: false,
    errors: {},
  });

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="token" value={token} />

      {state.errors?.form && (
        <div
          role="alert"
          data-error="form"
          className="mb-[var(--spacing-4)] px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[color-mix(in_srgb,var(--color-text)_5%,var(--color-paper))] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
        >
          {state.errors.form}
        </div>
      )}

      <div className="flex flex-col gap-[var(--spacing-4)]">
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="reset-password"
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('resetPassword.newPassword')}
          </Label>
          <Input
            id="reset-password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            aria-describedby={state.errors?.password ? 'reset-password-error' : undefined}
            aria-invalid={!!state.errors?.password}
            className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
          />
          {state.errors?.password && (
            <p
              id="reset-password-error"
              role="alert"
              className="text-[var(--text-body-sm)] text-[var(--color-text)]"
            >
              {state.errors.password}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full font-mono text-[var(--text-mono)] uppercase tracking-wider mt-[var(--spacing-2)]"
        >
          {isPending ? t('resetPassword.submitting') : t('resetPassword.submit')}
        </Button>
      </div>
    </form>
  );
}
