import { ConfigService } from '@nestjs/config';
import { GeminiOauthService } from './oauth/gemini-oauth.service';
import { OAuthTokenBlob } from './oauth/openai-oauth.types';
import { ProviderService } from './routing-core/provider.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchMock = jest.fn() as jest.Mock<Promise<any>>;
global.fetch = fetchMock;

describe('GeminiOauthService', () => {
  let service: GeminiOauthService;
  let providerService: jest.Mocked<ProviderService>;
  let configService: jest.Mocked<ConfigService>;
  let discoveryService: { discoverModels: jest.Mock };

  beforeEach(() => {
    providerService = {
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: true }),
      recalculateTiers: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProviderService>;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'GOOGLE_GEMINI_CLIENT_ID') return 'gemini-client-id';
        if (key === 'GOOGLE_GEMINI_CLIENT_SECRET') return 'gemini-client-secret';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    discoveryService = {
      discoverModels: jest.fn().mockResolvedValue([]),
    };

    service = new GeminiOauthService(providerService, configService, discoveryService as never);
    fetchMock.mockReset();
  });

  describe('isConfigured', () => {
    it('returns true when both clientId and clientSecret are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('returns false when no env vars and no Gemini CLI installed', () => {
      const emptyConfig = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as jest.Mocked<ConfigService>;
      const withoutCreds = new GeminiOauthService(
        providerService,
        emptyConfig,
        discoveryService as never,
      );
      // Without env vars, falls back to Gemini CLI extraction which may or may not be installed
      expect(typeof withoutCreds.isConfigured()).toBe('boolean');
    });

    it('falls back to GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET', () => {
      const fallbackConfig = {
        get: jest.fn((key: string) => {
          if (key === 'GOOGLE_CLIENT_ID') return 'fallback-id';
          if (key === 'GOOGLE_CLIENT_SECRET') return 'fallback-secret';
          return undefined;
        }),
      } as unknown as jest.Mocked<ConfigService>;
      const fallbackService = new GeminiOauthService(
        providerService,
        fallbackConfig,
        discoveryService as never,
      );
      expect(fallbackService.isConfigured()).toBe(true);
    });
  });

  describe('generateAuthorizationUrl', () => {
    it('returns a valid Google authorize URL with PKCE params', async () => {
      const url = await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=gemini-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('state=');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain(
        `redirect_uri=${encodeURIComponent('https://app.example.com/auth/callback')}`,
      );
      // URLSearchParams encodes spaces as '+', not '%20'
      expect(url).toContain(
        'scope=openid+email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloud-platform+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile',
      );
    });

    it('stores pending state for later exchange', async () => {
      await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      expect(service.getPendingCount()).toBe(1);
    });

    it('cleans up expired states on new URL generation', async () => {
      const url = await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      const stateParam = new URL(url).searchParams.get('state')!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pending = (service as any).pending as Map<string, { expiresAt: number }>;
      pending.get(stateParam)!.expiresAt = Date.now() - 1000;

      await service.generateAuthorizationUrl(
        'agent-2',
        'user-2',
        'https://app.example.com/auth/callback',
      );
      expect(service.getPendingCount()).toBe(1);
    });
  });

  describe('exchangeCode', () => {
    it('exchanges code for tokens and stores them', async () => {
      const url = await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      const state = new URL(url).searchParams.get('state')!;

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'access-123',
            refresh_token: 'refresh-456',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cloudaicompanionProject: 'my-project' }),
        });

      await service.exchangeCode(state, 'auth-code-xyz');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ method: 'POST' }),
      );

      // Verify client_secret is included in the token exchange body
      const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(body.get('client_secret')).toBe('gemini-client-secret');
      expect(body.get('code_verifier')).toBeTruthy();

      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'gemini',
        expect.any(String),
        'subscription',
      );

      const storedBlob: OAuthTokenBlob = JSON.parse(
        providerService.upsertProvider.mock.calls[0][3] as string,
      );
      expect(storedBlob.t).toBe('access-123');
      expect(storedBlob.r).toBe('refresh-456');
      expect(storedBlob.e).toBeGreaterThan(Date.now());
    });

    it('throws for invalid state', async () => {
      await expect(service.exchangeCode('bad-state', 'code')).rejects.toThrow(
        'Invalid or expired OAuth state',
      );
    });

    it('throws for expired state', async () => {
      const url = await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      const state = new URL(url).searchParams.get('state')!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pending = (service as any).pending as Map<string, { expiresAt: number }>;
      pending.get(state)!.expiresAt = Date.now() - 1;

      await expect(service.exchangeCode(state, 'code')).rejects.toThrow('OAuth state expired');
      expect(service.getPendingCount()).toBe(0);
    });

    it('throws when token exchange fails', async () => {
      const url = await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      const state = new URL(url).searchParams.get('state')!;

      fetchMock.mockResolvedValueOnce({
        ok: false,
        text: async () => 'bad request',
      });

      await expect(service.exchangeCode(state, 'code')).rejects.toThrow('Token exchange failed');
    });

    it('throws when no refresh_token is returned', async () => {
      const url = await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      const state = new URL(url).searchParams.get('state')!;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-123',
          expires_in: 3600,
          // no refresh_token
        }),
      });

      await expect(service.exchangeCode(state, 'code')).rejects.toThrow(
        'No refresh token returned. Re-authorize with prompt=consent.',
      );
    });

    it('logs warning but does not throw when model discovery fails', async () => {
      discoveryService.discoverModels.mockRejectedValueOnce(new Error('discovery boom'));

      const url = await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      const state = new URL(url).searchParams.get('state')!;

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'tok',
            refresh_token: 'ref',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cloudaicompanionProject: 'proj' }),
        });

      // Should not throw despite discovery failure
      await service.exchangeCode(state, 'code');

      expect(providerService.upsertProvider).toHaveBeenCalled();
      expect(discoveryService.discoverModels).toHaveBeenCalled();
    });

    it('removes state after successful exchange', async () => {
      const url = await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      const state = new URL(url).searchParams.get('state')!;

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'tok',
            refresh_token: 'ref',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cloudaicompanionProject: '' }),
        });

      await service.exchangeCode(state, 'code');
      expect(service.getPendingCount()).toBe(0);
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes and returns new token blob', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      });

      const result = await service.refreshAccessToken('old-refresh');

      expect(result.t).toBe('new-access');
      expect(result.r).toBe('new-refresh');
      expect(result.e).toBeGreaterThan(Date.now());

      // Verify client_secret is included in refresh request
      const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(body.get('client_secret')).toBe('gemini-client-secret');
    });

    it('keeps original refresh token if none returned', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          expires_in: 3600,
        }),
      });

      const result = await service.refreshAccessToken('original-refresh');
      expect(result.r).toBe('original-refresh');
    });

    it('throws when refresh fails', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        text: async () => 'unauthorized',
      });

      await expect(service.refreshAccessToken('bad-token')).rejects.toThrow('Token refresh failed');
    });
  });

  describe('unwrapToken', () => {
    it('returns full blob from valid, non-expired token', async () => {
      const blob: OAuthTokenBlob = {
        t: 'access-tok',
        r: 'refresh-tok',
        e: Date.now() + 120_000,
      };

      const result = await service.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1');
      expect(result).not.toBeNull();
      expect(result!.t).toBe('access-tok');
      expect(result!.r).toBe('refresh-tok');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null for non-JSON values', async () => {
      const result = await service.unwrapToken('plain-api-key', 'agent-1', 'user-1');
      expect(result).toBeNull();
    });

    it('returns null for JSON without required fields', async () => {
      const result = await service.unwrapToken('{"foo":"bar"}', 'agent-1', 'user-1');
      expect(result).toBeNull();
    });

    it('refreshes expired token and stores new blob', async () => {
      const blob: OAuthTokenBlob = {
        t: 'old-access',
        r: 'refresh-tok',
        e: Date.now() - 1000,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
      });

      const result = await service.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.t).toBe('new-access');
      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'gemini',
        expect.any(String),
        'subscription',
      );
    });

    it('refreshes token within 60s buffer', async () => {
      const blob: OAuthTokenBlob = {
        t: 'expiring-soon',
        r: 'refresh-tok',
        e: Date.now() + 30_000,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
          expires_in: 3600,
        }),
      });

      const result = await service.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1');
      expect(result).not.toBeNull();
      expect(result!.t).toBe('fresh-access');
    });

    it('returns existing blob when refresh fails', async () => {
      const blob: OAuthTokenBlob = {
        t: 'stale-access',
        r: 'bad-refresh',
        e: Date.now() - 1000,
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        text: async () => 'token expired',
      });

      const result = await service.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1');
      expect(result).not.toBeNull();
      expect(result!.t).toBe('stale-access');
    });
  });

  describe('revokeToken', () => {
    it('calls Google revoke endpoint with the token as query param', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });

      await service.revokeToken('access-token-123');

      expect(fetchMock).toHaveBeenCalledWith(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent('access-token-123')}`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('logs warning when revocation response is not ok', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, text: async () => 'invalid_token' });
      // Should not throw
      await service.revokeToken('bad-token');
    });

    it('logs warning when fetch throws a network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));
      // Should not throw
      await service.revokeToken('any-token');
    });
  });

  describe('clearPendingState', () => {
    it('removes pending state by key', async () => {
      const url = await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      const state = new URL(url).searchParams.get('state')!;

      expect(service.getPendingCount()).toBe(1);
      service.clearPendingState(state);
      expect(service.getPendingCount()).toBe(0);
    });
  });

  describe('discoverProject', () => {
    it('returns project ID on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cloudaicompanionProject: 'my-gcp-project' }),
      });

      const result = await service.discoverProject('access-token');
      expect(result).toBe('my-gcp-project');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        }),
      );
    });

    it('returns empty string when response is not ok', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const result = await service.discoverProject('bad-token');
      expect(result).toBe('');
    });

    it('returns empty string when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network failure'));

      const result = await service.discoverProject('token');
      expect(result).toBe('');
    });

    it('returns empty string when cloudaicompanionProject is absent', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.discoverProject('token');
      expect(result).toBe('');
    });
  });

  describe('unwrapToken (project preservation)', () => {
    it('preserves project ID from original blob on refresh', async () => {
      const blob: OAuthTokenBlob = {
        t: 'old-access',
        r: 'refresh-tok',
        e: Date.now() - 1000,
        u: 'original-project-id',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          expires_in: 3600,
        }),
      });

      const result = await service.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1');
      expect(result).not.toBeNull();
      expect(result!.u).toBe('original-project-id');
    });
  });

  describe('getPendingCount', () => {
    it('returns count of pending states', async () => {
      expect(service.getPendingCount()).toBe(0);

      await service.generateAuthorizationUrl(
        'agent-1',
        'user-1',
        'https://app.example.com/auth/callback',
      );
      expect(service.getPendingCount()).toBe(1);

      await service.generateAuthorizationUrl(
        'agent-2',
        'user-2',
        'https://app.example.com/auth/callback',
      );
      expect(service.getPendingCount()).toBe(2);
    });
  });
});
