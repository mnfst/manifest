import { CopilotDeviceAuthService } from './copilot-device-auth.service';

const originalFetch = global.fetch;

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('CopilotDeviceAuthService', () => {
  let svc: CopilotDeviceAuthService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    svc = new CopilotDeviceAuthService();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('requestDeviceCode', () => {
    it('POSTs to the GitHub device endpoint with the hard-coded client id and read:user scope', async () => {
      fetchMock.mockResolvedValue(
        mockResponse(200, {
          device_code: 'dev-abc',
          user_code: 'USER-CODE',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        }),
      );

      const out = await svc.requestDeviceCode();

      expect(out.device_code).toBe('dev-abc');
      expect(out.user_code).toBe('USER-CODE');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://github.com/login/device/code');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      const params = new URLSearchParams(init.body.toString());
      expect(params.get('client_id')).toBe('Iv1.b507a08c87ecfe98');
      expect(params.get('scope')).toBe('read:user');
    });

    it('throws when GitHub returns a non-2xx status', async () => {
      fetchMock.mockResolvedValue(mockResponse(503, {}));
      await expect(svc.requestDeviceCode()).rejects.toThrow(
        'GitHub device code request failed: 503',
      );
    });

    it('throws when GitHub returns a malformed payload (missing device_code or user_code)', async () => {
      fetchMock.mockResolvedValue(
        mockResponse(200, { verification_uri: 'x', expires_in: 1, interval: 1 }),
      );
      await expect(svc.requestDeviceCode()).rejects.toThrow(
        'Invalid device code response from GitHub',
      );
    });
  });

  describe('pollForToken', () => {
    it('POSTs to the GitHub token endpoint with the device grant type', async () => {
      fetchMock.mockResolvedValue(mockResponse(200, { access_token: 'ghs_abc' }));
      const out = await svc.pollForToken('dev-abc');
      expect(out).toEqual({ status: 'complete', token: 'ghs_abc' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://github.com/login/oauth/access_token');
      const params = new URLSearchParams(init.body.toString());
      expect(params.get('client_id')).toBe('Iv1.b507a08c87ecfe98');
      expect(params.get('device_code')).toBe('dev-abc');
      expect(params.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:device_code');
    });

    it('maps authorization_pending → pending', async () => {
      fetchMock.mockResolvedValue(mockResponse(200, { error: 'authorization_pending' }));
      expect(await svc.pollForToken('d')).toEqual({ status: 'pending' });
    });

    it('maps slow_down, expired_token, and access_denied to their own statuses', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { error: 'slow_down' }));
      expect((await svc.pollForToken('d')).status).toBe('slow_down');

      fetchMock.mockResolvedValueOnce(mockResponse(200, { error: 'expired_token' }));
      expect((await svc.pollForToken('d')).status).toBe('expired');

      fetchMock.mockResolvedValueOnce(mockResponse(200, { error: 'access_denied' }));
      expect((await svc.pollForToken('d')).status).toBe('denied');
    });

    it('falls back to pending for unrecognised responses and logs a warning', async () => {
      const warn = jest.spyOn((svc as unknown as { logger: { warn: () => void } }).logger, 'warn');
      fetchMock.mockResolvedValue(mockResponse(200, { error: 'something_new' }));
      expect(await svc.pollForToken('d')).toEqual({ status: 'pending' });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unexpected GitHub poll response'));
    });

    it('throws when GitHub returns a non-2xx status', async () => {
      fetchMock.mockResolvedValue(mockResponse(500, {}));
      await expect(svc.pollForToken('d')).rejects.toThrow('GitHub token poll failed: 500');
    });
  });
});
