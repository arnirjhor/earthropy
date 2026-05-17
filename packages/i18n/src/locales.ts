// v0.1 ships catalogs for 9 locales spanning the top languages by speaker count
// + working languages of the UN. Community-completed; English is the source of truth.
export const LOCALES = [
  'en', // English
  'es', // Spanish
  'fr', // French
  'ar', // Arabic — RTL
  'zh', // Chinese (Simplified)
  'hi', // Hindi
  'pt', // Portuguese
  'ru', // Russian
  'sw', // Swahili
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const RTL_LOCALES: readonly Locale[] = ['ar'];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function direction(locale: Locale): 'ltr' | 'rtl' {
  return (RTL_LOCALES as readonly string[]).includes(locale) ? 'rtl' : 'ltr';
}

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ar: 'العربية',
  zh: '中文',
  hi: 'हिन्दी',
  pt: 'Português',
  ru: 'Русский',
  sw: 'Kiswahili',
};
