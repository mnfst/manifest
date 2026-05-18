import { providerThinkingDefault } from '../src/thinking-defaults';

describe('providerThinkingDefault', () => {
  it('returns the registered default for providers whose spec declares the thinking key', () => {
    expect(providerThinkingDefault('deepseek')).toBe('enabled');
  });

  it('is case-insensitive on the provider id', () => {
    expect(providerThinkingDefault('DeepSeek')).toBe('enabled');
  });

  it('returns undefined for providers whose spec has no thinking key', () => {
    expect(providerThinkingDefault('openai')).toBeUndefined();
    expect(providerThinkingDefault(undefined)).toBeUndefined();
    expect(providerThinkingDefault('')).toBeUndefined();
  });
});
