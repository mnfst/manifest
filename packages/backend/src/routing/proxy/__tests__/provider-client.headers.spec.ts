// Strict header contract tests for ProviderClient's auth-critical paths.
//
// Existing tests in provider-client.spec.ts often assert headers with
// `expect.any(Object)` or only check one or two fields. That leaves room
// for regressions in the auth header *shape* — e.g. Anthropic silently
// switching from `x-api-key` to `Authorization: Bearer`, or the
// ChatGPT subscription path losing the Codex-CLI spoof. This file pins
// the *exact* header set on every auth-critical path so any drift
// fails loudly.

import { ProviderClient } from '../provider-client';

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

const body = {
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
};

describe('ProviderClient — strict header contract on auth-critical paths', () => {
  let client: ProviderClient;

  beforeEach(() => {
    client = new ProviderClient();
    mockFetch.mockReset();
  });

  it('Anthropic api_key path sends exactly x-api-key (no Authorization Bearer leak)', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'anthropic',
      apiKey: 'sk-ant-key',
      model: 'claude-sonnet-4-20250514',
      body,
      stream: false,
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    // Pin every header on this path so we'd notice a Bearer/x-api-key swap.
    expect(sentHeaders).toEqual({
      'x-api-key': 'sk-ant-key',
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    });
    expect(sentHeaders).not.toHaveProperty('Authorization');
    expect(sentHeaders).not.toHaveProperty('anthropic-beta');
  });

  it('Anthropic subscription path sends Claude Code-shaped Bearer headers (and NO x-api-key)', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'anthropic',
      apiKey: 'sk-ant-oat-token',
      model: 'claude-sonnet-4-20250514',
      body,
      stream: false,
      authType: 'subscription',
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders).toEqual({
      Authorization: 'Bearer sk-ant-oat-token',
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-beta': expect.stringContaining('claude-code-20250219'),
      'anthropic-dangerous-direct-browser-access': 'true',
      'user-agent': expect.stringContaining('claude-cli/'),
      'x-app': 'cli',
      'x-stainless-arch': expect.any(String),
      'x-stainless-helper-method': 'stream',
      'x-stainless-lang': 'js',
      'x-stainless-os': expect.any(String),
      'x-stainless-package-version': expect.any(String),
      'x-stainless-retry-count': '0',
      'x-stainless-runtime': 'node',
      'x-stainless-runtime-version': expect.any(String),
      'x-stainless-timeout': '600',
    });
    expect(sentHeaders['anthropic-beta']).toContain('oauth-2025-04-20');
    expect(sentHeaders['anthropic-beta']).not.toContain('prompt-caching-scope-2026-01-05');
    expect(sentHeaders).not.toHaveProperty('x-api-key');
  });

  it('OpenAI api_key path sends exactly Authorization Bearer (and never x-api-key)', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      body,
      stream: false,
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders).toEqual({
      Authorization: 'Bearer sk-test',
      'Content-Type': 'application/json',
    });
    expect(sentHeaders).not.toHaveProperty('x-api-key');
    expect(sentHeaders).not.toHaveProperty('originator');
  });

  it('xAI api_key path sends exactly Authorization Bearer (no leaked Anthropic-style headers)', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'xai',
      apiKey: 'sk-xai-key',
      model: 'grok-3',
      body,
      stream: false,
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders).toEqual({
      Authorization: 'Bearer sk-xai-key',
      'Content-Type': 'application/json',
    });
    expect(sentHeaders).not.toHaveProperty('x-api-key');
    expect(sentHeaders).not.toHaveProperty('anthropic-version');
  });

  it('Kimi (moonshot subscription) Anthropic-compatible path sends x-api-key (NOT Bearer)', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'moonshot',
      apiKey: 'kimi-code-key',
      model: 'kimi-for-coding',
      body,
      stream: false,
      authType: 'subscription',
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders).toEqual({
      'x-api-key': 'kimi-code-key',
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    });
    expect(sentHeaders).not.toHaveProperty('Authorization');
  });

  it('Google api_key path sends exactly x-goog-api-key (NOT Authorization Bearer)', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'google',
      apiKey: 'AIza-secret',
      model: 'gemini-2.0-flash',
      body,
      stream: false,
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders).toEqual({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'AIza-secret',
    });
    expect(sentHeaders).not.toHaveProperty('Authorization');
    // Key must not appear in URL either.
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain('AIza-secret');
  });

  it('OpenRouter sends Bearer + HTTP-Referer + X-Title attribution headers', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'openrouter',
      apiKey: 'sk-or-key',
      model: 'openrouter/auto',
      body,
      stream: false,
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders).toEqual({
      Authorization: 'Bearer sk-or-key',
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://manifest.build',
      'X-Title': 'Manifest',
    });
    expect(sentHeaders).not.toHaveProperty('x-api-key');
  });

  it('ChatGPT subscription path pins Codex-CLI spoof headers exactly', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'openai',
      apiKey: 'oauth-token',
      model: 'gpt-5',
      body,
      stream: false,
      authType: 'subscription',
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders.Authorization).toBe('Bearer oauth-token');
    expect(sentHeaders['Content-Type']).toBe('application/json');
    expect(sentHeaders.originator).toBe('codex_cli_rs');
    // user-agent is the spoofed Codex CLI agent — must be present (any
    // missing field would change upstream behavior since chatgpt.com
    // rejects non-Codex shaped requests).
    expect(typeof sentHeaders['user-agent']).toBe('string');
    expect(sentHeaders['user-agent'].length).toBeGreaterThan(0);
    expect(sentHeaders).not.toHaveProperty('x-api-key');
    expect(sentHeaders).not.toHaveProperty('anthropic-version');
  });
});
