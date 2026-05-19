// DeepL provider — managed, opt-in.
//
// Uses the DeepL REST API (v2). The @deepl/translator npm package is MIT-licensed
// but adds weight; we make direct fetch calls instead to stay lean and AGPL-clean.
// DeepL API docs: https://developers.deepl.com/docs/api-reference
//
// Required env vars:
//   DEEPL_API_KEY — DeepL API key (free or pro)

import { getDeepLApiKey, getTimeoutMs } from './env.ts';
import {
  TranslationRateLimited,
  TranslationTimeout,
  TranslationUnavailable,
  TranslationUnsupported,
} from './errors.ts';
import type { TranslationProvider } from './provider.ts';
import type { DetectedLanguage, TranslatedText } from './types.ts';

// DeepL free tier uses api-free.deepl.com; pro uses api.deepl.com.
// We auto-detect from the key suffix (:fx = free tier).
function getDeepLBaseUrl(apiKey: string): string {
  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com/v2' : 'https://api.deepl.com/v2';
}

// BCP-47 tags supported by DeepL (target languages as of 2025).
// Source may be a subset; 'auto' is accepted as source.
const DEEPL_LANGUAGES = [
  'ar',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'fi',
  'fr',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'lt',
  'lv',
  'nb',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'tr',
  'uk',
  'zh',
];

// DeepL uses region-tagged locales for some targets (en-US, pt-BR etc.).
// For translation targets we canonicalize using simple BCP-47 tags.
function toDeepLLocale(locale: string): string {
  const map: Record<string, string> = {
    en: 'EN-US',
    pt: 'PT-BR',
    zh: 'ZH-HANS',
  };
  return map[locale] ?? locale.toUpperCase();
}

interface DeepLTranslation {
  detected_source_language: string;
  text: string;
}

interface DeepLTranslateResponse {
  translations: DeepLTranslation[];
}

interface DeepLLanguageEntry {
  language: string;
  name: string;
  supports_formality?: boolean;
}

async function deeplFetch<T>(
  method: 'GET' | 'POST',
  url: string,
  apiKey: string,
  body?: URLSearchParams,
  timeoutMs?: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = timeoutMs !== undefined ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res: Response;
  try {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      signal: controller.signal,
    };
    if (body) init.body = body.toString();
    res = await fetch(url, init);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TranslationTimeout(`DeepL request timed out after ${timeoutMs ?? 0}ms`, err);
    }
    throw new TranslationUnavailable(
      `DeepL connection failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  } finally {
    if (timer !== null) clearTimeout(timer);
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '0');
    throw new TranslationRateLimited(
      'DeepL rate limit exceeded',
      Number.isNaN(retryAfter) ? 0 : retryAfter,
    );
  }

  if (res.status === 456) {
    throw new TranslationRateLimited('DeepL quota exceeded', 3600);
  }

  if (res.status === 400 || res.status === 422) {
    const text = await res.text();
    throw new TranslationUnsupported(`DeepL rejected request (${res.status}): ${text}`);
  }

  if (!res.ok) {
    throw new TranslationUnavailable(`DeepL responded with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export class DeepLProvider implements TranslationProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(apiKey?: string, timeoutMs?: number) {
    this.apiKey = apiKey ?? getDeepLApiKey();
    this.baseUrl = getDeepLBaseUrl(this.apiKey);
    this.timeoutMs = timeoutMs ?? getTimeoutMs();
  }

  async translate(text: string, from: string, to: string): Promise<TranslatedText> {
    const params = new URLSearchParams({
      text,
      source_lang: from.toUpperCase(),
      target_lang: toDeepLLocale(to),
    });

    const response = await deeplFetch<DeepLTranslateResponse>(
      'POST',
      `${this.baseUrl}/translate`,
      this.apiKey,
      params,
      this.timeoutMs,
    );

    const translation = response.translations[0];
    if (!translation) {
      throw new TranslationUnavailable('DeepL returned no translations');
    }

    return {
      text: translation.text,
      from: translation.detected_source_language.toLowerCase(),
      to,
      provider: 'deepl',
    };
  }

  async detectLanguage(text: string): Promise<DetectedLanguage> {
    // DeepL doesn't have a dedicated detect endpoint; translate to English with
    // source_lang=auto and use detected_source_language from the response.
    const params = new URLSearchParams({
      text,
      target_lang: 'EN-US',
    });

    const response = await deeplFetch<DeepLTranslateResponse>(
      'POST',
      `${this.baseUrl}/translate`,
      this.apiKey,
      params,
      this.timeoutMs,
    );

    const translation = response.translations[0];
    if (!translation) {
      throw new TranslationUnavailable('DeepL returned no translations during language detection');
    }

    return { locale: translation.detected_source_language.toLowerCase() };
  }

  async fetchSupportedLanguages(): Promise<string[]> {
    const langs = await deeplFetch<DeepLLanguageEntry[]>(
      'GET',
      `${this.baseUrl}/languages`,
      this.apiKey,
      undefined,
      this.timeoutMs,
    );
    return langs.map((l) => l.language.toLowerCase().split('-')[0] ?? l.language.toLowerCase());
  }

  supportedLanguages(): string[] {
    return DEEPL_LANGUAGES;
  }
}
