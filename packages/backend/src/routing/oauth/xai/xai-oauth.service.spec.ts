import { ConfigService } from '@nestjs/config';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { ProviderService } from '../../routing-core/provider.service';
import { XaiOauthService } from './xai-oauth.service';

const originalFetch = global.fetch;

function mockResponse(status: number, body: unknown, text = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text || JSON.stringify(body),
  } as unknown as Response;
}

function createConfig(nodeEnv = 'production'): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'app.nodeEnv') return nodeEnv;
      if (key === 'XAI_OAUTH_CLIENT_ID') return undefined;
      return undefined;
    },
  } as unknown as ConfigService;
}

function createProviderService() {
  const upsertProvider = jest.fn().mockResolvedValue({ provider: { id: 'p1' } });
  const recalculateTiers = jest.fn().mockResolvedValue(undefined);
  const nextOAuthLabel = jest.fn().mockResolvedValue('X Account');
  const getFreshSubscriptionCredential = jest.fn().mockResolvedValue(null);
  return {
    svc: {
      upsertProvider,
      recalculateTiers,
      nextOAuthLabel,
      getFreshSubscriptionCredential,
    } as unknown as ProviderService,
    upsertProvider,
    recalculateTiers,
    nextOAuthLabel,
    getFreshSubscriptionCredential,
  };
}

function createDiscovery(): { svc: ModelDiscoveryService; discoverModels: jest.Mock } {
  const discoverModels = jest.fn().mockResolvedValue(undefined);
  return { svc: { discoverModels } as unknown as ModelDiscoveryService, discoverModels };
}

describe('XaiOauthService', () => {
  let fetchMock: jest.Mock;
  let providerService: ReturnType<typeof createProviderService>;
  let discovery: ReturnType<typeof createDiscovery>;
  let svc: XaiOauthService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-26T12:00:00Z'));
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    providerService = createProviderService();
    discovery = createDiscovery();
    svc = new XaiOauthService(providerService.svc, createConfig('production'), discovery.svc);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('builds an xAI OAuth URL with PKCE and the subscription scopes', async () => {
    const url = await svc.generateAuthorizationUrl('agent-1', 'user-1', 'http://localhost:3001');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://auth.x.ai/oauth2/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('b1a00492-073a-47ea-816f-4c329264a828');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:56121/callback');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')?.length).toBeGreaterThan(0);
    expect(parsed.searchParams.get('scope')).toContain('grok-cli:access');
    expect(parsed.searchParams.get('scope')).toContain('api:access');
    expect(parsed.searchParams.has('plan')).toBe(false);
    expect(parsed.searchParams.has('referrer')).toBe(false);
    expect(parsed.searchParams.get('state')?.length).toBeGreaterThan(0);
    expect(svc.getPendingCount()).toBe(1);
  });

  it('uses a custom xAI client id from ConfigService when provided', async () => {
    const config = {
      get: (key: string) =>
        key === 'XAI_OAUTH_CLIENT_ID'
          ? 'custom-xai-client'
          : key === 'app.nodeEnv'
            ? 'production'
            : undefined,
    } as unknown as ConfigService;
    const customSvc = new XaiOauthService(providerService.svc, config, discovery.svc);
    const url = await customSvc.generateAuthorizationUrl('a', 'u');
    expect(new URL(url).searchParams.get('client_id')).toBe('custom-xai-client');
  });

  it('exchanges a valid code, stores the OAuth blob, and triggers model discovery', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_in: 3600,
      }),
    );
    const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
    const parsed = new URL(url);
    const state = parsed.searchParams.get('state')!;

    await svc.exchangeCode(state, 'auth-code');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [tokenUrl, init] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe('https://auth.x.ai/oauth2/token');
    const body = new URLSearchParams(init.body.toString());
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('redirect_uri')).toBe('http://127.0.0.1:56121/callback');
    expect(body.get('code_verifier')?.length).toBeGreaterThan(0);
    expect(body.has('code_challenge')).toBe(false);
    expect(body.has('code_challenge_method')).toBe(false);

    expect(providerService.nextOAuthLabel).toHaveBeenCalledWith('agent-1', 'xai');
    expect(providerService.upsertProvider).toHaveBeenCalledWith(
      'agent-1',
      'user-1',
      'xai',
      expect.stringContaining('"t":"access-1"'),
      'subscription',
      undefined,
      'X Account',
    );
    expect(discovery.discoverModels).toHaveBeenCalledWith({ id: 'p1' });
    expect(providerService.recalculateTiers).toHaveBeenCalledWith('agent-1');
    expect(svc.getPendingCount()).toBe(0);
  });

  it('rejects unknown and expired states', async () => {
    await expect(svc.exchangeCode('bogus-state', 'code')).rejects.toThrow(
      'Invalid or expired OAuth state',
    );

    const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
    const state = new URL(url).searchParams.get('state')!;
    jest.advanceTimersByTime(10 * 60 * 1000 + 1);

    await expect(svc.exchangeCode(state, 'code')).rejects.toThrow('OAuth state expired');
    expect(svc.getPendingCount()).toBe(0);
  });

  it('throws when the token endpoint returns an error', async () => {
    fetchMock.mockResolvedValue(mockResponse(400, {}, 'invalid_grant'));
    const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
    const state = new URL(url).searchParams.get('state')!;

    await expect(svc.exchangeCode(state, 'bad-code')).rejects.toThrow('Token exchange failed');
  });

  it('refreshes and persists a fresh access token when the stored token is near expiry', async () => {
    const blob = { t: 'old', r: 'refresh-old', e: Date.now() + 30_000 };
    fetchMock.mockResolvedValue(
      mockResponse(200, {
        access_token: 'new-access',
        refresh_token: 'refresh-new',
        expires_in: 3600,
      }),
    );

    const token = await svc.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1', 'Work');

    expect(token).toBe('new-access');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.x.ai/oauth2/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(providerService.upsertProvider).toHaveBeenCalledWith(
      'agent-1',
      'user-1',
      'xai',
      expect.stringContaining('"t":"new-access"'),
      'subscription',
      undefined,
      'Work',
    );
  });

  it('returns cached token while still valid and null for malformed blobs', async () => {
    const blob = { t: 'access', r: 'refresh', e: Date.now() + 10 * 60 * 1000 };
    expect(await svc.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1')).toBe('access');
    expect(await svc.unwrapToken('not-json', 'agent-1', 'user-1')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs tokens to the xAI revoke endpoint', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, {}));

    await svc.revokeToken('tok');

    const [revokeUrl, init] = fetchMock.mock.calls[0];
    expect(revokeUrl).toBe('https://auth.x.ai/oauth2/revoke');
    const body = new URLSearchParams(init.body.toString());
    expect(body.get('token')).toBe('tok');
  });
});
