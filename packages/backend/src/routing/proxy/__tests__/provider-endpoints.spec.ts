import { PROVIDER_REGISTRY } from '../../../common/constants/providers';
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

  it('resolves qwen and alibaba to qwen', () => {
    expect(resolveEndpointKey('qwen')).toBe('qwen');
    expect(resolveEndpointKey('alibaba')).toBe('qwen');
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
    expect(known).toContain('qwen');
    expect(known).toContain('copilot');
    expect(known).toContain('openrouter');
    expect(known).toContain('ollama');
    expect(known).toContain('ollama-cloud');
    expect(known).toContain('opencode-go');
    expect(known).toContain('opencode-go-anthropic');
  });

  it('resolves ollama-cloud to ollama-cloud', () => {
    expect(resolveEndpointKey('ollama-cloud')).toBe('ollama-cloud');
    expect(resolveEndpointKey('Ollama-Cloud')).toBe('ollama-cloud');
  });

  it('resolves opencode-go and its opencodego alias', () => {
    expect(resolveEndpointKey('opencode-go')).toBe('opencode-go');
    expect(resolveEndpointKey('OpenCode-Go')).toBe('opencode-go');
    expect(resolveEndpointKey('opencodego')).toBe('opencode-go');
  });

  it('resolves every built-in provider id and alias from the registry', () => {
    for (const entry of PROVIDER_REGISTRY) {
      expect(resolveEndpointKey(entry.id)).not.toBeNull();
      for (const alias of entry.aliases) {
        expect(resolveEndpointKey(alias)).not.toBeNull();
      }
    }
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

  it('zai uses openai format', () => {
    expect(PROVIDER_ENDPOINTS['zai'].format).toBe('openai');
  });

  it('qwen uses DashScope compatible-mode endpoint', () => {
    const ep = PROVIDER_ENDPOINTS['qwen'];
    expect(ep.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode');
    expect(ep.buildPath('qwen3-235b-a22b')).toBe('/v1/chat/completions');
    expect(ep.format).toBe('openai');
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

  it('minimax-subscription uses Bearer auth with anthropic-version header', () => {
    const headers = PROVIDER_ENDPOINTS['minimax-subscription'].buildHeaders('oauth-token');
    expect(headers).toEqual({
      Authorization: 'Bearer oauth-token',
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    });
  });

  it('ollama-cloud points at ollama.com with OpenAI format', () => {
    const ep = PROVIDER_ENDPOINTS['ollama-cloud'];
    expect(ep.baseUrl).toBe('https://ollama.com');
    expect(ep.format).toBe('openai');
    expect(ep.buildPath('deepseek-v3.2')).toBe('/v1/chat/completions');
  });

  it('ollama-cloud uses OpenAI-compatible Bearer auth headers', () => {
    const headers = PROVIDER_ENDPOINTS['ollama-cloud'].buildHeaders('sk-cloud-key');
    expect(headers).toEqual({
      Authorization: 'Bearer sk-cloud-key',
      'Content-Type': 'application/json',
    });
  });

  it('zai-subscription uses Coding Plan base URL', () => {
    const ep = PROVIDER_ENDPOINTS['zai-subscription'];
    expect(ep.baseUrl).toBe('https://open.bigmodel.cn/api/coding/paas/v4');
  });

  it('zai-subscription builds /chat/completions path', () => {
    const path = PROVIDER_ENDPOINTS['zai-subscription'].buildPath('glm-5.1');
    expect(path).toBe('/chat/completions');
  });

  it('zai-subscription uses openai format', () => {
    expect(PROVIDER_ENDPOINTS['zai-subscription'].format).toBe('openai');
  });

  it('zai-subscription uses Bearer auth headers', () => {
    const headers = PROVIDER_ENDPOINTS['zai-subscription'].buildHeaders('zai-api-key');
    expect(headers).toEqual({
      Authorization: 'Bearer zai-api-key',
      'Content-Type': 'application/json',
    });
  });

  it('opencode-go uses OpenCode base URL with OpenAI format', () => {
    const ep = PROVIDER_ENDPOINTS['opencode-go'];
    expect(ep.baseUrl).toBe('https://opencode.ai/zen/go');
    expect(ep.format).toBe('openai');
    expect(ep.buildPath('glm-5.1')).toBe('/v1/chat/completions');
  });

  it('opencode-go uses Bearer auth headers', () => {
    const headers = PROVIDER_ENDPOINTS['opencode-go'].buildHeaders('og-token');
    expect(headers).toEqual({
      Authorization: 'Bearer og-token',
      'Content-Type': 'application/json',
    });
  });

  it('opencode-go-anthropic uses Anthropic format with /v1/messages', () => {
    const ep = PROVIDER_ENDPOINTS['opencode-go-anthropic'];
    expect(ep.baseUrl).toBe('https://opencode.ai/zen/go');
    expect(ep.format).toBe('anthropic');
    expect(ep.buildPath('minimax-m2.7')).toBe('/v1/messages');
  });

  it('opencode-go-anthropic uses x-api-key (not Bearer) with anthropic-version header', () => {
    const headers = PROVIDER_ENDPOINTS['opencode-go-anthropic'].buildHeaders('og-token');
    expect(headers).toEqual({
      'x-api-key': 'og-token',
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    });
    expect(headers['Authorization']).toBeUndefined();
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
