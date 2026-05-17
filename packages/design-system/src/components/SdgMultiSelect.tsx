'use client';

import { SDGS } from '@repo/sdg';
import type { Sdg, SdgId } from '@repo/sdg';
import { useCallback, useState } from 'react';

export interface SdgMultiSelectProps {
  /** SDG list to render. Defaults to all 17 SDGs. */
  readonly sdgs?: readonly Sdg[];
  /** Prefix used for form-field names. Hidden inputs will use `primarySdgId` and `additionalSdgIds`. */
  readonly namePrefix?: string;
  /** Initially selected SDG ids. */
  readonly defaultSelectedIds?: SdgId[];
  /** Initially primary SDG id (must be in defaultSelectedIds if provided). */
  readonly defaultPrimaryId?: SdgId;
  /** Whether the field is disabled. */
  readonly disabled?: boolean;
}

/**
 * SDG multi-select with exactly-one-primary semantic.
 *
 * Server-renderable progressive-enhancement pattern:
 * - Non-JS: hidden inputs reflect initial state; browser submits those.
 * - JS: React manages state; hidden inputs are updated on each render.
 *
 * Form-data shape:
 *   primarySdgId     — single numeric string (the primary SDG)
 *   additionalSdgIds — JSON array string of non-primary selected SDG ids
 */
export function SdgMultiSelect({
  sdgs = SDGS,
  namePrefix: _namePrefix = 'sdg',
  defaultSelectedIds = [],
  defaultPrimaryId,
  disabled = false,
}: SdgMultiSelectProps) {
  const initialSelected = new Set<SdgId>(defaultSelectedIds);
  const initialPrimary: SdgId | null = defaultPrimaryId ?? defaultSelectedIds[0] ?? null;

  const [selected, setSelected] = useState<Set<SdgId>>(initialSelected);
  const [primaryId, setPrimaryId] = useState<SdgId | null>(initialPrimary);

  const toggleSdg = useCallback(
    (id: SdgId) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          // If we removed the primary, promote the first remaining
          if (id === primaryId) {
            const remaining = [...next];
            setPrimaryId(remaining[0] ?? null);
          }
        } else {
          next.add(id);
          // First selection becomes primary
          if (next.size === 1) {
            setPrimaryId(id);
          }
        }
        return next;
      });
    },
    [primaryId],
  );

  const makePrimary = useCallback((id: SdgId) => {
    setPrimaryId(id);
  }, []);

  const selectedArray = [...selected];
  const additionalIds = selectedArray.filter((id) => id !== primaryId);

  return (
    <fieldset
      className="border-0 p-0 m-0"
      aria-label="Sustainable Development Goals"
      disabled={disabled}
    >
      {/* Hidden inputs for form-data submission */}
      {primaryId !== null && <input type="hidden" name="primarySdgId" value={String(primaryId)} />}
      <input type="hidden" name="additionalSdgIds" value={JSON.stringify(additionalIds)} />

      <div className="flex flex-wrap gap-[var(--spacing-2)]">
        {sdgs.map((sdg) => {
          const isSelected = selected.has(sdg.id);
          const isPrimary = primaryId === sdg.id;

          return (
            <SdgChipToggle
              key={sdg.id}
              sdg={sdg}
              isSelected={isSelected}
              isPrimary={isPrimary}
              onToggle={toggleSdg}
              onMakePrimary={makePrimary}
              disabled={disabled}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

interface SdgChipToggleProps {
  readonly sdg: Sdg;
  readonly isSelected: boolean;
  readonly isPrimary: boolean;
  readonly onToggle: (id: SdgId) => void;
  readonly onMakePrimary: (id: SdgId) => void;
  readonly disabled: boolean;
}

function SdgChipToggle({
  sdg,
  isSelected,
  isPrimary,
  onToggle,
  onMakePrimary,
  disabled,
}: SdgChipToggleProps) {
  const sdgColor = `var(--sdg-${sdg.id})`;

  return (
    <div
      data-sdg-id={sdg.id}
      className="relative flex items-stretch"
      style={{
        borderRadius: 'var(--radius-xs)',
        border: isSelected ? `1px solid ${sdgColor}` : '1px solid var(--color-border)',
        transition: 'border-color 150ms var(--ease-out)',
        backgroundColor: isSelected
          ? `color-mix(in srgb, ${sdgColor} 8%, var(--color-surface))`
          : 'var(--color-surface)',
      }}
    >
      {/* Selection checkbox (toggle the SDG on/off) */}
      <label
        className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2)] py-[var(--spacing-1)] cursor-pointer select-none"
        aria-label={`SDG ${sdg.id}: ${sdg.name}`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={isSelected}
          onChange={() => {
            onToggle(sdg.id);
          }}
          disabled={disabled}
          aria-label={`SDG ${sdg.id}: ${sdg.name}`}
        />
        {/* SDG number in Plex Mono */}
        <span
          className="font-mono text-[0.75rem] tabular-nums leading-none"
          aria-hidden="true"
          style={{
            color: isSelected ? sdgColor : 'var(--color-text-muted)',
            fontWeight: isSelected ? 700 : 400,
          }}
        >
          {String(sdg.id).padStart(2, '0')}
        </span>
        {/* Short name in Plex Sans */}
        <span
          className="text-[0.8125rem] leading-none"
          aria-hidden="true"
          style={{
            color: isSelected ? 'var(--color-text)' : 'var(--color-text-muted)',
          }}
        >
          {sdg.shortName}
        </span>
        {/* Left-edge SDG color stripe */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 start-0 w-1 rounded-ss-[var(--radius-xs)] rounded-es-[var(--radius-xs)]"
          style={{ backgroundColor: isSelected ? sdgColor : 'transparent' }}
        />
      </label>

      {/* Primary radio — only visible when chip is selected */}
      {isSelected && (
        <label
          className="flex items-center px-[var(--spacing-1)] border-s border-[var(--color-border)] cursor-pointer"
          title={`Set SDG ${sdg.id} as primary`}
          aria-label={`Set as primary SDG ${sdg.id}: ${sdg.name}`}
        >
          <input
            type="radio"
            name="primarySdgId_radio"
            value={String(sdg.id)}
            checked={isPrimary}
            onChange={() => {
              onMakePrimary(sdg.id);
            }}
            disabled={disabled}
            aria-label={`primary SDG ${sdg.id}: ${sdg.name}`}
          />
        </label>
      )}
    </div>
  );
}
