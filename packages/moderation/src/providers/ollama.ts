import type {
  ModerationInput,
  ModerationProvider,
  ModerationResult,
} from '../provider.ts';

// Self-host friendly provider. Real implementation lands in Phase C — wraps
// an Ollama server running Llama Guard 3 (or similar) and converts its output
// to the ModerationCategory axes.
export class OllamaModerationProvider implements ModerationProvider {
  constructor(
    // biome-ignore lint/correctness/noUnusedVariables: stub
    private readonly baseUrl: string,
    // biome-ignore lint/correctness/noUnusedVariables: stub
    private readonly model = 'llama-guard3:8b',
  ) {}

  // biome-ignore lint/correctness/noUnusedVariables: stub
  async classify(_input: ModerationInput): Promise<ModerationResult> {
    throw new Error('OllamaModerationProvider is not yet implemented (Phase C).');
  }
}
