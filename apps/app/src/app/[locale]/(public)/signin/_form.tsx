'use client';

import {
  Button,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { magicLinkRequestAction, signInAction } from '../_actions/auth.ts';

interface SignInFormProps {
  locale: string;
}

export function SignInForm({ locale: _locale }: SignInFormProps) {
  const t = useTranslations('Auth');
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState(signInAction, {
    ok: false,
    errors: {},
  });
  const [magicState, magicFormAction, isMagicPending] = useActionState(magicLinkRequestAction, {
    ok: false,
    errors: {},
  });

  return (
    <Tabs defaultValue="password">
      <TabsList
        aria-label={t('signin.heading')}
        className="w-full mb-[var(--spacing-6)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-[var(--spacing-1)]"
      >
        <TabsTrigger
          value="password"
          data-value="password"
          className="flex-1 font-mono text-[var(--text-mono)] uppercase tracking-wider data-[state=active]:bg-[var(--color-paper)] data-[state=active]:text-[var(--color-text)] data-[state=inactive]:text-[var(--color-text-muted)]"
        >
          {t('signin.tabs.password')}
        </TabsTrigger>
        <TabsTrigger
          value="magic"
          data-value="magic"
          className="flex-1 font-mono text-[var(--text-mono)] uppercase tracking-wider data-[state=active]:bg-[var(--color-paper)] data-[state=active]:text-[var(--color-text)] data-[state=inactive]:text-[var(--color-text-muted)]"
        >
          {t('signin.tabs.magic')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="password">
        <form action={passwordFormAction} noValidate>
          {passwordState.errors?.form && (
            <div
              role="alert"
              data-error="form"
              className="mb-[var(--spacing-4)] px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[color-mix(in_srgb,var(--color-text)_5%,var(--color-paper))] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
            >
              {passwordState.errors.form}
            </div>
          )}

          <div className="flex flex-col gap-[var(--spacing-4)]">
            <div className="flex flex-col gap-[var(--spacing-2)]">
              <Label
                htmlFor="signin-email"
                className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                {t('fields.email')}
              </Label>
              <Input
                id="signin-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                aria-describedby={passwordState.errors?.email ? 'signin-email-error' : undefined}
                aria-invalid={!!passwordState.errors?.email}
                className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
              />
              {passwordState.errors?.email && (
                <p
                  id="signin-email-error"
                  role="alert"
                  className="text-[var(--text-body-sm)] text-[var(--color-text)]"
                >
                  {passwordState.errors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-[var(--spacing-2)]">
              <Label
                htmlFor="signin-password"
                className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                {t('fields.password')}
              </Label>
              <Input
                id="signin-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                aria-describedby={
                  passwordState.errors?.password ? 'signin-password-error' : undefined
                }
                aria-invalid={!!passwordState.errors?.password}
                className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
              />
              {passwordState.errors?.password && (
                <p
                  id="signin-password-error"
                  role="alert"
                  className="text-[var(--text-body-sm)] text-[var(--color-text)]"
                >
                  {passwordState.errors.password}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isPasswordPending}
              className="w-full font-mono text-[var(--text-mono)] uppercase tracking-wider mt-[var(--spacing-2)]"
            >
              {isPasswordPending ? t('signin.submitting') : t('signin.submit')}
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="magic">
        <form action={magicFormAction} noValidate>
          {magicState.errors?.form && (
            <div
              role="alert"
              data-error="form"
              className="mb-[var(--spacing-4)] px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[color-mix(in_srgb,var(--color-text)_5%,var(--color-paper))] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--text-body-sm)] text-[var(--color-text)] leading-[var(--text-body-sm--line-height)]"
            >
              {magicState.errors.form}
            </div>
          )}

          <div className="flex flex-col gap-[var(--spacing-4)]">
            <div className="flex flex-col gap-[var(--spacing-2)]">
              <Label
                htmlFor="magic-email"
                className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                {t('fields.email')}
              </Label>
              <Input
                id="magic-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                aria-describedby={magicState.errors?.email ? 'magic-email-error' : undefined}
                aria-invalid={!!magicState.errors?.email}
                className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
              />
              {magicState.errors?.email && (
                <p
                  id="magic-email-error"
                  role="alert"
                  className="text-[var(--text-body-sm)] text-[var(--color-text)]"
                >
                  {magicState.errors.email}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isMagicPending}
              className="w-full font-mono text-[var(--text-mono)] uppercase tracking-wider mt-[var(--spacing-2)]"
            >
              {isMagicPending ? t('signin.magic.submitting') : t('signin.magic.submit')}
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
}
