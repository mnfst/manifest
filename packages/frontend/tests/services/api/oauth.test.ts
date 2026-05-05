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
    expect(url).toContain('/api/v1/oauth/openai/revoke?agentName=my%20agent');
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
});
