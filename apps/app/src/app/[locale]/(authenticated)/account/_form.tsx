'use client';

/**
 * Profile form — display name, handle, locale.
 * Client component; wraps three separate Server Actions each with its own form.
 */

import { Button, Input, Label } from '@repo/design-system/components/ui';
import { LOCALES, LOCALE_NAMES } from '@repo/i18n/locales';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import type { ProfileActionState } from './_actions/profile.ts';
import {
  updateDisplayNameAction,
  updateHandleAction,
  updateLocaleAction,
} from './_actions/profile.ts';

interface ProfileFormProps {
  displayName: string;
  handle: string;
  locale: string;
}

const initialState: ProfileActionState = { ok: false, errors: {} };

export function ProfileForm({ displayName, handle, locale }: ProfileFormProps) {
  const t = useTranslations('Auth.account');

  const [nameState, nameAction, namePending] = useActionState(
    updateDisplayNameAction,
    initialState,
  );
  const [handleState, handleAction, handlePending] = useActionState(
    updateHandleAction,
    initialState,
  );
  const [localeState, localeAction, localePending] = useActionState(
    updateLocaleAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-[var(--spacing-8)]">
      {/* Display name */}
      <form action={nameAction} className="flex flex-col gap-[var(--spacing-4)]">
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="displayName"
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('profile.displayName')}
          </Label>
          <Input
            id="displayName"
            name="displayName"
            type="text"
            defaultValue={displayName}
            required
            aria-describedby={nameState.errors?.displayName ? 'displayName-error' : undefined}
            aria-invalid={!!nameState.errors?.displayName}
            className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
          />
          {nameState.errors?.displayName && (
            <p
              id="displayName-error"
              role="alert"
              className="text-[var(--text-body-sm)] text-[var(--color-destructive)]"
            >
              {nameState.errors.displayName}
            </p>
          )}
          {nameState.ok && (
            <p className="text-[var(--text-body-sm)] text-[var(--color-text-muted)]">
              {t('profile.saved')}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={namePending}
          className="self-start font-mono text-[var(--text-mono)] uppercase tracking-wider"
        >
          {namePending ? t('profile.saving') : t('profile.save')}
        </Button>
      </form>

      <hr className="border-0 border-t border-[var(--color-border)]" />

      {/* Handle */}
      <form action={handleAction} className="flex flex-col gap-[var(--spacing-4)]">
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="handle"
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('profile.handle')}
          </Label>
          <Input
            id="handle"
            name="handle"
            type="text"
            defaultValue={handle}
            required
            aria-describedby={handleState.errors?.handle ? 'handle-error' : undefined}
            aria-invalid={!!handleState.errors?.handle}
            className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] font-mono"
          />
          {handleState.errors?.handle && (
            <p
              id="handle-error"
              role="alert"
              className="text-[var(--text-body-sm)] text-[var(--color-destructive)]"
            >
              {handleState.errors.handle}
            </p>
          )}
          {handleState.ok && (
            <p className="text-[var(--text-body-sm)] text-[var(--color-text-muted)]">
              {t('profile.saved')}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={handlePending}
          className="self-start font-mono text-[var(--text-mono)] uppercase tracking-wider"
        >
          {handlePending ? t('profile.saving') : t('profile.save')}
        </Button>
      </form>

      <hr className="border-0 border-t border-[var(--color-border)]" />

      {/* Locale */}
      <form action={localeAction} className="flex flex-col gap-[var(--spacing-4)]">
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="locale"
            className="font-mono text-[var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('profile.locale')}
          </Label>
          <select
            id="locale"
            name="locale"
            defaultValue={locale}
            aria-describedby={localeState.errors?.locale ? 'locale-error' : undefined}
            aria-invalid={!!localeState.errors?.locale}
            className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--text-body)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:ring-offset-1"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </select>
          {localeState.errors?.locale && (
            <p
              id="locale-error"
              role="alert"
              className="text-[var(--text-body-sm)] text-[var(--color-destructive)]"
            >
              {localeState.errors.locale}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={localePending}
          className="self-start font-mono text-[var(--text-mono)] uppercase tracking-wider"
        >
          {localePending ? t('profile.saving') : t('profile.save')}
        </Button>
      </form>
    </div>
  );
}
