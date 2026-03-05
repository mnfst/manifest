import { buildCustomEndpoint, resolveEndpointKey, PROVIDER_ENDPOINTS } from '../provider-endpoints';

describe('buildCustomEndpoint', () => {
  it('strips trailing /v1 from base URL to avoid double /v1', () => {
    const endpoint = buildCustomEndpoint('https://api.groq.com/openai/v1');

    expect(endpoint.baseUrl).toBe('https://api.groq.com/openai');
    expect(endpoint.format).toBe('openai');
  });

  it('leaves base URL intact when no /v1 suffix', () => {
    const endpoint = buildCustomEndpoint('https://api.example.com');
    expect(endpoint.baseUrl).toBe('https://api.example.com');
  });

  it('uses Bearer auth headers', () => {
    const endpoint = buildCustomEndpoint('http://localhost:8000');
    const headers = endpoint.buildHeaders('sk-test');

    expect(headers).toEqual({
      Authorization: 'Bearer sk-test',
      'Content-Type': 'application/json',
    });
  });

  it('builds OpenAI-compatible /v1/chat/completions path', () => {
    const endpoint = buildCustomEndpoint('http://localhost:8000');
    const path = endpoint.buildPath('llama-3.1-70b');

    expect(path).toBe('/v1/chat/completions');
  });
});

describe('resolveEndpointKey', () => {
  it('resolves known providers directly', () => {
    expect(resolveEndpointKey('openai')).toBe('openai');
    expect(resolveEndpointKey('anthropic')).toBe('anthropic');
    expect(resolveEndpointKey('google')).toBe('google');
    expect(resolveEndpointKey('deepseek')).toBe('deepseek');
    expect(resolveEndpointKey('ollama')).toBe('ollama');
  });

  it('is case-insensitive', () => {
    expect(resolveEndpointKey('OpenAI')).toBe('openai');
    expect(resolveEndpointKey('ANTHROPIC')).toBe('anthropic');
  });

  it('resolves alias gemini to google', () => {
    expect(resolveEndpointKey('gemini')).toBe('google');
    expect(resolveEndpointKey('Gemini')).toBe('google');
  });

  it('resolves alias z.ai to zai', () => {
    expect(resolveEndpointKey('z.ai')).toBe('zai');
  });

  it('returns custom: key as-is for custom providers', () => {
    expect(resolveEndpointKey('custom:abc-123')).toBe('custom:abc-123');
    expect(resolveEndpointKey('custom:uuid-456')).toBe('custom:uuid-456');
  });

  it('returns null for unknown providers', () => {
    expect(resolveEndpointKey('unknown')).toBeNull();
    expect(resolveEndpointKey('random-provider')).toBeNull();
  });

  it('exposes expected set of known providers', () => {
    const known = Object.keys(PROVIDER_ENDPOINTS);
    expect(known).toContain('openai');
    expect(known).toContain('anthropic');
    expect(known).toContain('google');
    expect(known).toContain('openrouter');
    expect(known).toContain('ollama');
  });
});
