import { PROVIDER_THINKING_DEFAULTS, providerThinkingDefault } from '../src/thinking-defaults';

describe('providerThinkingDefault', () => {
  it('returns the registered default for known providers', () => {
    expect(providerThinkingDefault('deepseek')).toBe('enabled');
  });

  it('is case-insensitive on the provider id', () => {
    expect(providerThinkingDefault('DeepSeek')).toBe('enabled');
  });

  it('returns undefined for unknown or missing providers', () => {
    expect(providerThinkingDefault('openai')).toBeUndefined();
    expect(providerThinkingDefault(undefined)).toBeUndefined();
    expect(providerThinkingDefault('')).toBeUndefined();
  });

  it('exports the registry for callers that need to enumerate it', () => {
    expect(PROVIDER_THINKING_DEFAULTS.deepseek).toBe('enabled');
  });
});
