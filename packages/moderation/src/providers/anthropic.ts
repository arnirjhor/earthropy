import type { ModerationInput, ModerationProvider, ModerationResult } from '../provider.ts';

// Default Earthropy moderation provider. Real implementation lands in Phase C
// (week 5–7) — uses the Anthropic SDK to ask Claude to score the content
// across the ModerationCategory axes and return JSON. Until then, this stub
// fails loudly so we never silently let content through unmoderated.
export class AnthropicModerationProvider implements ModerationProvider {
  // biome-ignore lint/correctness/noUnusedVariables: stub
  constructor(
    private readonly apiKey: string,
    private readonly model = 'claude-opus-4-5',
  ) {}

  // biome-ignore lint/correctness/noUnusedVariables: stub
  async classify(_input: ModerationInput): Promise<ModerationResult> {
    throw new Error('AnthropicModerationProvider is not yet implemented (Phase C).');
  }
}
