'use client';

import { Button } from '@repo/design-system/components/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { verifyEmailAction } from '../../_actions/auth.ts';

interface VerifyEmailFormProps {
  token: string;
  locale: string;
}

export function VerifyEmailForm({ token, locale: _locale }: VerifyEmailFormProps) {
  const t = useTranslations('Auth');
  const [state, formAction, isPending] = useActionState(verifyEmailAction, {
    ok: false,
    errors: {},
  });

  return (
    <form action={formAction}>
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

      <Button
        type="submit"
        disabled={isPending}
        className="w-full font-mono text-[var(--text-mono)] uppercase tracking-wider"
      >
        {isPending ? t('verifyEmail.submitting') : t('verifyEmail.submit')}
      </Button>
    </form>
  );
}
