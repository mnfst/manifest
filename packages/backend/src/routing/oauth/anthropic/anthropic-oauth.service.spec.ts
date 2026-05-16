import { ProviderService } from '../../routing-core/provider.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { AnthropicOauthService, splitAnthropicAuthPayload } from './anthropic-oauth.service';
import { ANTHROPIC_OAUTH } from './anthropic-oauth.config';

const originalFetch = global.fetch;

function mockResponse(status: number, body: unknown, text = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text || JSON.stringify(body),
  } as unknown as Response;
}

function createProviderService() {
  const upsertProvider = jest.fn().mockResolvedValue({ provider: { id: 'p1' } });
  const recalculateTiers = jest.fn().mockResolvedValue(undefined);
  const nextOAuthLabel = jest.fn().mockResolvedValue(undefined);
  return {
    svc: { upsertProvider, recalculateTiers, nextOAuthLabel } as unknown as ProviderService,
    upsertProvider,
    recalculateTiers,
    nextOAuthLabel,
  };
}

function createDiscovery(): { svc: ModelDiscoveryService; discoverModels: jest.Mock } {
  const discoverModels = jest.fn().mockResolvedValue(undefined);
  return { svc: { discoverModels } as unknown as ModelDiscoveryService, discoverModels };
}

describe('splitAnthropicAuthPayload', () => {
  it('returns the bare code when no state suffix is present', () => {
    expect(splitAnthropicAuthPayload('abc123')).toEqual({ code: 'abc123' });
  });

  it('splits `<code>#<state>` into separate parts', () => {
    expect(splitAnthropicAuthPayload('abc#xyz')).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('treats a trailing # as no state', () => {
    expect(splitAnthropicAuthPayload('abc#')).toEqual({ code: 'abc', state: undefined });
  });

  it('trims surrounding whitespace from pasted input', () => {
    expect(splitAnthropicAuthPayload('  abc#xyz  ')).toEqual({ code: 'abc', state: 'xyz' });
  });
});

describe('AnthropicOauthService', () => {
  let fetchMock: jest.Mock;
  let providerService: ReturnType<typeof createProviderService>;
  let discovery: ReturnType<typeof createDiscovery>;
  let svc: AnthropicOauthService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T12:00:00Z'));
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    providerService = createProviderService();
    discovery = createDiscovery();
    svc = new AnthropicOauthService(providerService.svc, discovery.svc);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('generateAuthorizationUrl', () => {
    it('builds a Claude.ai authorize URL with PKCE S256 challenge and tracks pending state', () => {
      const { url, state } = svc.generateAuthorizationUrl('agent-1', 'user-1');
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(ANTHROPIC_OAUTH.AUTHORIZE_URL);
      expect(parsed.searchParams.get('client_id')).toBe(ANTHROPIC_OAUTH.CLIENT_ID);
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('redirect_uri')).toBe(ANTHROPIC_OAUTH.REDIRECT_URI);
      expect(parsed.searchParams.get('scope')).toBe(ANTHROPIC_OAUTH.SCOPE);
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsed.searchParams.get('code_challenge')?.length).toBeGreaterThan(0);
      expect(parsed.searchParams.get('state')).toBe(state);
      expect(svc.getPendingCount()).toBe(1);
    });
  });

  describe('exchangeCode', () => {
    it('rejects when no code is supplied', async () => {
      await expect(svc.exchangeCode('', 'state')).rejects.toThrow('Missing authorization code');
    });

    it('rejects when no state is supplied', async () => {
      await expect(svc.exchangeCode('code', undefined)).rejects.toThrow('Missing OAuth state');
    });

    it('rejects unknown states', async () => {
      await expect(svc.exchangeCode('code#bogus')).rejects.toThrow(
        'Invalid or expired OAuth state',
      );
    });

    it('rejects (and purges) expired states', async () => {
      const { state } = svc.generateAuthorizationUrl('a', 'u');
      jest.advanceTimersByTime(ANTHROPIC_OAUTH.STATE_TTL_MS + 1);
      await expect(svc.exchangeCode(`code#${state}`)).rejects.toThrow('OAuth state expired');
      expect(svc.getPendingCount()).toBe(0);
    });

    it('exchanges a valid code, stores the blob, and triggers model discovery', async () => {
      fetchMock.mockResolvedValue(
        mockResponse(200, {
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
        }),
      );
      const { state } = svc.generateAuthorizationUrl('agent-1', 'user-1');

      await svc.exchangeCode(`auth-code#${state}`);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [tokenUrl, init] = fetchMock.mock.calls[0];
      expect(tokenUrl).toBe(ANTHROPIC_OAUTH.TOKEN_URL);
      const body = JSON.parse(init.body);
      expect(body.grant_type).toBe('authorization_code');
      expect(body.code).toBe('auth-code');
      expect(body.state).toBe(state);
      expect(body.code_verifier?.length).toBeGreaterThan(0);

      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'anthropic',
        expect.stringContaining('"t":"access-1"'),
        'subscription',
        undefined,
        undefined,
      );
      expect(discovery.discoverModels).toHaveBeenCalled();
      expect(providerService.recalculateTiers).toHaveBeenCalledWith('agent-1');
      expect(svc.getPendingCount()).toBe(0);
    });

    it('accepts the code and state passed separately', async () => {
      fetchMock.mockResolvedValue(
        mockResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }),
      );
      const { state } = svc.generateAuthorizationUrl('a', 'u');
      await svc.exchangeCode('plain-code', state);
      expect(providerService.upsertProvider).toHaveBeenCalled();
    });

    it('throws when the token endpoint returns an error', async () => {
      fetchMock.mockResolvedValue(mockResponse(400, {}, 'invalid_grant'));
      const { state } = svc.generateAuthorizationUrl('a', 'u');
      await expect(svc.exchangeCode(`bad#${state}`)).rejects.toThrow('Token exchange failed');
    });

    it('stores an empty refresh token when Anthropic omits one in the response', async () => {
      // No refresh_token field — defensive fallback exercises the `?? ''`.
      fetchMock.mockResolvedValue(mockResponse(200, { access_token: 'a', expires_in: 60 }));
      const { state } = svc.generateAuthorizationUrl('a', 'u');
      await svc.exchangeCode(`c#${state}`);
      const stored = providerService.upsertProvider.mock.calls[0][3] as string;
      expect(JSON.parse(stored).r).toBe('');
    });

    it('swallows discovery errors so the OAuth save is not rolled back', async () => {
      fetchMock.mockResolvedValue(
        mockResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: 60 }),
      );
      discovery.discoverModels.mockRejectedValue(new Error('boom'));
      const { state } = svc.generateAuthorizationUrl('a', 'u');
      await expect(svc.exchangeCode(`c#${state}`)).resolves.toBeUndefined();
      expect(providerService.upsertProvider).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('returns a fresh blob with a new expiry', async () => {
      fetchMock.mockResolvedValue(
        mockResponse(200, { access_token: 'a2', refresh_token: 'r2', expires_in: 1800 }),
      );
      const blob = await svc.refreshAccessToken('old-refresh');
      expect(blob).toEqual({ t: 'a2', r: 'r2', e: Date.now() + 1800 * 1000 });
    });

    it('retains the old refresh token when the server omits a new one', async () => {
      fetchMock.mockResolvedValue(mockResponse(200, { access_token: 'a2', expires_in: 60 }));
      const blob = await svc.refreshAccessToken('old');
      expect(blob.r).toBe('old');
    });

    it('throws when the refresh endpoint returns a non-2xx status', async () => {
      fetchMock.mockResolvedValue(mockResponse(400, {}));
      await expect(svc.refreshAccessToken('r')).rejects.toThrow('Token refresh failed');
    });
  });

  describe('unwrapToken', () => {
    it('returns the raw value when it is not an OAuth blob (legacy setup-token)', async () => {
      expect(await svc.unwrapToken('sk-ant-oat01-legacy', 'a', 'u')).toBe('sk-ant-oat01-legacy');
    });

    it('returns null when given an empty string', async () => {
      expect(await svc.unwrapToken('', 'a', 'u')).toBeNull();
    });

    it('returns the cached access token when it is still valid', async () => {
      const blob = JSON.stringify({ t: 'access', r: 'refresh', e: Date.now() + 10 * 60_000 });
      expect(await svc.unwrapToken(blob, 'a', 'u')).toBe('access');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes and persists a fresh blob when the token is near expiry', async () => {
      const blob = JSON.stringify({ t: 'old', r: 'rf', e: Date.now() + 30_000 });
      fetchMock.mockResolvedValue(
        mockResponse(200, { access_token: 'new', refresh_token: 'rf2', expires_in: 3600 }),
      );
      const token = await svc.unwrapToken(blob, 'agent-1', 'user-1');
      expect(token).toBe('new');
      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'anthropic',
        expect.stringContaining('"t":"new"'),
        'subscription',
      );
    });

    it('returns the access token unchanged when the blob has no refresh token', async () => {
      const blob = JSON.stringify({ t: 'access', r: '', e: Date.now() + 30_000 });
      expect(await svc.unwrapToken(blob, 'a', 'u')).toBe('access');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null when the refresh call fails', async () => {
      const blob = JSON.stringify({ t: 'old', r: 'rf', e: Date.now() + 1_000 });
      fetchMock.mockRejectedValue(new Error('network'));
      expect(await svc.unwrapToken(blob, 'a', 'u')).toBeNull();
    });
  });

  describe('clearPendingState', () => {
    it('removes a known pending state', () => {
      const { state } = svc.generateAuthorizationUrl('a', 'u');
      expect(svc.getPendingCount()).toBe(1);
      svc.clearPendingState(state);
      expect(svc.getPendingCount()).toBe(0);
    });
  });

  describe('findPendingForAgent', () => {
    it('returns the active state when one exists for the agent', () => {
      const { state } = svc.generateAuthorizationUrl('agent-1', 'user-1');
      expect(svc.findPendingForAgent('agent-1')).toEqual({ state });
    });

    it('returns null when no flow is pending for the agent', () => {
      expect(svc.findPendingForAgent('agent-1')).toBeNull();
    });

    it('skips entries belonging to other agents', () => {
      svc.generateAuthorizationUrl('other-agent', 'user-1');
      expect(svc.findPendingForAgent('agent-1')).toBeNull();
    });
  });
});
