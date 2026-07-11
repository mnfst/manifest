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
import { CodexSessionAffinity } from '../codex-session-affinity';
import { extractAgentRequestContext } from '../agent-request-context';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

const body = {
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
};

function openAiOAuthToken(authClaims: Record<string, unknown>): string {
  const payload = Buffer.from(
    JSON.stringify({ 'https://api.openai.com/auth': authClaims }),
  ).toString('base64url');
  return `header.${payload}.signature`;
}

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
    expect(sentHeaders['anthropic-beta']).toContain('context-management-2025-06-27');
    expect(sentHeaders['anthropic-beta']).toContain('effort-2025-11-24');
    expect(sentHeaders['anthropic-beta']).toContain('prompt-caching-scope-2026-01-05');
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
    expect(sentHeaders.version).toBe('0.144.1');
    // user-agent is the spoofed Codex CLI agent — must be present (any
    // missing field would change upstream behavior since chatgpt.com
    // rejects non-Codex shaped requests).
    expect(typeof sentHeaders['user-agent']).toBe('string');
    expect(sentHeaders['user-agent'].length).toBeGreaterThan(0);
    // Prompt-cache affinity headers the Codex backend needs for cache hits.
    expect(sentHeaders['session-id']).toMatch(UUID_RE);
    expect(sentHeaders['thread-id']).toMatch(UUID_RE);
    expect(sentHeaders).not.toHaveProperty('x-api-key');
    expect(sentHeaders).not.toHaveProperty('anthropic-version');
  });

  it('preserves current Claude Code protocol headers and native Messages body', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const nativeBody = {
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      stream: true,
      system: [
        {
          type: 'text',
          text: 'Claude Code attribution',
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
        { type: 'text', text: 'Repository instructions' },
      ],
      messages: [{ role: 'user', content: 'Hello' }],
      context_management: { edits: [{ type: 'clear_tool_uses_20250919' }] },
    };
    const requestContext = extractAgentRequestContext({
      authorization: 'Bearer mnfst_gateway_key',
      'user-agent': 'claude-cli/2.1.207 (external, sdk-cli)',
      'x-app': 'cli',
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'claude-code-20250219,future-capability-2099-01-01',
      'anthropic-future-header': 'enabled',
    });

    await client.forward({
      provider: 'anthropic',
      apiKey: 'stored-anthropic-oauth',
      model: 'claude-sonnet-4-6',
      body: nativeBody,
      stream: true,
      authType: 'subscription',
      apiMode: 'messages',
      requestContext,
    });

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const sentHeaders = init.headers as Record<string, string>;
    const sentBody = JSON.parse(init.body as string);
    expect(sentHeaders.Authorization).toBe('Bearer stored-anthropic-oauth');
    expect(sentHeaders).not.toHaveProperty('x-api-key');
    expect(sentHeaders['user-agent']).toBe('claude-cli/2.1.207 (external, sdk-cli)');
    expect(sentHeaders['anthropic-future-header']).toBe('enabled');
    expect(sentHeaders['anthropic-beta']).toBe(
      'claude-code-20250219,future-capability-2099-01-01,oauth-2025-04-20',
    );
    expect(sentBody).toEqual(nativeBody);
    expect(sentBody.system[0].text).toBe('Claude Code attribution');
    expect(sentBody).not.toHaveProperty('cache_control');
  });

  it('uses native Codex metadata while provider-owned OAuth account headers remain authoritative', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const apiKey = openAiOAuthToken({
      chatgpt_account_id: 'stored-account-id',
      chatgpt_account_is_fedramp: true,
    });
    const requestContext = extractAgentRequestContext({
      authorization: 'Bearer mnfst_gateway_key',
      'chatgpt-account-id': 'caller-account-id',
      'user-agent': 'codex_exec/0.144.1 (Ubuntu 24.4.0; x86_64)',
      originator: 'codex_exec',
      version: '0.144.1',
      'session-id': 'native-session',
      'thread-id': 'native-thread',
      'x-client-request-id': 'native-request',
      'x-codex-beta-features': 'remote_compaction_v2',
    });

    await client.forward({
      provider: 'openai',
      apiKey,
      model: 'gpt-5.4',
      body: {
        model: 'gpt-5.4',
        instructions: 'You are Codex.',
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }],
        stream: true,
        prompt_cache_key: 'native-thread',
      },
      stream: true,
      authType: 'subscription',
      apiMode: 'responses',
      requestContext,
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders.Authorization).toBe(`Bearer ${apiKey}`);
    expect(sentHeaders['ChatGPT-Account-ID']).toBe('stored-account-id');
    expect(sentHeaders['X-OpenAI-Fedramp']).toBe('true');
    expect(sentHeaders['user-agent']).toContain('codex_exec/0.144.1');
    expect(sentHeaders.originator).toBe('codex_exec');
    expect(sentHeaders.version).toBe('0.144.1');
    expect(sentHeaders['session-id']).toBe('native-session');
    expect(sentHeaders['thread-id']).toBe('native-thread');
    expect(sentHeaders['x-codex-beta-features']).toBe('remote_compaction_v2');
    expect(JSON.stringify(sentHeaders)).not.toContain('caller-account-id');
  });

  it('uses stored OpenAI workspace metadata when the access token has no routing claims', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'openai',
      apiKey: 'opaque-access-token',
      model: 'gpt-5.4',
      body: { model: 'gpt-5.4', input: 'Hello', stream: true },
      stream: true,
      authType: 'subscription',
      apiMode: 'responses',
      subscriptionMetadata: { accountId: 'stored-workspace', fedramp: true },
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders.Authorization).toBe('Bearer opaque-access-token');
    expect(sentHeaders['ChatGPT-Account-ID']).toBe('stored-workspace');
    expect(sentHeaders['X-OpenAI-Fedramp']).toBe('true');
  });

  it('retains only named Responses function and custom tool types for response restoration', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    const result = await client.forward({
      provider: 'openai',
      apiKey: 'sk-openai',
      model: 'gpt-5.4',
      body: {
        input: 'Use a tool.',
        tools: [
          null,
          { type: 'function' },
          { type: 'web_search_preview' },
          { type: 'function', name: 'lookup' },
          { type: 'custom', name: 'shell' },
        ],
      },
      stream: false,
      apiMode: 'responses',
    });

    expect(result.responsesToolTypesByName).toEqual({
      lookup: 'function',
      shell: 'custom',
    });
  });
});

