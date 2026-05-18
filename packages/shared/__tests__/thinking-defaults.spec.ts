import { providerThinkingDefault } from '../src/thinking-defaults';

describe('providerThinkingDefault', () => {
  it('returns the registered default for providers whose spec declares the thinking key', () => {
    expect(providerThinkingDefault('deepseek', 'api_key')).toBe('enabled');
  });

  it('is case-insensitive on the provider id', () => {
    expect(providerThinkingDefault('DeepSeek', 'api_key')).toBe('enabled');
  });

  it('returns undefined for routes whose spec has no thinking key', () => {
    expect(providerThinkingDefault('openai', 'api_key')).toBeUndefined();
    expect(providerThinkingDefault('deepseek', 'subscription')).toBeUndefined();
    expect(providerThinkingDefault(undefined, 'api_key')).toBeUndefined();
    expect(providerThinkingDefault('', 'api_key')).toBeUndefined();
  });
});
