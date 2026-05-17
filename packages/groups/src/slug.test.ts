import { describe, expect, it } from 'vitest';
import { toSlug, withCollisionSuffix } from './slug.ts';

describe('toSlug', () => {
  it('lowercases and hyphenates ASCII words', () => {
    expect(toSlug('Climate Action Now')).toBe('climate-action-now');
  });

  it('strips leading and trailing whitespace', () => {
    expect(toSlug('  Oceans Group  ')).toBe('oceans-group');
  });

  it('collapses multiple spaces into a single hyphen', () => {
    expect(toSlug('Clean   Water  Group')).toBe('clean-water-group');
  });

  it('removes punctuation that is not alphanumeric', () => {
    expect(toSlug("Women's Rights!")).toBe('womens-rights');
  });

  it('ASCII-folds accented Latin characters', () => {
    expect(toSlug('Réduction des inégalités')).toBe('reduction-des-inegalites');
  });

  it('transliterates common non-Latin scripts to ASCII', () => {
    // Arabic "مناخ" (manakh / climate) should produce a non-empty ASCII slug
    const result = toSlug('مناخ');
    expect(result).toMatch(/^[a-z0-9-]+$/);
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back to a safe placeholder when the name is entirely non-representable', () => {
    // If all chars are stripped, we should still get a non-empty string
    const result = toSlug('!!!');
    expect(result).toBe('group');
  });

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(toSlug(long).length).toBeLessThanOrEqual(80);
  });

  it('does not end with a hyphen after truncation', () => {
    const long = `${'ab '.repeat(40)}xy`;
    const slug = toSlug(long);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('withCollisionSuffix', () => {
  it('returns the base slug when no collision', async () => {
    const result = await withCollisionSuffix('climate-action', async () => false);
    expect(result).toBe('climate-action');
  });

  it('appends -2 on first collision', async () => {
    const taken = new Set(['climate-action']);
    const result = await withCollisionSuffix('climate-action', async (s) => taken.has(s));
    expect(result).toBe('climate-action-2');
  });

  it('increments suffix until free slot found', async () => {
    const taken = new Set(['climate-action', 'climate-action-2', 'climate-action-3']);
    const result = await withCollisionSuffix('climate-action', async (s) => taken.has(s));
    expect(result).toBe('climate-action-4');
  });

  it('works with a slug that already ends in a number pattern', async () => {
    const taken = new Set(['oceans-2']);
    const result = await withCollisionSuffix('oceans-2', async (s) => taken.has(s));
    // Should append a new suffix to the full base 'oceans-2'
    expect(result).toBe('oceans-2-2');
  });
});
