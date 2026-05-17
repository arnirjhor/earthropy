// Typed provider errors — stubs for tests. Real implementation lands in C-MOD-1 impl commit.

export class ProviderUnavailable extends Error {
  override readonly name = 'ProviderUnavailable';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class ProviderTimeout extends Error {
  override readonly name = 'ProviderTimeout';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class ProviderRateLimited extends Error {
  override readonly name = 'ProviderRateLimited';
  constructor(
    message: string,
    /** retry-after seconds from the API response header */
    readonly retryAfterSeconds: number,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class ProviderMalformed extends Error {
  override readonly name = 'ProviderMalformed';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}
