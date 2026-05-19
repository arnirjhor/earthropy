// Environment variable helpers for the translation package.
//
// TRANSLATION_PROVIDER=libretranslate|deepl  (default: libretranslate)
// LIBRETRANSLATE_URL — URL of the LibreTranslate instance (required for libretranslate)
// LIBRETRANSLATE_API_KEY — optional API key for LibreTranslate instances that require it
// DEEPL_API_KEY — required when TRANSLATION_PROVIDER=deepl
// TRANSLATION_TIMEOUT_MS — request timeout (default: 10 000)

export type TranslationProviderName = 'libretranslate' | 'deepl';

export function getProviderName(): TranslationProviderName {
  const raw = process.env.TRANSLATION_PROVIDER ?? 'libretranslate';
  if (raw === 'deepl') return 'deepl';
  return 'libretranslate';
}

export function getLibreTranslateUrl(): string {
  const url = process.env.LIBRETRANSLATE_URL;
  if (!url) {
    throw new Error(
      'LIBRETRANSLATE_URL is required when TRANSLATION_PROVIDER=libretranslate. ' +
        'Set it to your LibreTranslate instance URL (e.g. http://localhost:5000).',
    );
  }
  return url.replace(/\/$/, '');
}

export function getLibreTranslateApiKey(): string {
  return process.env.LIBRETRANSLATE_API_KEY ?? '';
}

export function getDeepLApiKey(): string {
  const key = process.env.DEEPL_API_KEY;
  if (!key) {
    throw new Error('DEEPL_API_KEY is required when TRANSLATION_PROVIDER=deepl.');
  }
  return key;
}

export function getTimeoutMs(): number {
  const raw = process.env.TRANSLATION_TIMEOUT_MS;
  if (raw) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 10_000;
}
