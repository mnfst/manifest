import { ConfigService } from '@nestjs/config';
import { GeminiOauthService, pickOnboardTierId } from './gemini-oauth.service';
import { ProviderService } from '../routing-core/provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';

const originalFetch = global.fetch;

function mockResponse(status: number, body: unknown, text = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text || JSON.stringify(body),
  } as unknown as Response;
}

function createConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: (key: string) => {
      if (key in overrides) return overrides[key];
      if (key === 'app.nodeEnv') return 'production';
      return undefined;
    },
  } as unknown as ConfigService;
}

function createProviderService() {
  const upsertProvider = jest.fn().mockResolvedValue({ provider: { id: 'p1' } });
  const recalculateTiers = jest.fn().mockResolvedValue(undefined);
  return {
    svc: { upsertProvider, recalculateTiers } as unknown as ProviderService,
    upsertProvider,
    recalculateTiers,
  };
}

function createDiscovery() {
  const discoverModels = jest.fn().mockResolvedValue(undefined);
  return { svc: { discoverModels } as unknown as ModelDiscoveryService, discoverModels };
}

describe('GeminiOauthService', () => {
  let fetchMock: jest.Mock;
  let providerService: ReturnType<typeof createProviderService>;
  let discovery: ReturnType<typeof createDiscovery>;
  let svc: GeminiOauthService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T12:00:00Z'));
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    providerService = createProviderService();
    discovery = createDiscovery();
    svc = new GeminiOauthService(
      providerService.svc,
      createConfig({
        GOOGLE_GEMINI_CLIENT_ID: 'test-client',
        GOOGLE_GEMINI_CLIENT_SECRET: 'test-secret',
      }),
      discovery.svc,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('generateAuthorizationUrl', () => {
    it('builds an OAuth URL with PKCE, offline access, and a fresh state', async () => {
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('access_type')).toBe('offline');
      expect(parsed.searchParams.get('prompt')).toBe('consent');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsed.searchParams.get('code_challenge')?.length).toBeGreaterThan(0);
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:1456/oauth/callback');
      expect(parsed.searchParams.get('scope')).toContain('cloud-platform');
      expect(svc.getPendingCount()).toBe(1);
    });

    it('uses operator-supplied client credentials when env vars are set', async () => {
      const customSvc = new GeminiOauthService(
        providerService.svc,
        createConfig({
          GOOGLE_GEMINI_CLIENT_ID: 'override-client',
          GOOGLE_GEMINI_CLIENT_SECRET: 'override-secret',
        }),
        discovery.svc,
      );
      const url = await customSvc.generateAuthorizationUrl('a', 'u');
      expect(new URL(url).searchParams.get('client_id')).toBe('override-client');
    });

    it('throws a helpful error when neither client id nor secret is configured', async () => {
      const unconfigured = new GeminiOauthService(
        providerService.svc,
        createConfig(),
        discovery.svc,
      );
      expect(unconfigured.isConfigured()).toBe(false);
      await expect(unconfigured.generateAuthorizationUrl('a', 'u')).rejects.toThrow(
        /GOOGLE_GEMINI_CLIENT_ID/,
      );
    });

    it('purges expired pending states on each call', async () => {
      await svc.generateAuthorizationUrl('a1', 'u1');
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);
      await svc.generateAuthorizationUrl('a2', 'u2');
      expect(svc.getPendingCount()).toBe(1);
    });
  });

  describe('exchangeCode', () => {
    it('rejects unknown states', async () => {
      await expect(svc.exchangeCode('bogus', 'code')).rejects.toThrow(
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

    it('exchanges a code, discovers the project id, and stores the blob', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, {
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            expires_in: 3600,
          }),
        )
        .mockResolvedValueOnce(
          mockResponse(200, { cloudaicompanionProject: 'proj-42', currentTier: { id: 'PRO' } }),
        );
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;

      await svc.exchangeCode(state, 'auth-code');

      const [tokenUrl, init] = fetchMock.mock.calls[0];
      expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
      const tokenBody = new URLSearchParams(init.body.toString());
      expect(tokenBody.get('grant_type')).toBe('authorization_code');
      expect(tokenBody.get('code')).toBe('auth-code');
      expect(tokenBody.get('client_secret')?.length).toBeGreaterThan(0);

      const [discoveryUrl] = fetchMock.mock.calls[1];
      expect(discoveryUrl).toBe('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist');

      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'gemini',
        expect.stringContaining('"u":"proj-42"'),
        'subscription',
      );
      expect(discovery.discoverModels).toHaveBeenCalled();
      expect(providerService.recalculateTiers).toHaveBeenCalledWith('agent-1');
      expect(svc.getPendingCount()).toBe(0);
    });

    it('onboards the user via LRO when no project exists yet', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, {
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            expires_in: 3600,
          }),
        )
        // loadCodeAssist returns no project
        .mockResolvedValueOnce(mockResponse(200, {}))
        // onboardUser returns a completed LRO
        .mockResolvedValueOnce(
          mockResponse(200, {
            done: true,
            response: { cloudaicompanionProject: { id: 'proj-new' } },
          }),
        );
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;

      await svc.exchangeCode(state, 'auth-code');

      expect(fetchMock.mock.calls[2][0]).toBe(
        'https://cloudcode-pa.googleapis.com/v1internal:onboardUser',
      );
      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'gemini',
        expect.stringContaining('"u":"proj-new"'),
        'subscription',
      );
    });

    it('rejects when Google omits a refresh_token', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(200, { access_token: 'access', expires_in: 3600 }),
      );
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'code')).rejects.toThrow(
        /did not return a refresh_token/,
      );
    });

    it('throws when the token endpoint returns an error', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(400, {}, 'invalid_grant'));
      const url = await svc.generateAuthorizationUrl('a', 'u');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'bad')).rejects.toThrow('Token exchange failed');
    });

    it('still stores the blob (without project) when discovery returns non-OK', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }),
        )
        .mockResolvedValueOnce(mockResponse(403, {}));
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'c')).resolves.toBeUndefined();
      const stored = providerService.upsertProvider.mock.calls[0][3] as string;
      expect(stored).not.toContain('"u":');
    });

    it('swallows model discovery errors so OAuth still completes', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }),
        )
        .mockResolvedValueOnce(mockResponse(200, { cloudaicompanionProject: 'proj' }));
      discovery.discoverModels.mockRejectedValue(new Error('boom'));
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'c')).resolves.toBeUndefined();
      expect(providerService.upsertProvider).toHaveBeenCalled();
    });

    it('treats an onboardUser network failure as no-project rather than crashing', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }),
        )
        .mockResolvedValueOnce(mockResponse(200, {}))
        .mockRejectedValueOnce(new Error('net'));
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'c')).resolves.toBeUndefined();
      const stored = providerService.upsertProvider.mock.calls[0][3] as string;
      expect(stored).not.toContain('"u":');
    });

    it('treats a loadCodeAssist network error as empty project', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }),
        )
        .mockRejectedValueOnce(new Error('dns failure'));
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;
      await expect(svc.exchangeCode(state, 'c')).resolves.toBeUndefined();
      const stored = providerService.upsertProvider.mock.calls[0][3] as string;
      expect(stored).not.toContain('"u":');
    });
  });

  describe('refreshAccessToken', () => {
    it('reuses the previous refresh token when Google omits a new one', async () => {
      fetchMock.mockResolvedValue(mockResponse(200, { access_token: 'a2', expires_in: 60 }));
      const blob = await svc.refreshAccessToken('old-refresh');
      expect(blob.r).toBe('old-refresh');
      expect(blob.e).toBe(Date.now() + 60 * 1000);
    });

    it('uses the rotated refresh token when Google sends one', async () => {
      fetchMock.mockResolvedValue(
        mockResponse(200, { access_token: 'a', refresh_token: 'rotated', expires_in: 60 }),
      );
      const blob = await svc.refreshAccessToken('old');
      expect(blob.r).toBe('rotated');
    });

    it('throws on non-2xx', async () => {
      fetchMock.mockResolvedValue(mockResponse(401, {}, 'expired_grant'));
      await expect(svc.refreshAccessToken('r')).rejects.toThrow('Token refresh failed');
    });
  });

  describe('unwrapToken', () => {
    it('returns null for malformed blobs', async () => {
      expect(await svc.unwrapToken('not-json', 'a', 'u')).toBeNull();
      expect(await svc.unwrapToken(JSON.stringify({}), 'a', 'u')).toBeNull();
    });

    it('returns the cached blob when the access token is still valid', async () => {
      const blob = {
        t: 'access',
        r: 'refresh',
        e: Date.now() + 10 * 60 * 1000,
        u: 'proj-1',
      };
      const result = await svc.unwrapToken(JSON.stringify(blob), 'a', 'u');
      expect(result).toEqual(blob);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes near-expiry tokens, persists, and preserves the project id', async () => {
      const blob = {
        t: 'old',
        r: 'rf',
        e: Date.now() + 30_000,
        u: 'proj-1',
      };
      fetchMock.mockResolvedValue(
        mockResponse(200, { access_token: 'new', refresh_token: 'rf2', expires_in: 3600 }),
      );
      const result = await svc.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1');
      expect(result?.t).toBe('new');
      expect(result?.u).toBe('proj-1');
      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'gemini',
        expect.stringContaining('"u":"proj-1"'),
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
      const [revokeUrl] = fetchMock.mock.calls[0];
      expect(revokeUrl).toBe('https://oauth2.googleapis.com/revoke?token=tok');
    });

    it('silently logs on non-2xx', async () => {
      fetchMock.mockResolvedValue(mockResponse(400, {}, 'bad'));
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

  describe('lazy project recovery in unwrapToken', () => {
    it('runs project discovery when the cached blob is missing it, then persists', async () => {
      const blob = {
        t: 'access',
        r: 'refresh',
        e: Date.now() + 10 * 60 * 1000,
        // no `u` field — the original onboarding 400'd, leaving us project-less
      };
      fetchMock.mockResolvedValueOnce(
        mockResponse(200, { cloudaicompanionProject: 'proj-recovered' }),
      );
      const result = await svc.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1');
      expect(result?.u).toBe('proj-recovered');
      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'gemini',
        expect.stringContaining('"u":"proj-recovered"'),
        'subscription',
      );
    });

    it('returns the original blob when lazy discovery still finds no project', async () => {
      const blob = { t: 'access', r: 'refresh', e: Date.now() + 10 * 60 * 1000 };
      // loadCodeAssist returns no project → onboardUser returns non-OK → ''
      fetchMock
        .mockResolvedValueOnce(mockResponse(200, {}))
        .mockResolvedValueOnce(mockResponse(500, {}));
      const result = await svc.unwrapToken(JSON.stringify(blob), 'a', 'u');
      expect(result?.u).toBeUndefined();
      // No persistence when nothing changed.
      expect(providerService.upsertProvider).not.toHaveBeenCalled();
    });
  });

  describe('onboardUser request shape', () => {
    it('sends the gateway-reported currentTier id', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }),
        )
        .mockResolvedValueOnce(mockResponse(200, { currentTier: { id: 'legacy-tier' } }))
        .mockResolvedValueOnce(
          mockResponse(200, {
            done: true,
            response: { cloudaicompanionProject: { id: 'proj' } },
          }),
        );
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;
      await svc.exchangeCode(state, 'code');

      const [, init] = fetchMock.mock.calls[2];
      const body = JSON.parse(init.body) as { tierId: string; cloudaicompanionProject?: string };
      expect(body.tierId).toBe('legacy-tier');
      expect(body.cloudaicompanionProject).toBeUndefined();
    });

    it('falls back to the default-flagged allowedTier when no currentTier is reported', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }),
        )
        .mockResolvedValueOnce(
          mockResponse(200, {
            allowedTiers: [{ id: 'legacy-tier' }, { id: 'free-tier', isDefault: true }],
          }),
        )
        .mockResolvedValueOnce(
          mockResponse(200, {
            done: true,
            response: { cloudaicompanionProject: { id: 'proj' } },
          }),
        );
      const url = await svc.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;
      await svc.exchangeCode(state, 'code');

      const body = JSON.parse(fetchMock.mock.calls[2][1].body) as { tierId: string };
      expect(body.tierId).toBe('free-tier');
    });
  });

  describe('pickOnboardTierId', () => {
    it('prefers currentTier.id over allowedTiers', () => {
      expect(pickOnboardTierId({ currentTier: { id: 'a' }, allowedTiers: [{ id: 'b' }] })).toBe(
        'a',
      );
    });

    it('falls back to default-flagged allowedTier', () => {
      expect(pickOnboardTierId({ allowedTiers: [{ id: 'b' }, { id: 'c', isDefault: true }] })).toBe(
        'c',
      );
    });

    it('falls back to first allowedTier when none flagged default', () => {
      expect(pickOnboardTierId({ allowedTiers: [{ id: 'b' }, { id: 'c' }] })).toBe('b');
    });

    it('falls back to standard-tier when nothing else is provided', () => {
      expect(pickOnboardTierId({})).toBe('standard-tier');
    });
  });

  describe('resolveCodeAssistProject', () => {
    it('returns the project when loadCodeAssist already has one', async () => {
      fetchMock.mockResolvedValue(mockResponse(200, { cloudaicompanionProject: 'proj-direct' }));
      const id = await svc.resolveCodeAssistProject('access');
      expect(id).toBe('proj-direct');
    });

    it('polls a pending LRO until done', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(200, {}))
        .mockResolvedValueOnce(mockResponse(200, { done: false, name: 'operations/abc' }))
        .mockResolvedValueOnce(
          mockResponse(200, {
            done: true,
            response: { cloudaicompanionProject: { id: 'proj-eventual' } },
          }),
        );
      const promise = svc.resolveCodeAssistProject('access');
      // Allow the polling timer to elapse.
      await jest.runAllTimersAsync();
      const id = await promise;
      expect(id).toBe('proj-eventual');
    });

    it('returns empty string when polling fails partway', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(200, {}))
        .mockResolvedValueOnce(mockResponse(200, { done: false, name: 'operations/x' }))
        .mockResolvedValueOnce(mockResponse(500, {}));
      const promise = svc.resolveCodeAssistProject('access');
      await jest.runAllTimersAsync();
      expect(await promise).toBe('');
    });
  });
});
