'use client';

import { Button } from '@repo/design-system/components/ui';
import { Input } from '@repo/design-system/components/ui';
import { Label } from '@repo/design-system/components/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { signUpAction } from '../_actions/auth.ts';

interface SignUpFormProps {
  locale: string;
}

export function SignUpForm({ locale: _locale }: SignUpFormProps) {
  const t = useTranslations('Auth');
  const [state, formAction, isPending] = useActionState(signUpAction, { ok: false, errors: {} });

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
            htmlFor="signup-email"
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('fields.email')}
          </Label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-describedby={state.errors?.email ? 'signup-email-error' : undefined}
            aria-invalid={!!state.errors?.email}
            className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
          />
          {state.errors?.email && (
            <p
              id="signup-email-error"
              role="alert"
              className="text-[var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
            >
              {state.errors.email}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="signup-handle"
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('fields.handle')}
          </Label>
          <Input
            id="signup-handle"
            name="handle"
            type="text"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9-]+"
            autoComplete="username"
            aria-describedby={state.errors?.handle ? 'signup-handle-error' : undefined}
            aria-invalid={!!state.errors?.handle}
            className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
          />
          {state.errors?.handle && (
            <p
              id="signup-handle-error"
              role="alert"
              className="text-[var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
            >
              {state.errors.handle}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="signup-password"
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('fields.password')}
          </Label>
          <Input
            id="signup-password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            aria-describedby={state.errors?.password ? 'signup-password-error' : undefined}
            aria-invalid={!!state.errors?.password}
            className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
          />
          {state.errors?.password && (
            <p
              id="signup-password-error"
              role="alert"
              className="text-[var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
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
          {isPending ? t('signup.submitting') : t('signup.submit')}
        </Button>
      </div>
    </form>
  );
}
