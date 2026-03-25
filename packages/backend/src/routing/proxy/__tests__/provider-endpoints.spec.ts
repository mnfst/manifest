import {
  buildCustomEndpoint,
  buildEndpointOverride,
  resolveEndpointKey,
  PROVIDER_ENDPOINTS,
} from '../provider-endpoints';

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
    expect(resolveEndpointKey('zai')).toBe('zai');
    expect(resolveEndpointKey('kimi')).toBe('kimi');
    expect(resolveEndpointKey('opencode')).toBe('opencode');
    expect(resolveEndpointKey('opencode-go')).toBe('opencode-go');
    expect(resolveEndpointKey('ollama-cloud')).toBe('ollama-cloud');
    expect(resolveEndpointKey('nano-gpt')).toBe('nano-gpt');
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
    expect(known).toContain('kimi');
    expect(known).toContain('google');
    expect(known).toContain('copilot');
    expect(known).toContain('openrouter');
    expect(known).toContain('ollama');
  });
});

describe('PROVIDER_ENDPOINTS', () => {
  it('zai buildPath returns correct path', () => {
    const path = PROVIDER_ENDPOINTS['zai'].buildPath('test-model');
    expect(path).toBe('/api/paas/v4/chat/completions');
  });

  it('ollama buildHeaders returns Content-Type only', () => {
    const headers = PROVIDER_ENDPOINTS['ollama'].buildHeaders('');
    expect(headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('ollama uses openai format', () => {
    expect(PROVIDER_ENDPOINTS['ollama'].format).toBe('openai');
  });

  it('opencode uses openai format and standard path', () => {
    expect(PROVIDER_ENDPOINTS['opencode'].format).toBe('openai');
    expect(PROVIDER_ENDPOINTS['opencode'].buildPath('test')).toBe('/v1/chat/completions');
  });

  it('opencode-go uses openai format and standard path', () => {
    expect(PROVIDER_ENDPOINTS['opencode-go'].format).toBe('openai');
    expect(PROVIDER_ENDPOINTS['opencode-go'].buildPath('test')).toBe('/v1/chat/completions');
  });

  it('zai uses openai format', () => {
    expect(PROVIDER_ENDPOINTS['zai'].format).toBe('openai');
  });

  it('ollama-cloud uses openai format with ollama.com base', () => {
    expect(PROVIDER_ENDPOINTS['ollama-cloud'].format).toBe('openai');
    expect(PROVIDER_ENDPOINTS['ollama-cloud'].baseUrl).toBe('https://ollama.com');
    expect(PROVIDER_ENDPOINTS['ollama-cloud'].buildPath('test')).toBe('/v1/chat/completions');
  });

  it('zai-subscription uses coding plan endpoint', () => {
    const path = PROVIDER_ENDPOINTS['zai-subscription'].buildPath('glm-5');
    expect(path).toBe('/api/coding/paas/v4/chat/completions');
    expect(PROVIDER_ENDPOINTS['zai-subscription'].format).toBe('openai');
  });

  it('anthropic uses x-api-key for api_key auth', () => {
    const headers = PROVIDER_ENDPOINTS['anthropic'].buildHeaders('sk-ant-test');
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('anthropic uses Bearer + oauth beta header for subscription auth', () => {
    const headers = PROVIDER_ENDPOINTS['anthropic'].buildHeaders('skst-token', 'subscription');
    expect(headers['Authorization']).toBe('Bearer skst-token');
    expect(headers['anthropic-beta']).toBe('oauth-2025-04-20');
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('anthropic does not include oauth beta header for api_key auth', () => {
    const headers = PROVIDER_ENDPOINTS['anthropic'].buildHeaders('sk-ant-test');
    expect(headers['anthropic-beta']).toBeUndefined();
  });

  it('copilot uses Bearer auth and OpenAI-compatible format', () => {
    const ep = PROVIDER_ENDPOINTS['copilot'];
    expect(ep.baseUrl).toBe('https://api.githubcopilot.com');
    expect(ep.format).toBe('openai');
    expect(ep.buildPath('copilot/claude-sonnet-4.6')).toBe('/chat/completions');
    expect(ep.buildHeaders('ghu_token')).toEqual({
      Authorization: 'Bearer ghu_token',
      'Content-Type': 'application/json',
      'Editor-Version': 'vscode/1.100.0',
      'Editor-Plugin-Version': 'copilot/1.300.0',
      'Copilot-Integration-Id': 'vscode-chat',
    });
  });

  it('anthropic buildPath returns /v1/messages', () => {
    const path = PROVIDER_ENDPOINTS['anthropic'].buildPath('claude-sonnet-4');
    expect(path).toBe('/v1/messages');
  });

  it('kimi uses Anthropic format with the coding base URL', () => {
    const ep = PROVIDER_ENDPOINTS['kimi'];
    expect(ep.baseUrl).toBe('https://api.kimi.com/coding');
    expect(ep.format).toBe('anthropic');
    expect(ep.buildPath('kimi-for-coding')).toBe('/v1/messages');
    expect(ep.buildHeaders('sk-kimi-test')).toEqual({
      'x-api-key': 'sk-kimi-test',
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    });
  });

  it('google buildHeaders returns Content-Type only', () => {
    const headers = PROVIDER_ENDPOINTS['google'].buildHeaders('');
    expect(headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('google buildPath includes model name with generateContent suffix', () => {
    const path = PROVIDER_ENDPOINTS['google'].buildPath('gemini-2.0-flash');
    expect(path).toBe('/v1beta/models/gemini-2.0-flash:generateContent');
  });

  it('openrouter buildPath returns /api/v1/chat/completions', () => {
    const path = PROVIDER_ENDPOINTS['openrouter'].buildPath('openai/gpt-4o');
    expect(path).toBe('/api/v1/chat/completions');
  });

  it('openai-subscription uses chatgpt.com backend base URL', () => {
    const ep = PROVIDER_ENDPOINTS['openai-subscription'];
    expect(ep.baseUrl).toBe('https://chatgpt.com/backend-api');
  });

  it('openai-subscription builds /codex/responses path', () => {
    const path = PROVIDER_ENDPOINTS['openai-subscription'].buildPath('gpt-5');
    expect(path).toBe('/codex/responses');
  });

  it('openai-subscription uses chatgpt format', () => {
    expect(PROVIDER_ENDPOINTS['openai-subscription'].format).toBe('chatgpt');
  });

  it('openai-subscription headers include originator and user-agent', () => {
    const headers = PROVIDER_ENDPOINTS['openai-subscription'].buildHeaders('oauth-token');
    expect(headers['Authorization']).toBe('Bearer oauth-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['originator']).toBe('codex_cli_rs');
    expect(headers['user-agent']).toBe('codex_cli_rs/0.0.0 (Unknown 0; unknown) unknown');
  });

  it('minimax-subscription buildPath returns /v1/messages', () => {
    const path = PROVIDER_ENDPOINTS['minimax-subscription'].buildPath('abab7-chat-preview');
    expect(path).toBe('/v1/messages');
  });

  it('nano-gpt uses openai format with nano-gpt.com base', () => {
    const ep = PROVIDER_ENDPOINTS['nano-gpt'];
    expect(ep.format).toBe('openai');
    expect(ep.baseUrl).toBe('https://nano-gpt.com');
    expect(ep.buildPath('test')).toBe('/api/v1/chat/completions');
    expect(ep.buildHeaders('sk-nano-test')).toEqual({
      Authorization: 'Bearer sk-nano-test',
      'Content-Type': 'application/json',
    });
  });

  it('minimax-subscription uses Bearer auth with anthropic-version header', () => {
    const headers = PROVIDER_ENDPOINTS['minimax-subscription'].buildHeaders('oauth-token');
    expect(headers).toEqual({
      Authorization: 'Bearer oauth-token',
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    });
  });
});

describe('buildEndpointOverride', () => {
  it('creates endpoint using the template for a known key', () => {
    const ep = buildEndpointOverride('https://custom.minimax.io/anthropic', 'minimax-subscription');

    expect(ep.baseUrl).toBe('https://custom.minimax.io/anthropic');
    expect(ep.format).toBe('anthropic');
    expect(ep.buildPath('model-x')).toBe('/v1/messages');
  });

  it('throws when template key does not exist', () => {
    expect(() => buildEndpointOverride('https://example.com', 'nonexistent-template')).toThrow(
      'No provider endpoint template configured for: nonexistent-template',
    );
  });
});
