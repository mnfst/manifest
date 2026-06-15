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

  it('getXaiOAuthUrl forwards agentName as a query param', async () => {
    const fetchMock = setupFetch({ url: 'https://auth.x.ai/oauth2/authorize?state=s' });
    const out = await oauth.getXaiOAuthUrl('demo');
    expect(out).toEqual({ url: 'https://auth.x.ai/oauth2/authorize?state=s' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/oauth/xai/authorize');
    expect(url).toContain('agentName=demo');
  });

  it('submitXaiOAuthCallback POSTs code + state as JSON', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.submitXaiOAuthCallback('code-1', 'state-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/xai/callback');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    expect(req.body).toBe(JSON.stringify({ code: 'code-1', state: 'state-1' }));
    expect((req.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('revokeOpenaiOAuth POSTs with the encoded agent name in the URL', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeOpenaiOAuth('my agent');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/openai/revoke?agentName=my+agent');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('revokeXaiOAuth POSTs with the encoded agent name and label in the URL', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeXaiOAuth('my agent', 'X Account');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/xai/revoke?agentName=my+agent&label=X+Account');
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

  it('revokeMinimaxOAuth POSTs with the encoded agent name in the URL', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeMinimaxOAuth('my agent');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/minimax/revoke?agentName=my+agent');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('revokeMinimaxOAuth includes the encoded key label when provided', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeMinimaxOAuth('my agent', 'Key 2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/minimax/revoke?agentName=my+agent&label=Key+2');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('startKiroOAuth POSTs to the device-flow start endpoint with the encoded agent name', async () => {
    const fetchMock = setupFetch({
      flowId: 'f1',
      userCode: 'AAAA-BBBB',
      verificationUri: 'https://verify',
      expiresAt: 0,
      pollIntervalMs: 5000,
    });
    const out = await oauth.startKiroOAuth('my agent');
    expect(out.flowId).toBe('f1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/kiro/start?agentName=my+agent');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('startKiroOAuth includes IAM Identity Center options when provided', async () => {
    const fetchMock = setupFetch({
      flowId: 'f1',
      userCode: 'AAAA-BBBB',
      verificationUri: 'https://verify',
      expiresAt: 0,
      pollIntervalMs: 5000,
    });
    await oauth.startKiroOAuth('demo', {
      startUrl: ' https://org.awsapps.com/start ',
      region: ' eu-west-1 ',
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/oauth/kiro/start?');
    expect(url).toContain('agentName=demo');
    expect(url).toContain('startUrl=https%3A%2F%2Forg.awsapps.com%2Fstart');
    expect(url).toContain('region=eu-west-1');
  });

  it('pollKiroOAuth GETs /poll with the flowId', async () => {
    const fetchMock = setupFetch({ status: 'pending', pollIntervalMs: 5000 });
    const out = await oauth.pollKiroOAuth('flow-1');
    expect(out).toEqual({ status: 'pending', pollIntervalMs: 5000 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/oauth/kiro/poll');
    expect(url).toContain('flowId=flow-1');
  });

  it('revokeKiroOAuth POSTs with the encoded agent name and optional label', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeKiroOAuth('my agent', 'Kiro 2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/kiro/revoke?agentName=my+agent&label=Kiro+2');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('revokeKiroOAuth omits the label when not provided', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeKiroOAuth('demo');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/oauth/kiro/revoke?agentName=demo');
    expect(url).not.toContain('label=');
  });

  describe('getDeviceCodeApi', () => {
    it('routes minimax through its region-aware start endpoint', async () => {
      const fetchMock = setupFetch({
        flowId: 'f1',
        userCode: 'C',
        verificationUri: 'https://v',
        expiresAt: 0,
        pollIntervalMs: 1000,
      });
      const api = oauth.getDeviceCodeApi('minimax');
      expect(api.hasRegion).toBe(true);
      await api.start('demo', { region: 'cn' });
      expect(fetchMock.mock.calls[0][0] as string).toContain('region=cn');
    });

    it('defaults the minimax region when start is called without one', async () => {
      const fetchMock = setupFetch({
        flowId: 'f1',
        userCode: 'C',
        verificationUri: 'https://v',
        expiresAt: 0,
        pollIntervalMs: 1000,
      });
      await oauth.getDeviceCodeApi('minimax').start('demo');
      expect(fetchMock.mock.calls[0][0] as string).toContain('region=global');
    });

    it('routes kiro through its default start endpoint without options', async () => {
      const fetchMock = setupFetch({
        flowId: 'f1',
        userCode: 'C',
        verificationUri: 'https://v',
        expiresAt: 0,
        pollIntervalMs: 5000,
      });
      const api = oauth.getDeviceCodeApi('kiro');
      expect(api.hasRegion).toBe(false);
      await api.start('demo');
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/v1/oauth/kiro/start');
      expect(url).not.toContain('region=');
    });

    it('routes kiro IAM Identity Center options through its start endpoint', async () => {
      const fetchMock = setupFetch({
        flowId: 'f1',
        userCode: 'C',
        verificationUri: 'https://v',
        expiresAt: 0,
        pollIntervalMs: 5000,
      });
      await oauth.getDeviceCodeApi('kiro').start('demo', {
        startUrl: 'https://org.awsapps.com/start',
        region: 'eu-west-1',
      });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('startUrl=https%3A%2F%2Forg.awsapps.com%2Fstart');
      expect(url).toContain('region=eu-west-1');
    });

    it('throws for a provider without a device-code flow', () => {
      expect(() => oauth.getDeviceCodeApi('openai')).toThrow('does not support device-code OAuth');
    });
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
    expect(url).toContain('/api/v1/oauth/anthropic/revoke?agentName=my+agent');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('revokeAnthropicOAuth includes the encoded key label when provided', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeAnthropicOAuth('my agent', 'Key 2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/anthropic/revoke?agentName=my+agent&label=Key+2');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('getGeminiOAuthUrl forwards agentName as a query param', async () => {
    const fetchMock = setupFetch({ url: 'https://accounts.google.com/o/oauth2/v2/auth?...' });
    const out = await oauth.getGeminiOAuthUrl('my-agent');
    expect(out).toEqual({ url: 'https://accounts.google.com/o/oauth2/v2/auth?...' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/oauth/gemini/authorize');
    expect(url).toContain('agentName=my-agent');
  });

  it('submitGeminiOAuthCallback POSTs code and state to the callback endpoint', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.submitGeminiOAuthCallback('auth-code-123', 'state-abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/gemini/callback');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      code: 'auth-code-123',
      state: 'state-abc',
    });
  });

  it('revokeGeminiOAuth POSTs with the encoded agent name in the URL', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeGeminiOAuth('my agent');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/gemini/revoke?agentName=my+agent');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('revokeGeminiOAuth includes the encoded key label when provided', async () => {
    const fetchMock = setupFetch({ ok: true });
    await oauth.revokeGeminiOAuth('my agent', 'Key 2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/gemini/revoke?agentName=my+agent&label=Key+2');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('getPopupOauthApi returns gemini api for gemini provider', () => {
    const api = oauth.getPopupOauthApi('gemini');
    expect(typeof api.getUrl).toBe('function');
    expect(typeof api.submitCallback).toBe('function');
    expect(typeof api.revoke).toBe('function');
  });

  it('getPopupOauthApi returns openai api for openai provider', () => {
    const api = oauth.getPopupOauthApi('openai');
    expect(typeof api.getUrl).toBe('function');
    expect(typeof api.submitCallback).toBe('function');
    expect(typeof api.revoke).toBe('function');
  });

  it('getPopupOauthApi throws for unsupported provider', () => {
    expect(() => oauth.getPopupOauthApi('anthropic')).toThrow(
      'Provider "anthropic" does not support popup OAuth',
    );
  });

  it('getPopupOauthApi gemini getUrl delegates to getGeminiOAuthUrl', async () => {
    const fetchMock = setupFetch({ url: 'https://accounts.google.com/auth' });
    const api = oauth.getPopupOauthApi('gemini');
    const result = await api.getUrl('agent-1');
    expect(result).toEqual({ url: 'https://accounts.google.com/auth' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/oauth/gemini/authorize');
  });

  it('getPopupOauthApi gemini submitCallback delegates to submitGeminiOAuthCallback', async () => {
    const fetchMock = setupFetch({ ok: true });
    const api = oauth.getPopupOauthApi('gemini');
    await api.submitCallback('code-xyz', 'state-xyz');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/gemini/callback');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('getPopupOauthApi gemini revoke delegates to revokeGeminiOAuth', async () => {
    const fetchMock = setupFetch({ ok: true });
    const api = oauth.getPopupOauthApi('gemini');
    await api.revoke('agent-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/oauth/gemini/revoke');
    expect((init as RequestInit).method).toBe('POST');
  });
});
