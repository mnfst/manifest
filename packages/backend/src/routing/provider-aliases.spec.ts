import { expandProviderNames } from './provider-aliases';

describe('expandProviderNames', () => {
  it('should return the input name lowercased', () => {
    const result = expandProviderNames(['OpenAI']);
    expect(result.has('openai')).toBe(true);
  });

  it('should expand gemini to include google', () => {
    const result = expandProviderNames(['gemini']);
    expect(result.has('gemini')).toBe(true);
    expect(result.has('google')).toBe(true);
  });

  it('should expand google to include gemini', () => {
    const result = expandProviderNames(['google']);
    expect(result.has('google')).toBe(true);
    expect(result.has('gemini')).toBe(true);
  });

  it('should expand qwen to include alibaba', () => {
    const result = expandProviderNames(['qwen']);
    expect(result.has('qwen')).toBe(true);
    expect(result.has('alibaba')).toBe(true);
  });

  it('should expand alibaba to include qwen', () => {
    const result = expandProviderNames(['alibaba']);
    expect(result.has('alibaba')).toBe(true);
    expect(result.has('qwen')).toBe(true);
  });

  it('should handle xai alias', () => {
    const result = expandProviderNames(['xai']);
    expect(result.has('xai')).toBe(true);
  });

  it('should not expand unknown providers (fallback ?? [])', () => {
    const result = expandProviderNames(['deepseek']);
    expect(result.has('deepseek')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should handle multiple providers', () => {
    const result = expandProviderNames(['gemini', 'qwen', 'openai']);
    expect(result.has('gemini')).toBe(true);
    expect(result.has('google')).toBe(true);
    expect(result.has('qwen')).toBe(true);
    expect(result.has('alibaba')).toBe(true);
    expect(result.has('openai')).toBe(true);
  });

  it('should handle empty input', () => {
    const result = expandProviderNames([]);
    expect(result.size).toBe(0);
  });
});
