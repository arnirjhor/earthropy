'use client';

import { Button, Input, Label } from '@repo/design-system/components/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { forgotPasswordAction } from '../_actions/auth.ts';

interface ForgotPasswordFormProps {
  locale: string;
}

export function ForgotPasswordForm({ locale: _locale }: ForgotPasswordFormProps) {
  const t = useTranslations('Auth');
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, {
    ok: false,
    errors: {},
  });

  return (
    <form action={formAction} noValidate>
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
            htmlFor="forgot-email"
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('fields.email')}
          </Label>
          <Input
            id="forgot-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-describedby={state.errors?.email ? 'forgot-email-error' : undefined}
            aria-invalid={!!state.errors?.email}
            className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
          />
          {state.errors?.email && (
            <p
              id="forgot-email-error"
              role="alert"
              className="text-[var(--text-body-sm)] text-[var(--color-text)]"
            >
              {state.errors.email}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full font-mono text-[var(--text-mono)] uppercase tracking-wider mt-[var(--spacing-2)]"
        >
          {isPending ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
        </Button>
      </div>
    </form>
  );
}
