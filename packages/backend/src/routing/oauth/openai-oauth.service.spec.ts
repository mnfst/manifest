import { ConfigService } from '@nestjs/config';
import { OpenaiOauthService } from './openai-oauth.service';
import { ProviderService } from '../routing-core/provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';

const originalFetch = global.fetch;

function mockResponse(status: number, body: unknown, text = ''): Response {
  const jsonBody = body;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => jsonBody,
    text: async () => text || JSON.stringify(jsonBody),
  } as unknown as Response;
}

function createConfig(nodeEnv = 'production'): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'app.nodeEnv') return nodeEnv;
      if (key === 'OPENAI_OAUTH_CLIENT_ID') return undefined;
      return undefined;
    },
  } as unknown as ConfigService;
}

function createProviderService(): {
  svc: ProviderService;
  upsertProvider: jest.Mock;
  recalculateTiers: jest.Mock;
} {
  const upsertProvider = jest.fn().mockResolvedValue({ provider: { id: 'p1' } });
  const recalculateTiers = jest.fn().mockResolvedValue(undefined);
  return {
    svc: { upsertProvider, recalculateTiers } as unknown as ProviderService,
    upsertProvider,
    recalculateTiers,
  };
}

function createDiscovery(): { svc: ModelDiscoveryService; discoverModels: jest.Mock } {
  const discoverModels = jest.fn().mockResolvedValue(undefined);
  return { svc: { discoverModels } as unknown as ModelDiscoveryService, discoverModels };
}

