import { GeminiAuthService } from './gemini-auth.service';

describe('GeminiAuthService', () => {
  let service: GeminiAuthService;
  const origEnv = { ...process.env };

  beforeEach(() => {
    service = new GeminiAuthService();
    process.env['GOOGLE_GEMINI_CLIENT_ID'] = '';
    process.env['GOOGLE_GEMINI_CLIENT_SECRET'] = '';
    process.env['GOOGLE_CLIENT_ID'] = '';
    process.env['GOOGLE_CLIENT_SECRET'] = '';
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  describe('getClientId', () => {
    it('returns GOOGLE_GEMINI_CLIENT_ID when set', () => {
      process.env['GOOGLE_GEMINI_CLIENT_ID'] = 'gemini-id';
      process.env['GOOGLE_CLIENT_ID'] = 'generic-id';
      expect(service.getClientId()).toBe('gemini-id');
    });

    it('falls back to GOOGLE_CLIENT_ID', () => {
      process.env['GOOGLE_GEMINI_CLIENT_ID'] = '';
      process.env['GOOGLE_CLIENT_ID'] = 'generic-id';
      expect(service.getClientId()).toBe('generic-id');
    });

    it('returns empty string when nothing set', () => {
      expect(service.getClientId()).toBe('');
    });
  });

  describe('isConfigured', () => {
    it('returns false when client id is missing', () => {
      process.env['GOOGLE_CLIENT_SECRET'] = 'secret';
      expect(service.isConfigured()).toBe(false);
    });

    it('returns false when client secret is missing', () => {
      process.env['GOOGLE_CLIENT_ID'] = 'id';
      expect(service.isConfigured()).toBe(false);
    });

    it('returns true when both are set', () => {
      process.env['GOOGLE_CLIENT_ID'] = 'id';
      process.env['GOOGLE_CLIENT_SECRET'] = 'secret';
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('buildAuthUrl', () => {
    it('returns a URL with the correct parameters', () => {
      process.env['GOOGLE_CLIENT_ID'] = 'test-client-id';
      const url = service.buildAuthUrl('http://localhost/callback', 'test-state');
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
      expect(url).toContain('state=test-state');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('response_type=code');
    });
  });

  describe('generateState', () => {
    it('returns a 32-character hex string', () => {
      const state = service.generateState();
      expect(state).toMatch(/^[a-f0-9]{32}$/);
    });

    it('returns unique values', () => {
      const a = service.generateState();
      const b = service.generateState();
      expect(a).not.toBe(b);
    });
  });

  describe('exchangeCode', () => {
    it('throws when token exchange fails', async () => {
      process.env['GOOGLE_CLIENT_ID'] = 'id';
      process.env['GOOGLE_CLIENT_SECRET'] = 'secret';

      jest.spyOn(global, 'fetch').mockResolvedValue(new Response('error', { status: 400 }));

      await expect(service.exchangeCode('bad-code', 'http://localhost/cb')).rejects.toThrow(
        'Failed to exchange authorization code',
      );
      jest.restoreAllMocks();
    });

    it('throws when no refresh_token is returned', async () => {
      process.env['GOOGLE_CLIENT_ID'] = 'id';
      process.env['GOOGLE_CLIENT_SECRET'] = 'secret';

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), { status: 200 }),
        );

      await expect(service.exchangeCode('code', 'http://localhost/cb')).rejects.toThrow(
        'No refresh token returned',
      );
      jest.restoreAllMocks();
    });

    it('returns refresh_token on success', async () => {
      process.env['GOOGLE_CLIENT_ID'] = 'id';
      process.env['GOOGLE_CLIENT_SECRET'] = 'secret';

      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'at',
            refresh_token: 'rt-123',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );

      const result = await service.exchangeCode('code', 'http://localhost/cb');
      expect(result).toBe('rt-123');
      jest.restoreAllMocks();
    });
  });

  describe('getAccessToken', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('fetches a fresh token from Google', async () => {
      process.env['GOOGLE_CLIENT_ID'] = 'id';
      process.env['GOOGLE_CLIENT_SECRET'] = 'secret';

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ access_token: 'fresh-at', expires_in: 3600 }), {
            status: 200,
          }),
        );

      const token = await service.getAccessToken('refresh-token-xxx');
      expect(token).toBe('fresh-at');
    });

    it('returns cached token on subsequent calls', async () => {
      process.env['GOOGLE_CLIENT_ID'] = 'id';
      process.env['GOOGLE_CLIENT_SECRET'] = 'secret';

      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ access_token: 'cached-at', expires_in: 3600 }), {
            status: 200,
          }),
        );

      await service.getAccessToken('refresh-token-yyy');
      await service.getAccessToken('refresh-token-yyy');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws when refresh fails', async () => {
      process.env['GOOGLE_CLIENT_ID'] = 'id';
      process.env['GOOGLE_CLIENT_SECRET'] = 'secret';

      jest.spyOn(global, 'fetch').mockResolvedValue(new Response('error', { status: 401 }));

      await expect(service.getAccessToken('bad-refresh')).rejects.toThrow(
        'Failed to refresh access token',
      );
    });
  });
});
