// LibreTranslate provider — self-host default.
//
// LibreTranslate is AGPL-3.0; the HTTP client here is our own code (AGPL-3.0).
// API docs: https://libretranslate.com/docs/
//
// Required env vars:
//   LIBRETRANSLATE_URL        — base URL, e.g. http://localhost:5000
//   LIBRETRANSLATE_API_KEY    — optional; required if the instance enforces auth

import { getLibreTranslateApiKey, getLibreTranslateUrl, getTimeoutMs } from './env.ts';
import {
  TranslationRateLimited,
  TranslationTimeout,
  TranslationUnavailable,
  TranslationUnsupported,
} from './errors.ts';
import type { TranslationProvider } from './provider.ts';
import type { DetectedLanguage, TranslatedText } from './types.ts';

// BCP-47 codes LibreTranslate supports by default (the standard open model set).
// In practice the instance's /languages endpoint is authoritative; this list is
// used as a static fallback so we don't need a network call at import time.
const LIBRETRANSLATE_LANGUAGES = [
  'en',
  'ar',
  'az',
  'bg',
  'bn',
  'ca',
  'cs',
  'da',
  'de',
  'el',
  'eo',
  'es',
  'et',
  'eu',
  'fa',
  'fi',
  'fr',
  'ga',
  'gl',
  'gu',
  'he',
  'hi',
  'hr',
  'hu',
  'hy',
  'id',
  'is',
  'it',
  'ja',
  'ka',
  'ko',
  'lt',
  'lv',
  'mk',
  'ml',
  'mr',
  'ms',
  'mt',
  'nb',
  'nl',
  'pa',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sq',
  'sr',
  'sv',
  'sw',
  'ta',
  'te',
  'th',
  'tl',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh',
  'zt',
];

interface LibreTranslateTranslateResponse {
  translatedText: string;
}

interface LibreTranslateDetectEntry {
  language: string;
  confidence: number;
}

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TranslationTimeout(`LibreTranslate request timed out after ${timeoutMs}ms`, err);
    }
    throw new TranslationUnavailable(
      `LibreTranslate connection failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '0');
    throw new TranslationRateLimited(
      'LibreTranslate rate limit exceeded',
      Number.isNaN(retryAfter) ? 0 : retryAfter,
    );
  }

  if (res.status === 400) {
    const body = await res.text();
    throw new TranslationUnsupported(`LibreTranslate rejected request (400): ${body}`);
  }

  if (!res.ok) {
    throw new TranslationUnavailable(`LibreTranslate responded with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export class LibreTranslateProvider implements TranslationProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(baseUrl?: string, apiKey?: string, timeoutMs?: number) {
    this.baseUrl = baseUrl ?? getLibreTranslateUrl();
    this.apiKey = apiKey ?? getLibreTranslateApiKey();
    this.timeoutMs = timeoutMs ?? getTimeoutMs();
  }

  async translate(text: string, from: string, to: string): Promise<TranslatedText> {
    const payload: Record<string, string> = {
      q: text,
      source: from,
      target: to,
      format: 'text',
    };
    if (this.apiKey) payload.api_key = this.apiKey;

    const response = await postJson<LibreTranslateTranslateResponse>(
      `${this.baseUrl}/translate`,
      payload,
      this.timeoutMs,
    );

    return {
      text: response.translatedText,
      from,
      to,
      provider: 'libretranslate',
    };
  }

  async detectLanguage(text: string): Promise<DetectedLanguage> {
    const payload: Record<string, string> = { q: text };
    if (this.apiKey) payload.api_key = this.apiKey;

    const response = await postJson<LibreTranslateDetectEntry[]>(
      `${this.baseUrl}/detect`,
      payload,
      this.timeoutMs,
    );

    const best = response[0];
    if (!best) {
      throw new TranslationUnavailable('LibreTranslate /detect returned an empty array');
    }

    return { locale: best.language, confidence: best.confidence };
  }

  supportedLanguages(): string[] {
    return LIBRETRANSLATE_LANGUAGES;
  }
}
