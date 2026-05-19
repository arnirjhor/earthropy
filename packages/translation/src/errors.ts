// Typed provider errors for the translation package.
// Mirror the pattern used in packages/moderation/src/errors.ts.

export class TranslationUnavailable extends Error {
  override readonly name = 'TranslationUnavailable';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class TranslationTimeout extends Error {
  override readonly name = 'TranslationTimeout';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class TranslationRateLimited extends Error {
  override readonly name = 'TranslationRateLimited';
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class TranslationUnsupported extends Error {
  override readonly name = 'TranslationUnsupported';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}