describe('OpenaiOauthService', () => {
  let fetchMock: jest.Mock;
  let providerService: ReturnType<typeof createProviderService>;
  let discovery: ReturnType<typeof createDiscovery>;
  let svc: OpenaiOauthService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T12:00:00Z'));
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    providerService = createProviderService();
    discovery = createDiscovery();
    svc = new OpenaiOauthService(providerService.svc, createConfig('production'), discovery.svc);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('generateAuthorizationUrl', () => {
    it('builds an OAuth URL with PKCE S256 challenge and tracks pending state', async () => {
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1', 'http://localhost:3001');
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://auth.openai.com/oauth/authorize');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsed.searchParams.get('code_challenge')?.length).toBeGreaterThan(0);
      expect(parsed.searchParams.get('scope')).toBe('openid profile email offline_access');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:1455/auth/callback');
      expect(parsed.searchParams.get('state')?.length).toBeGreaterThan(0);
      // Required so the resulting id_token carries organization_id and can be
      // exchanged for an api.openai.com key (RFC 8693).
      expect(parsed.searchParams.get('id_token_add_organizations')).toBe('true');
      expect(parsed.searchParams.get('codex_cli_simplified_flow')).toBe('true');
      expect(svc.getPendingCount()).toBe(1);
    });

    it('cleans up expired pending states on each call', async () => {
      await svc.generateAuthorizationUrl('a1', 'u1');
      expect(svc.getPendingCount()).toBe(1);
      // Advance past the 10-minute TTL.
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);
      await svc.generateAuthorizationUrl('a2', 'u2');
      // The old entry should have been cleaned up; only the new one remains.
      expect(svc.getPendingCount()).toBe(1);
    });

    it('uses a custom client id from ConfigService when provided', async () => {
      const config = {
        get: (key: string) => (key === 'OPENAI_OAUTH_CLIENT_ID' ? 'custom-client' : 'production'),
      } as unknown as ConfigService;
      const customSvc = new OpenaiOauthService(providerService.svc, config, discovery.svc);
      const url = await customSvc.generateAuthorizationUrl('a', 'u');
      expect(new URL(url).searchParams.get('client_id')).toBe('custom-client');
    });
  });

  describe('exchangeCode', () => {
    it('rejects unknown states', async () => {
      await expect(svc.exchangeCode('bogus-state', 'code')).rejects.toThrow(
        'Invalid or expired OAuth state',
      );
    });

    it('rejects (and purges) expired states', async () => {
      const url = await svc.generateAuthorizationUrl('a', 'u');
      const state = new URL(url).searchParams.get('state')!;
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);
      await expect(svc.exchangeCode(state, 'code')).rejects.toThrow('OAuth state expired');
      expect(svc.getPendingCount()).toBe(0);
    });

    it('exchanges code, mints an api.openai.com key, stores it, and triggers discovery', async () => {
      fetchMock
        // 1. authorization_code → tokens (incl. id_token)
        .mockResolvedValueOnce(
          mockResponse(200, {
            id_token: 'id-token-1',
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            expires_in: 3600,
          }),
        )
        // 2. RFC 8693 token-exchange → minted API key
        .mockResolvedValueOnce(
          mockResponse(200, { access_token: 'sk-minted-1', expires_in: 1800 }),
        );
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;

      await svc.exchangeCode(state, 'auth-code');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [authCodeCall, exchangeCall] = fetchMock.mock.calls;
      expect(authCodeCall[0]).toBe('https://auth.openai.com/oauth/token');
      expect(new URLSearchParams(authCodeCall[1].body.toString()).get('grant_type')).toBe(
        'authorization_code',
      );
      expect(exchangeCall[0]).toBe('https://auth.openai.com/oauth/token');
      const exchangeBody = new URLSearchParams(exchangeCall[1].body.toString());
      expect(exchangeBody.get('grant_type')).toBe(
        'urn:ietf:params:oauth:grant-type:token-exchange',
      );
      expect(exchangeBody.get('subject_token')).toBe('id-token-1');
      expect(exchangeBody.get('requested_token')).toBe('openai-api-key');

      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'openai',
        expect.stringContaining('"t":"sk-minted-1"'),
        'subscription',
      );
      expect(discovery.discoverModels).toHaveBeenCalled();
      expect(providerService.recalculateTiers).toHaveBeenCalledWith('agent-1');
      expect(svc.getPendingCount()).toBe(0);
    });

    it('throws when the token endpoint returns an error', async () => {
      fetchMock.mockResolvedValue(mockResponse(400, {}, 'invalid_grant'));
      const url = await svc.generateAuthorizationUrl('a', 'u');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'bad')).rejects.toThrow('Token exchange failed');
    });

    it('throws when the token-exchange step returns no access_token', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, {
            id_token: 'id-1',
            access_token: 'a',
            refresh_token: 'r',
            expires_in: 60,
          }),
        )
        .mockResolvedValueOnce(mockResponse(200, {}));
      const url = await svc.generateAuthorizationUrl('a', 'u');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'c')).rejects.toThrow(
        'API key exchange returned no access_token',
      );
    });

    it('throws when the token-exchange step returns a non-2xx status', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, {
            id_token: 'id-1',
            access_token: 'a',
            refresh_token: 'r',
            expires_in: 60,
          }),
        )
        .mockResolvedValueOnce(mockResponse(401, {}, 'invalid_subject_token'));
      const url = await svc.generateAuthorizationUrl('a', 'u');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'c')).rejects.toThrow('API key exchange failed');
    });

    it('throws when the OAuth response omits id_token', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }),
      );
      const url = await svc.generateAuthorizationUrl('a', 'u');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'c')).rejects.toThrow('OAuth response missing id_token');
    });

    it('swallows discovery errors (OAuth success is not rolled back)', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, {
            id_token: 'id-1',
            access_token: 'a',
            refresh_token: 'r',
            expires_in: 60,
          }),
        )
        .mockResolvedValueOnce(mockResponse(200, { access_token: 'sk-x', expires_in: 60 }));
      discovery.discoverModels.mockRejectedValue(new Error('boom'));
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'c')).resolves.toBeUndefined();
      expect(providerService.upsertProvider).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes OAuth tokens, mints a new api.openai.com key, returns blob', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, {
            id_token: 'id-2',
            access_token: 'a2',
            refresh_token: 'r2',
            expires_in: 1800,
          }),
        )
        .mockResolvedValueOnce(
          mockResponse(200, { access_token: 'sk-minted-2', expires_in: 7200 }),
        );
      const blob = await svc.refreshAccessToken('old-refresh');
      expect(blob.t).toBe('sk-minted-2');
      expect(blob.r).toBe('r2');
      expect(blob.e).toBe(Date.now() + 7200 * 1000);
    });

    it('retains the old refresh token when the server omits a new one', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, { id_token: 'id-2', access_token: 'a2', expires_in: 60 }),
        )
        .mockResolvedValueOnce(mockResponse(200, { access_token: 'sk-x', expires_in: 60 }));
      const blob = await svc.refreshAccessToken('old-refresh');
      expect(blob.r).toBe('old-refresh');
    });

    it('falls back to a 1h key lifetime when expires_in is missing', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, {
            id_token: 'id-3',
            access_token: 'a3',
            refresh_token: 'r3',
            expires_in: 60,
          }),
        )
        .mockResolvedValueOnce(mockResponse(200, { access_token: 'sk-3' }));
      const blob = await svc.refreshAccessToken('old-refresh');
      expect(blob.e).toBe(Date.now() + 3600 * 1000);
    });

    it('throws when the refresh endpoint returns a non-2xx status', async () => {
      fetchMock.mockResolvedValue(mockResponse(400, {}));
      await expect(svc.refreshAccessToken('r')).rejects.toThrow('Token refresh failed');
    });
  });

  describe('unwrapToken', () => {
    it('returns null for malformed blobs', async () => {
      expect(await svc.unwrapToken('not-json', 'a', 'u')).toBeNull();
      expect(await svc.unwrapToken(JSON.stringify({}), 'a', 'u')).toBeNull();
    });

    it('returns the cached access token when it is still valid', async () => {
      const blob = { t: 'access', r: 'refresh', e: Date.now() + 10 * 60 * 1000 };
      expect(await svc.unwrapToken(JSON.stringify(blob), 'a', 'u')).toBe('access');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes and persists a fresh blob when the token is near expiry', async () => {
      const blob = { t: 'old-key', r: 'rf', e: Date.now() + 30_000 }; // within the 60s skew window
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, {
            id_token: 'id-new',
            access_token: 'a-new',
            refresh_token: 'rf2',
            expires_in: 3600,
          }),
        )
        .mockResolvedValueOnce(mockResponse(200, { access_token: 'sk-fresh', expires_in: 3600 }));
      const token = await svc.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1');
      expect(token).toBe('sk-fresh');
      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'openai',
        expect.stringContaining('"t":"sk-fresh"'),
        'subscription',
      );
    });

    it('returns null when the refresh call fails', async () => {
      const blob = { t: 'old', r: 'rf', e: Date.now() + 1000 };
      fetchMock.mockRejectedValue(new Error('network'));
      expect(await svc.unwrapToken(JSON.stringify(blob), 'a', 'u')).toBeNull();
    });
  });

  describe('revokeToken', () => {
    it('POSTs the token to the revoke endpoint', async () => {
      fetchMock.mockResolvedValue(mockResponse(200, {}));
      await svc.revokeToken('tok');
      const [revokeUrl, init] = fetchMock.mock.calls[0];
      expect(revokeUrl).toBe('https://auth.openai.com/oauth/revoke');
      const body = new URLSearchParams(init.body.toString());
      expect(body.get('token')).toBe('tok');
    });

    it('silently logs when the revoke endpoint returns an error', async () => {
      fetchMock.mockResolvedValue(mockResponse(400, {}, 'bad_token'));
      await expect(svc.revokeToken('x')).resolves.toBeUndefined();
    });

    it('silently logs on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('network'));
      await expect(svc.revokeToken('x')).resolves.toBeUndefined();
    });
  });

  describe('clearPendingState', () => {
    it('removes a known pending state', async () => {
      const url = await svc.generateAuthorizationUrl('a', 'u');
      const state = new URL(url).searchParams.get('state')!;
      expect(svc.getPendingCount()).toBe(1);
      svc.clearPendingState(state);
      expect(svc.getPendingCount()).toBe(0);
    });
  });
});
