// Environment variable helpers for the moderation package.
// ANTHROPIC_API_KEY is required when not in fixture-replay mode.
// MODERATION_MODEL defaults to 'claude-sonnet-4-5'.
// MODERATION_FIXTURE_REPLAY=1 makes the provider read from fixtures instead of calling the API.

export function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is required. Set it in your environment or use MODERATION_FIXTURE_REPLAY=1 for tests.',
    );
  }
  return key;
}

export function getModel(): string {
  return process.env.MODERATION_MODEL ?? 'claude-sonnet-4-5';
}

export function isReplayMode(): boolean {
  return process.env.MODERATION_FIXTURE_REPLAY === '1';
}

export function getTimeoutMs(): number {
  const raw = process.env.ANTHROPIC_TIMEOUT_MS;
  if (raw) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 10_000;
}