describe('ProviderClient — Codex prompt-cache affinity (openai-subscription)', () => {
  let client: ProviderClient;

  beforeEach(() => {
    client = new ProviderClient();
    mockFetch.mockReset();
  });

  const subscriptionOpts = {
    provider: 'openai',
    apiKey: 'oauth-token',
    model: 'gpt-5',
    body,
    stream: false,
    authType: 'subscription',
  } as const;

  it('sends deterministic session-id/thread-id headers across requests', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({ ...subscriptionOpts });
    await client.forward({ ...subscriptionOpts });

    const first = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    const second = mockFetch.mock.calls[1][1].headers as Record<string, string>;
    expect(first['session-id']).toMatch(UUID_RE);
    expect(first['session-id']).toBe(second['session-id']);
    expect(first['thread-id']).toBe(second['thread-id']);
  });

  it('injects a stable default prompt_cache_key into the outgoing body', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({ ...subscriptionOpts });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.prompt_cache_key).toMatch(UUID_RE);
  });

  it('keeps the caller-supplied prompt_cache_key on the Chat Completions path', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      ...subscriptionOpts,
      body: { ...body, prompt_cache_key: 'caller-conv-1' },
    });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.prompt_cache_key).toBe('caller-conv-1');
  });

  it('forwards the caller prompt_cache_key on the api-key /responses conversion path', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'o1-pro',
      body: { ...body, prompt_cache_key: 'caller-conv-1' },
      stream: false,
    });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.prompt_cache_key).toBe('caller-conv-1');
    // Affinity headers stay subscription-only; the API-key path needs none.
    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(sentHeaders).not.toHaveProperty('session-id');
  });

  it('replays the x-codex-turn-state token captured from the previous response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{}', { status: 200, headers: { 'x-codex-turn-state': 'turn-abc' } }),
    );
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await client.forward({ ...subscriptionOpts });
    await client.forward({ ...subscriptionOpts });

    const first = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    const second = mockFetch.mock.calls[1][1].headers as Record<string, string>;
    expect(first).not.toHaveProperty('x-codex-turn-state');
    expect(second['x-codex-turn-state']).toBe('turn-abc');
  });

  it('applies affinity on the native Responses API path too', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      ...subscriptionOpts,
      apiMode: 'responses',
      body: { input: 'Hello', instructions: 'You are helpful.' },
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentHeaders['session-id']).toMatch(UUID_RE);
    expect(sentBody.prompt_cache_key).toMatch(UUID_RE);
  });

  it('keeps affinity headers authoritative over caller-supplied extraHeaders', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      ...subscriptionOpts,
      extraHeaders: { 'session-id': 'attacker-override', 'x-observability': 'keep-me' },
    });

    const sentHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    // Routing-critical affinity header wins…
    expect(sentHeaders['session-id']).toMatch(UUID_RE);
    expect(sentHeaders['session-id']).not.toBe('attacker-override');
    // …while non-conflicting extraHeaders still pass through.
    expect(sentHeaders['x-observability']).toBe('keep-me');
  });

  it('uses an injected CodexSessionAffinity instance when provided', async () => {
    const affinity = new CodexSessionAffinity();
    const prepareSpy = jest.spyOn(affinity, 'prepare');
    const injected = new ProviderClient(undefined, undefined, affinity);
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await injected.forward({ ...subscriptionOpts });

    expect(prepareSpy).toHaveBeenCalledWith('oauth-token', expect.any(Object));
  });
});
