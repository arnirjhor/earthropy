'use client';

import { SdgMultiSelect } from '@repo/design-system/components/SdgMultiSelect';
import { Button } from '@repo/design-system/components/ui';
import { Input } from '@repo/design-system/components/ui';
import { Label } from '@repo/design-system/components/ui';
import { LOCALES, LOCALE_NAMES } from '@repo/i18n/locales';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { createGroupAction } from '../_actions.ts';

/** Client-side slug derivation matching the server's toSlug logic (simplified). */
function deriveSlug(name: string): string {
  let s = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^ -~]/g, '');
  s = s.toLowerCase();
  s = s.replace(/['''`"]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  if (s.length > 80) s = s.slice(0, 80).replace(/-+$/, '');
  return s.length > 0 ? s : 'group';
}

export function CreateGroupForm({ locale }: { locale: string }) {
  const t = useTranslations('GroupCreate');

  const initialState = { ok: false as const, error: '' };
  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await createGroupAction(formData);
      if (!result.ok) return result as typeof initialState;
      return initialState;
    },
    initialState,
  );

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (slugManuallyEdited) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSlug(deriveSlug(name));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, slugManuallyEdited]);

  return (
    <form action={formAction} noValidate>
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
        {/* Name */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="group-name"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('fields.name')}
          </Label>
          <Input
            id="group-name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            disabled={isPending}
          />
        </div>

        {/* Slug */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="group-slug"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('fields.slug')}
          </Label>
          <Input
            id="group-slug"
            name="slug"
            type="text"
            maxLength={80}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManuallyEdited(true);
            }}
            disabled={isPending}
            className="font-mono"
          />
          <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
            {t('fields.slugHint')}
          </p>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="group-description"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('fields.description')}
          </Label>
          <textarea
            id="group-description"
            name="description"
            rows={4}
            maxLength={2000}
            disabled={isPending}
            className="flex w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-sans text-[length:var(--text-body-sm)] text-[var(--color-text)] resize-y transition-colors placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Visibility */}
        <fieldset className="border-0 p-0 m-0">
          <legend className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] mb-[var(--spacing-3)]">
            {t('fields.visibility')}
          </legend>
          <div className="flex flex-col gap-[var(--spacing-3)]">
            {(
              [
                ['public', t('fields.visibilityPublic'), t('fields.visibilityPublicHint')],
                ['listed', t('fields.visibilityListed'), t('fields.visibilityListedHint')],
                ['private', t('fields.visibilityPrivate'), t('fields.visibilityPrivateHint')],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="flex items-start gap-[var(--spacing-3)] cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value={value}
                  defaultChecked={value === 'public'}
                  disabled={isPending}
                  className="mt-[2px] h-4 w-4 border-[var(--color-border)] accent-[var(--color-text)]"
                />
                <span className="flex flex-col gap-[var(--spacing-0-5)]">
                  <span className="font-mono text-[length:var(--text-mono)] text-[var(--color-text)]">
                    {label}
                  </span>
                  <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
                    {hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Preferred locale */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="group-locale"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('fields.preferredLocale')}
          </Label>
          <select
            id="group-locale"
            name="preferredLocale"
            defaultValue={locale}
            disabled={isPending}
            className="flex h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-sans text-[length:var(--text-body-sm)] text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </select>
        </div>

        {/* Location (optional) */}
        <div className="flex flex-col gap-[var(--spacing-2)]">
          <Label
            htmlFor="group-location"
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {t('fields.locationText')}
          </Label>
          <Input
            id="group-location"
            name="locationText"
            type="text"
            maxLength={200}
            placeholder={t('fields.locationTextPlaceholder')}
            disabled={isPending}
          />
        </div>

        {/* SDG multi-select */}
        <div className="flex flex-col gap-[var(--spacing-3)]">
          <div className="flex flex-col gap-[var(--spacing-1)]">
            <span className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('fields.sdgs')}
            </span>
            <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] leading-[var(--text-body-sm--line-height)]">
              {t('fields.sdgsHint')}
            </p>
          </div>
          <SdgMultiSelect namePrefix="sdg" disabled={isPending} />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-[var(--spacing-4)] pt-[var(--spacing-2)]">
          <Button
            type="submit"
            disabled={isPending}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider"
          >
            {isPending ? t('submitting') : t('submit')}
          </Button>
          <a
            href={`/${locale}/dashboard`}
            className="font-mono text-[length:var(--text-mono)] uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors no-underline"
          >
            {t('cancel')}
          </a>
        </div>
      </div>
    </form>
  );
}
