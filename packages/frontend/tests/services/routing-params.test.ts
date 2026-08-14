import { describe, it, expect } from 'vitest';
import { parseCustomProviderParams, parseProviderDeepLink } from '../../src/services/routing-params';

describe('parseCustomProviderParams', () => {
  it('returns null when provider param is missing', () => {
    expect(parseCustomProviderParams({})).toBeNull();
  });

  it('returns null when provider is not "custom"', () => {
    expect(parseCustomProviderParams({ provider: 'anthropic' })).toBeNull();
  });

  it('returns empty prefill when only provider=custom is set', () => {
    expect(parseCustomProviderParams({ provider: 'custom' })).toEqual({});
  });

  it('parses name param', () => {
    const result = parseCustomProviderParams({ provider: 'custom', name: 'Groq' });
    expect(result).toEqual({ name: 'Groq' });
  });

  it('parses baseUrl param', () => {
    const result = parseCustomProviderParams({
      provider: 'custom',
      baseUrl: 'https://api.groq.com/v1',
    });
    expect(result).toEqual({ baseUrl: 'https://api.groq.com/v1' });
  });

  it('parses apiKey param', () => {
    const result = parseCustomProviderParams({ provider: 'custom', apiKey: 'sk-test' });
    expect(result).toEqual({ apiKey: 'sk-test' });
  });

  it('parses all fields together', () => {
    const result = parseCustomProviderParams({
      provider: 'custom',
      name: 'Groq',
      baseUrl: 'https://api.groq.com/v1',
      apiKey: 'gsk-123',
    });
    expect(result).toEqual({
      name: 'Groq',
      baseUrl: 'https://api.groq.com/v1',
      apiKey: 'gsk-123',
    });
  });

  it('parses models with name only', () => {
    const result = parseCustomProviderParams({
      provider: 'custom',
      models: 'llama-3.1-70b',
    });
    expect(result?.models).toEqual([{ model_name: 'llama-3.1-70b' }]);
  });

  it('parses models with name and prices', () => {
    const result = parseCustomProviderParams({
      provider: 'custom',
      models: 'llama-3.1-70b:0.59:0.79',
    });
    expect(result?.models).toEqual([
      { model_name: 'llama-3.1-70b', input_price: '0.59', output_price: '0.79' },
    ]);
  });

  it('parses multiple models', () => {
    const result = parseCustomProviderParams({
      provider: 'custom',
      models: 'model-a:1:2,model-b,model-c:0:0',
    });
    expect(result?.models).toEqual([
      { model_name: 'model-a', input_price: '1', output_price: '2' },
      { model_name: 'model-b' },
      { model_name: 'model-c', input_price: '0', output_price: '0' },
    ]);
  });

  it('parses models with only input price', () => {
    const result = parseCustomProviderParams({
      provider: 'custom',
      models: 'model-a:1.5',
    });
    expect(result?.models).toEqual([{ model_name: 'model-a', input_price: '1.5' }]);
  });

  it('ignores undefined optional params', () => {
    const result = parseCustomProviderParams({
      provider: 'custom',
      name: undefined,
      baseUrl: undefined,
    });
    expect(result).toEqual({});
  });
});

describe('parseProviderDeepLink', () => {
  it('returns null when provider param is missing', () => {
    expect(parseProviderDeepLink({})).toBeNull();
  });

  it('returns null when provider is "custom"', () => {
    expect(parseProviderDeepLink({ provider: 'custom' })).toBeNull();
  });

  it('returns null when provider is empty string', () => {
    expect(parseProviderDeepLink({ provider: '' })).toBeNull();
  });

  it('returns deep link for a standard provider', () => {
    expect(parseProviderDeepLink({ provider: 'anthropic' })).toEqual({ providerId: 'anthropic' });
  });

  it('returns deep link for gemini', () => {
    expect(parseProviderDeepLink({ provider: 'gemini' })).toEqual({ providerId: 'gemini' });
  });

  it('handles array param by taking first value', () => {
    expect(parseProviderDeepLink({ provider: ['openai', 'anthropic'] })).toEqual({
      providerId: 'openai',
    });
  });
});
