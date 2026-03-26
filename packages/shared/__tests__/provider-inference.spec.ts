import { MODEL_PREFIX_MAP, inferProviderFromModel } from '../src/provider-inference';

describe('MODEL_PREFIX_MAP', () => {
  it('is a non-empty array of [RegExp, string] entries', () => {
    expect(MODEL_PREFIX_MAP.length).toBeGreaterThan(0);
    for (const [re, id] of MODEL_PREFIX_MAP) {
      expect(re).toBeInstanceOf(RegExp);
      expect(typeof id).toBe('string');
    }
  });
});

describe('inferProviderFromModel', () => {
  it.each([
    ['claude-sonnet-4', 'anthropic'],
    ['claude-opus-4-6', 'anthropic'],
    ['gpt-4o', 'openai'],
    ['gpt-4-turbo', 'openai'],
    ['o3-mini', 'openai'],
    ['o1-preview', 'openai'],
    ['o4-mini', 'openai'],
    ['chatgpt-4o-latest', 'openai'],
    ['gemini-2.0-flash', 'gemini'],
    ['gemma-2-9b', 'gemini'],
    ['deepseek-r1', 'deepseek'],
    ['grok-3', 'xai'],
    ['mistral-large-latest', 'mistral'],
    ['codestral-2501', 'mistral'],
    ['pixtral-large', 'mistral'],
    ['open-mistral-nemo', 'mistral'],
    ['kimi-k2', 'moonshot'],
    ['moonshot-v1', 'moonshot'],
    ['MiniMax-M2.5', 'minimax'],
    ['glm-4', 'zai'],
    ['qwen2.5-coder', 'qwen'],
    ['qwq-32b', 'qwen'],
    ['copilot/gpt-5.4', 'copilot'],
    ['copilot/claude-opus-4.6', 'copilot'],
    ['openrouter/auto', 'openrouter'],
    ['anthropic/claude-sonnet-4', 'openrouter'],
  ])('infers %s as %s', (model, expected) => {
    expect(inferProviderFromModel(model)).toBe(expected);
  });

  it('returns "custom" for custom: prefix', () => {
    expect(inferProviderFromModel('custom:abc-123/gpt-4o')).toBe('custom');
  });

  it('returns "ollama" for models with colon tags', () => {
    expect(inferProviderFromModel('qwen2.5:0.5b')).toBe('ollama');
    expect(inferProviderFromModel('llama3:latest')).toBe('ollama');
  });

  it('does not treat :free suffix as ollama', () => {
    expect(inferProviderFromModel('openrouter/model:free')).not.toBe('ollama');
  });

  it('returns undefined for unrecognized models', () => {
    expect(inferProviderFromModel('unknown-model')).toBeUndefined();
  });
});
