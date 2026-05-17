// Environment variable helpers for the moderation package.
// ANTHROPIC_API_KEY is required when not in fixture-replay mode.
// MODERATION_MODEL defaults to 'claude-sonnet-4-5'.
// MODERATION_FIXTURE_REPLAY=1 makes the provider read from fixtures instead of calling the API.
//
// Ollama provider env vars (C-MOD-2):
//   OLLAMA_BASE_URL   — base URL of the Ollama server (default: http://localhost:11434)
//   OLLAMA_MODEL      — Llama Guard model tag (default: llama-guard3:8b)
//   OLLAMA_AUX_MODEL  — auxiliary chat model for spam/misinfo/off_topic (default: llama3.1:8b)
//                       set to 'none' to disable the second pass

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

// ---------------------------------------------------------------------------
// Ollama-specific env helpers
// ---------------------------------------------------------------------------

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL ?? 'llama-guard3:8b';
}

/** Returns the aux model tag, or 'none' if the second pass is disabled. */
export function getOllamaAuxModel(): string {
  return process.env.OLLAMA_AUX_MODEL ?? 'llama3.1:8b';
}

export function getOllamaTimeoutMs(): number {
  const raw = process.env.OLLAMA_TIMEOUT_MS;
  if (raw) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  // Design doc §8.2: 30s for Ollama (CPU inference can be slow)
  return 30_000;
}
