import { lookupKnownModalities } from './known-model-modalities';

describe('lookupKnownModalities', () => {
  it('identifies gpt-5.3-codex-spark as text-only, case-insensitively', () => {
    expect(lookupKnownModalities('OpenAI', 'GPT-5.3-Codex-Spark')).toEqual({
      input: ['text'],
      output: ['text'],
      capabilities: ['text', 'tools', 'stream'],
    });
  });

  it('identifies mainline ChatGPT subscription models as accepting image input', () => {
    for (const modelId of [
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.4-mini',
    ]) {
      expect(lookupKnownModalities('openai', modelId)).toEqual({
        input: ['text', 'image'],
        output: ['text'],
        capabilities: ['text', 'image', 'tools', 'stream'],
      });
    }
  });

  it('returns undefined for models without a curated entry', () => {
    expect(lookupKnownModalities('openai', 'unlisted-model')).toBeUndefined();
    expect(lookupKnownModalities('anthropic', 'gpt-5.3-codex-spark')).toBeUndefined();
  });
});
