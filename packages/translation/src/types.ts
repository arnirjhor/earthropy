// Types for the translation package.
// Canonical types used by the provider interface and cache layer.

export interface TranslationRequest {
  readonly text: string;
  readonly from: string;
  readonly to: string;
}

export interface TranslatedText {
  /** The translated text. */
  readonly text: string;
  /** Source locale (BCP-47). May be the detected language if auto-detected. */
  readonly from: string;
  /** Target locale (BCP-47). */
  readonly to: string;
  /** Provider identifier, e.g. 'libretranslate' | 'deepl'. */
  readonly provider: string;
}

export interface DetectedLanguage {
  /** BCP-47 language tag, e.g. 'en', 'fr'. */
  readonly locale: string;
  /** Confidence in [0, 1]; absent if provider doesn't supply it. */
  readonly confidence?: number;
}
