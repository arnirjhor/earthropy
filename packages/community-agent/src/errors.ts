// Typed provider errors for the community-agent package.
// Pattern follows packages/moderation/src/errors.ts.

export class AgentProviderUnavailable extends Error {
  override readonly name = 'AgentProviderUnavailable';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class AgentProviderTimeout extends Error {
  override readonly name = 'AgentProviderTimeout';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class AgentProviderMalformed extends Error {
  override readonly name = 'AgentProviderMalformed';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}
