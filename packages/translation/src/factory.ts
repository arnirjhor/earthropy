// Provider factory — creates the correct TranslationProvider from env vars.

import { DeepLProvider } from './deepl.ts';
import { getProviderName } from './env.ts';
import { LibreTranslateProvider } from './libretranslate.ts';
import type { TranslationProvider } from './provider.ts';

export function createTranslationProvider(): TranslationProvider {
  const name = getProviderName();
  switch (name) {
    case 'deepl':
      return new DeepLProvider();
    case 'libretranslate':
      return new LibreTranslateProvider();
  }
}
