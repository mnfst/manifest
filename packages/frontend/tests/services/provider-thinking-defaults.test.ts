import { describe, it, expect } from 'vitest';
import {
  PROVIDER_THINKING_DEFAULTS,
  thinkingDefaultFor,
} from '../../src/services/provider-thinking-defaults';

describe('thinkingDefaultFor', () => {
  it('returns the registered default for known providers', () => {
    expect(thinkingDefaultFor('deepseek')).toBe('enabled');
  });

  it('is case-insensitive on the provider id', () => {
    expect(thinkingDefaultFor('DeepSeek')).toBe('enabled');
  });

  it('returns undefined for unknown providers', () => {
    expect(thinkingDefaultFor('openai')).toBeUndefined();
    expect(thinkingDefaultFor('anthropic')).toBeUndefined();
  });

  it('returns undefined for missing input', () => {
    expect(thinkingDefaultFor(undefined)).toBeUndefined();
    expect(thinkingDefaultFor('')).toBeUndefined();
  });

  it('exports the registry for callers that need to enumerate it', () => {
    expect(PROVIDER_THINKING_DEFAULTS.deepseek).toBe('enabled');
  });
});
