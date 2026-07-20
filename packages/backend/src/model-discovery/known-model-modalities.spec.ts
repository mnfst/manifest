import { lookupKnownModalities } from './known-model-modalities';

describe('lookupKnownModalities', () => {
  it('identifies gpt-5.3-codex-spark as text-only, case-insensitively', () => {
    expect(lookupKnownModalities('OpenAI', 'GPT-5.3-Codex-Spark')).toEqual({
      input: ['text'],
      output: ['text'],
    });
  });

  it('returns undefined for models without a curated entry', () => {
    expect(lookupKnownModalities('openai', 'gpt-5.4')).toBeUndefined();
    expect(lookupKnownModalities('anthropic', 'gpt-5.3-codex-spark')).toBeUndefined();
  });
});
