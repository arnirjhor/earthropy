/**
 * Slug generation utilities.
 *
 * toSlug(name)  — pure, deterministic: kebab-case with ASCII fold for non-Latin.
 * withCollisionSuffix(slug, exists) — appends -2, -3, … until exists() returns false.
 */

const MAX_SLUG_LENGTH = 80;
const FALLBACK = 'group';

/**
 * Minimal transliteration map for common non-Latin scripts.
 * Full i18n transliteration is out of scope for v0.1; this covers the most
 * common cases (Arabic, Persian, etc.) via Unicode normalization + strip.
 */
function asciiTransliterate(input: string): string {
  // Normalize to NFD (decompose accented characters), then strip Unicode
  // combining marks (category M) and any remaining non-ASCII characters.
  // This converts é→e, ü→u, ñ→n, etc. Non-Latin scripts that have no
  // ASCII decomposition are dropped; the slug generator falls back to 'group'
  // if the result would be empty.
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip combining marks (diacritics)
    .replace(/[^ -~]/g, ''); // drop remaining non-ASCII printable
}

/**
 * Derive a URL-safe kebab-case slug from a group name.
 *
 * 1. ASCII-fold: NFD normalization + strip combining marks + drop remaining non-ASCII.
 * 2. Lowercase.
 * 3. Replace non-alphanumeric runs with a single hyphen.
 * 4. Strip leading/trailing hyphens.
 * 5. Truncate to MAX_SLUG_LENGTH, stripping trailing hyphen.
 * 6. Fall back to 'group' if empty.
 */
export function toSlug(name: string): string {
  let s = asciiTransliterate(name.trim());
  s = s.toLowerCase();
  // Remove apostrophes/quotes before hyphenation so "women's" → "womens" not "women-s"
  s = s.replace(/['''`"]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/^-+|-+$/g, '');

  if (s.length > MAX_SLUG_LENGTH) {
    s = s.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
  }

  return s.length > 0 ? s : FALLBACK;
}

/**
 * Append a numeric suffix (-2, -3, …) to `slug` until `exists` returns false.
 * The base slug is checked first (no suffix); only if taken does it try -2 onwards.
 */
export async function withCollisionSuffix(
  slug: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(slug))) return slug;

  let n = 2;
  while (true) {
    const candidate = `${slug}-${n}`;
    if (!(await exists(candidate))) return candidate;
    n++;
  }
}
