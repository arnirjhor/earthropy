// The translation contract. New providers implement TranslationProvider; the
// rest of Earthropy depends only on this interface. Self-hosters can swap
// providers via the TRANSLATION_PROVIDER env var without code changes.
//
// Default: LibreTranslate (self-hostable, AGPL-3.0).
// Opt-in:  DeepL (managed, MIT client, proprietary API).

import type { DetectedLanguage, TranslatedText } from './types.ts';

export interface TranslationProvider {
  /**
   * Translate `text` from `from` locale to `to` locale.
   * Both locales are BCP-47 tags (e.g. 'en', 'fr').
   */
  translate(text: string, from: string, to: string): Promise<TranslatedText>;

  /**
   * Detect the language of `text`.
   * Returns a BCP-47 tag + optional confidence.
   */
  detectLanguage(text: string): Promise<DetectedLanguage>;

  /**
   * The list of BCP-47 locale codes this provider can translate to/from.
   */
  supportedLanguages(): string[];
}
