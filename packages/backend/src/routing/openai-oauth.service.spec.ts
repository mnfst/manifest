import { createServer } from 'http';
import { OpenaiOauthService, OAuthTokenBlob } from './openai-oauth.service';
import { RoutingService } from './routing.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchMock = jest.fn() as jest.Mock<Promise<any>>;
global.fetch = fetchMock;

// Stub createServerMock so the callback server never actually binds a port
jest.mock('http', () => {
  const actual = jest.requireActual('http');
  return {
    ...actual,
    createServer: jest.fn(() => ({
      listen: jest.fn((_port: number, _host: string, cb?: () => void) => cb?.()),
      close: jest.fn(),
      on: jest.fn(),
      unref: jest.fn(),
    })),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createServerMock = createServer as unknown as jest.Mock<any>;

describe('OpenaiOauthService', () => {
  let service: OpenaiOauthService;
  let routingService: jest.Mocked<RoutingService>;

  beforeEach(() => {
    routingService = {
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: true }),
    } as unknown as jest.Mocked<RoutingService>;

    service = new OpenaiOauthService(routingService);
    fetchMock.mockReset();
  });

  afterEach(() => {
    // Force-clear internal callback server ref to avoid cross-test leaks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).callbackServer = null;
  });

  describe('generateAuthorizationUrl', () => {
    it('returns a valid OpenAI authorize URL with PKCE params', () => {
      const url = service.generateAuthorizationUrl('agent-1', 'user-1');

      expect(url).toContain('https://auth.openai.com/oauth/authorize');
      expect(url).toContain('client_id=app_EMoamEEZ73f0CkXaXp7hrann');
      expect(url).toContain('response_type=code');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('state=');
      expect(url).toContain(
        `redirect_uri=${encodeURIComponent('http://localhost:1455/auth/callback')}`,
      );
      expect(url).toContain('scope=openid+profile+email+offline_access');
    });

    it('stores pending state for later exchange', () => {
      service.generateAuthorizationUrl('agent-1', 'user-1');
      expect(service.getPendingCount()).toBe(1);
    });

    it('cleans up expired states on new URL generation', () => {
      const url = service.generateAuthorizationUrl('agent-1', 'user-1');
      const stateParam = new URL(url).searchParams.get('state')!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pending = (service as any).pending as Map<string, { expiresAt: number }>;
      pending.get(stateParam)!.expiresAt = Date.now() - 1000;

      service.generateAuthorizationUrl('agent-2', 'user-2');
      expect(service.getPendingCount()).toBe(1);
    });
  });

  describe('exchangeCode', () => {
    it('exchanges code for tokens and stores them', async () => {
      const url = service.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires_in: 3600,
        }),
      });

      await service.exchangeCode(state, 'auth-code-xyz');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://auth.openai.com/oauth/token',
        expect.objectContaining({ method: 'POST' }),
      );

      expect(routingService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'openai',
        expect.any(String),
        'subscription',
      );

      const storedBlob: OAuthTokenBlob = JSON.parse(
        routingService.upsertProvider.mock.calls[0][3] as string,
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
      const url = service.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pending = (service as any).pending as Map<string, { expiresAt: number }>;
      pending.get(state)!.expiresAt = Date.now() - 1;

      await expect(service.exchangeCode(state, 'code')).rejects.toThrow('OAuth state expired');
      expect(service.getPendingCount()).toBe(0);
    });

    it('throws when token exchange fails', async () => {
      const url = service.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;

      fetchMock.mockResolvedValueOnce({
        ok: false,
        text: async () => 'bad request',
      });

      await expect(service.exchangeCode(state, 'code')).rejects.toThrow('Token exchange failed');
    });

    it('removes state after successful exchange', async () => {
      const url = service.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'tok',
          refresh_token: 'ref',
          expires_in: 3600,
        }),
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
    it('returns access token from valid, non-expired blob', async () => {
      const blob: OAuthTokenBlob = {
        t: 'access-tok',
        r: 'refresh-tok',
        e: Date.now() + 120_000,
      };

      const result = await service.unwrapToken(JSON.stringify(blob), 'agent-1', 'user-1');
      expect(result).toBe('access-tok');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null for non-JSON values', async () => {
      const result = await service.unwrapToken('sk-plain-api-key', 'agent-1', 'user-1');
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

      expect(result).toBe('new-access');
      expect(routingService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'openai',
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
      expect(result).toBe('fresh-access');
    });

    it('returns existing token when refresh fails', async () => {
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
      expect(result).toBe('stale-access');
    });
  });

  describe('callback server', () => {
    it('starts callback server on first URL generation', () => {
      service.generateAuthorizationUrl('agent-1', 'user-1');
      expect(createServerMock).toHaveBeenCalled();
    });

    it('does not start a second server when one is already running', () => {
      service.generateAuthorizationUrl('agent-1', 'user-1');
      const callCount = createServerMock.mock.calls.length;
      service.generateAuthorizationUrl('agent-2', 'user-2');
      expect(createServerMock.mock.calls.length).toBe(callCount);
    });

    it('shuts down callback server after last exchange completes', async () => {
      service.generateAuthorizationUrl('agent-1', 'user-1');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const server = (service as any).callbackServer;

      const url = service.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;

      // Remove extra pending entries so only one remains
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pending = (service as any).pending as Map<string, unknown>;
      const keys = [...pending.keys()];
      for (const k of keys) {
        if (k !== state) pending.delete(k);
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'tok',
          refresh_token: 'ref',
          expires_in: 3600,
        }),
      });

      await service.exchangeCode(state, 'code');
      expect(server.close).toHaveBeenCalled();
    });

    it('handles EADDRINUSE gracefully', () => {
      let errorHandler: (err: NodeJS.ErrnoException) => void;
      createServerMock.mockReturnValueOnce({
        listen: jest.fn(),
        close: jest.fn(),
        on: jest.fn((_event: string, handler: (err: NodeJS.ErrnoException) => void) => {
          errorHandler = handler;
        }),
        unref: jest.fn(),
      });

      // Reset internal server ref so a fresh server is created
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).callbackServer = null;
      service.generateAuthorizationUrl('agent-1', 'user-1');

      // Simulate EADDRINUSE
      const err = new Error('Port in use') as NodeJS.ErrnoException;
      err.code = 'EADDRINUSE';
      errorHandler!(err);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).callbackServer).toBeNull();
    });

    it('handles non-EADDRINUSE server errors', () => {
      let errorHandler: (err: NodeJS.ErrnoException) => void;
      createServerMock.mockReturnValueOnce({
        listen: jest.fn(),
        close: jest.fn(),
        on: jest.fn((_event: string, handler: (err: NodeJS.ErrnoException) => void) => {
          errorHandler = handler;
        }),
        unref: jest.fn(),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).callbackServer = null;
      service.generateAuthorizationUrl('agent-1', 'user-1');

      const err = new Error('Random error') as NodeJS.ErrnoException;
      err.code = 'ECONNREFUSED';
      errorHandler!(err);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).callbackServer).toBeNull();
    });

    it('callback server handles requests on /auth/callback', async () => {
      let requestHandler: (req: unknown, res: unknown) => void;
      createServerMock.mockImplementationOnce((handler: (req: unknown, res: unknown) => void) => {
        requestHandler = handler;
        return {
          listen: jest.fn((_p: number, _h: string, cb?: () => void) => cb?.()),
          close: jest.fn(),
          on: jest.fn(),
          unref: jest.fn(),
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).callbackServer = null;
      const url = service.generateAuthorizationUrl('agent-1', 'user-1');
      const state = new URL(url).searchParams.get('state')!;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'tok',
          refresh_token: 'ref',
          expires_in: 3600,
        }),
      });

      const res = { writeHead: jest.fn(), end: jest.fn() };
      requestHandler!({ url: `/auth/callback?code=the-code&state=${state}` }, res);

      // Wait for async exchange
      await new Promise((r) => setTimeout(r, 50));
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-success'));
    });

    it('callback server returns 404 for non-callback paths', () => {
      let requestHandler: (req: unknown, res: unknown) => void;
      createServerMock.mockImplementationOnce((handler: (req: unknown, res: unknown) => void) => {
        requestHandler = handler;
        return {
          listen: jest.fn((_p: number, _h: string, cb?: () => void) => cb?.()),
          close: jest.fn(),
          on: jest.fn(),
          unref: jest.fn(),
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).callbackServer = null;
      service.generateAuthorizationUrl('agent-1', 'user-1');

      const res = { writeHead: jest.fn(), end: jest.fn() };
      requestHandler!({ url: '/some/other/path' }, res);

      expect(res.writeHead).toHaveBeenCalledWith(404);
      expect(res.end).toHaveBeenCalledWith('Not found');
    });

    it('callback server returns error HTML on exchange failure', async () => {
      let requestHandler: (req: unknown, res: unknown) => void;
      createServerMock.mockImplementationOnce((handler: (req: unknown, res: unknown) => void) => {
        requestHandler = handler;
        return {
          listen: jest.fn((_p: number, _h: string, cb?: () => void) => cb?.()),
          close: jest.fn(),
          on: jest.fn(),
          unref: jest.fn(),
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).callbackServer = null;
      service.generateAuthorizationUrl('agent-1', 'user-1');

      const res = { writeHead: jest.fn(), end: jest.fn() };
      // Use an invalid state to trigger an error
      requestHandler!({ url: '/auth/callback?code=code&state=invalid-state' }, res);

      await new Promise((r) => setTimeout(r, 50));
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-error'));
    });

    it('callback server redirects to backendUrl on success when set', async () => {
      let requestHandler: (req: unknown, res: unknown) => void;
      createServerMock.mockImplementationOnce((handler: (req: unknown, res: unknown) => void) => {
        requestHandler = handler;
        return {
          listen: jest.fn((_p: number, _h: string, cb?: () => void) => cb?.()),
          close: jest.fn(),
          on: jest.fn(),
          unref: jest.fn(),
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).callbackServer = null;
      const url = service.generateAuthorizationUrl('agent-1', 'user-1', 'http://localhost:34379');
      const state = new URL(url).searchParams.get('state')!;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'tok',
          refresh_token: 'ref',
          expires_in: 3600,
        }),
      });

      const res = { writeHead: jest.fn(), end: jest.fn() };
      requestHandler!({ url: `/auth/callback?code=the-code&state=${state}` }, res);

      await new Promise((r) => setTimeout(r, 50));
      expect(res.writeHead).toHaveBeenCalledWith(302, {
        Location: 'http://localhost:34379/api/v1/oauth/openai/done?ok=1',
      });
      expect(res.end).toHaveBeenCalled();
    });

    it('callback server redirects to backendUrl on failure when set', async () => {
      let requestHandler: (req: unknown, res: unknown) => void;
      createServerMock.mockImplementationOnce((handler: (req: unknown, res: unknown) => void) => {
        requestHandler = handler;
        return {
          listen: jest.fn((_p: number, _h: string, cb?: () => void) => cb?.()),
          close: jest.fn(),
          on: jest.fn(),
          unref: jest.fn(),
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).callbackServer = null;
      const url = service.generateAuthorizationUrl('agent-1', 'user-1', 'http://localhost:34379');
      const state = new URL(url).searchParams.get('state')!;

      fetchMock.mockResolvedValueOnce({
        ok: false,
        text: async () => 'bad request',
      });

      const res = { writeHead: jest.fn(), end: jest.fn() };
      requestHandler!({ url: `/auth/callback?code=code&state=${state}` }, res);

      await new Promise((r) => setTimeout(r, 50));
      expect(res.writeHead).toHaveBeenCalledWith(302, {
        Location: 'http://localhost:34379/api/v1/oauth/openai/done?ok=0',
      });
    });
  });
});
