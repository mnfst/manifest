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

  it('should handle minimax alias', () => {
    const result = expandProviderNames(['minimax']);
    expect(result.has('minimax')).toBe(true);
  });

  it('should handle copilot alias', () => {
    const result = expandProviderNames(['copilot']);
    expect(result.has('copilot')).toBe(true);
  });

  it('should expand zai to include z.ai', () => {
    const result = expandProviderNames(['zai']);
    expect(result.has('zai')).toBe(true);
    expect(result.has('z.ai')).toBe(true);
  });

  it('should expand z.ai to include zai', () => {
    const result = expandProviderNames(['z.ai']);
    expect(result.has('z.ai')).toBe(true);
    expect(result.has('zai')).toBe(true);
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

  it('should not alias-expand custom: prefixed providers', () => {
    const result = expandProviderNames(['custom:cp-uuid-123']);
    expect(result.has('custom:cp-uuid-123')).toBe(true);
    // Should only contain the exact key — no alias expansion
    expect(result.size).toBe(1);
  });

  it('should handle custom: providers mixed with regular providers', () => {
    const result = expandProviderNames(['custom:cp-1', 'gemini']);
    expect(result.has('custom:cp-1')).toBe(true);
    expect(result.has('gemini')).toBe(true);
    expect(result.has('google')).toBe(true);
  });
});
