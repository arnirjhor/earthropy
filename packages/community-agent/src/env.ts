// Environment variable helpers for the community-agent package.
//
// COMMUNITY_AGENT_ENABLED     — toggle the feature entirely (default: false)
// COMMUNITY_AGENT_PROVIDER    — 'anthropic' | 'ollama' (default: anthropic)
// COMMUNITY_AGENT_MODEL       — Anthropic model (default: claude-haiku-4-5)
// ANTHROPIC_API_KEY           — required when provider=anthropic
// ANTHROPIC_TIMEOUT_MS        — request timeout for Anthropic calls (default: 15000)
// OLLAMA_BASE_URL             — Ollama server base URL (default: http://localhost:11434)
// OLLAMA_AGENT_MODEL          — Ollama model for agent tasks (default: llama3.1:8b)
// OLLAMA_AGENT_TIMEOUT_MS     — Ollama request timeout (default: 60000)

export function isEnabled(): boolean {
  return process.env.COMMUNITY_AGENT_ENABLED === 'true';
}

export function getProviderName(): 'anthropic' | 'ollama' {
  const val = process.env.COMMUNITY_AGENT_PROVIDER ?? 'anthropic';
  if (val === 'ollama') return 'ollama';
  return 'anthropic';
}

export function getModel(): string {
  return process.env.COMMUNITY_AGENT_MODEL ?? 'claude-haiku-4-5';
}

export function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is required when COMMUNITY_AGENT_PROVIDER=anthropic');
  }
  return key;
}

export function getTimeoutMs(): number {
  const raw = process.env.ANTHROPIC_TIMEOUT_MS;
  if (raw) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 15_000;
}

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
}

export function getOllamaAgentModel(): string {
  return process.env.OLLAMA_AGENT_MODEL ?? 'llama3.1:8b';
}

export function getOllamaAgentTimeoutMs(): number {
  const raw = process.env.OLLAMA_AGENT_TIMEOUT_MS;
  if (raw) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 60_000;
}
