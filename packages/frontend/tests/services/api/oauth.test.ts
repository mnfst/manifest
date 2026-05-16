import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as oauth from '../../../src/services/api/oauth';

vi.mock('../../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

function setupFetch(response: unknown = {}, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('oauth API client', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getOpenaiOAuthUrl forwards agentName as a query param', async () => {
    const fetchMock = setupFetch({ url: 'https://example.com' });
    const out = await oauth.getOpenaiOAuthUrl('demo');
    expect(out).toEqual({ url: 'https://example.com' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/oauth/openai/authorize');
    expect(url).toContain('agentName=demo');
  });

  it('revokeOpenaiOAuth POSTs with the encoded agent name in the URL', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeOpenaiOAuth('my agent');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/openai/revoke?agentName=my+agent');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('revokeOpenaiOAuth includes the encoded key label when provided', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeOpenaiOAuth('my agent', 'Key 2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/openai/revoke?agentName=my+agent&label=Key+2');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('startMinimaxOAuth defaults region to global', async () => {
    const fetchMock = setupFetch({
      flowId: 'f1',
      userCode: 'CODE',
      verificationUri: 'https://verify',
      expiresAt: 0,
      pollIntervalMs: 1000,
    });
    await oauth.startMinimaxOAuth('demo');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/minimax/start');
    expect(url).toContain('agentName=demo');
    expect(url).toContain('region=global');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('startMinimaxOAuth forwards an explicit cn region', async () => {
    const fetchMock = setupFetch({
      flowId: 'f1',
      userCode: 'CODE',
      verificationUri: 'https://verify',
      expiresAt: 0,
      pollIntervalMs: 1000,
    });
    await oauth.startMinimaxOAuth('demo', 'cn');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('region=cn');
  });

  it('pollMinimaxOAuth GETs /poll with the flowId', async () => {
    const fetchMock = setupFetch({ status: 'pending', pollIntervalMs: 2000 });
    const out = await oauth.pollMinimaxOAuth('flow-1');
    expect(out).toEqual({ status: 'pending', pollIntervalMs: 2000 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/oauth/minimax/poll');
    expect(url).toContain('flowId=flow-1');
  });

  it('startAnthropicOAuth POSTs the encoded agent name and returns the auth URL + state', async () => {
    const fetchMock = setupFetch({ url: 'https://claude.ai/oauth/authorize?state=s', state: 's' });
    const out = await oauth.startAnthropicOAuth('my agent');
    expect(out).toEqual({
      url: 'https://claude.ai/oauth/authorize?state=s',
      state: 's',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/anthropic/authorize?agentName=my%20agent');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('submitAnthropicOAuth POSTs the code/state pair as JSON', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.submitAnthropicOAuth('demo', 'auth-code-1', 'state-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/anthropic/exchange?agentName=demo');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    expect(req.body).toBe(JSON.stringify({ code: 'auth-code-1', state: 'state-1' }));
    expect((req.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('getAnthropicOAuthPending forwards the agent name as a query param', async () => {
    const fetchMock = setupFetch({ state: null });
    const out = await oauth.getAnthropicOAuthPending('demo');
    expect(out).toEqual({ state: null });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/oauth/anthropic/pending');
    expect(url).toContain('agentName=demo');
  });

  it('revokeAnthropicOAuth POSTs to /revoke with the encoded agent name', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeAnthropicOAuth('my agent');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/anthropic/revoke?agentName=my%20agent');
    expect((init as RequestInit).method).toBe('POST');
  });
});
