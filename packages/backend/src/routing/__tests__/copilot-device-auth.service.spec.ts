import { CopilotDeviceAuthService } from '../copilot-device-auth.service';

describe('CopilotDeviceAuthService', () => {
  let service: CopilotDeviceAuthService;
  const mockFetch = jest.fn();

  beforeEach(() => {
    service = new CopilotDeviceAuthService();
    global.fetch = mockFetch;
    jest.clearAllMocks();
  });

  describe('requestDeviceCode', () => {
    it('requests a device code from GitHub', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'dc_abc123',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        }),
      });

      const result = await service.requestDeviceCode();

      expect(result).toEqual({
        device_code: 'dc_abc123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/device/code',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(service.requestDeviceCode()).rejects.toThrow(
        'GitHub device code request failed: 500',
      );
    });

    it('throws on invalid response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unexpected: 'data' }),
      });

      await expect(service.requestDeviceCode()).rejects.toThrow(
        'Invalid device code response from GitHub',
      );
    });
  });

  describe('pollForToken', () => {
    it('returns complete with token on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'ghu_abc123' }),
      });

      const result = await service.pollForToken('dc_abc123');

      expect(result).toEqual({ status: 'complete', token: 'ghu_abc123' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('returns pending for authorization_pending', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'authorization_pending' }),
      });

      const result = await service.pollForToken('dc_abc123');
      expect(result).toEqual({ status: 'pending' });
    });

    it('returns slow_down for slow_down', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'slow_down' }),
      });

      const result = await service.pollForToken('dc_abc123');
      expect(result).toEqual({ status: 'slow_down' });
    });

    it('returns expired for expired_token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'expired_token' }),
      });

      const result = await service.pollForToken('dc_abc123');
      expect(result).toEqual({ status: 'expired' });
    });

    it('returns denied for access_denied', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'access_denied' }),
      });

      const result = await service.pollForToken('dc_abc123');
      expect(result).toEqual({ status: 'denied' });
    });

    it('returns pending for unexpected error values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'unknown_error' }),
      });

      const result = await service.pollForToken('dc_abc123');
      expect(result).toEqual({ status: 'pending' });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(service.pollForToken('dc_abc123')).rejects.toThrow(
        'GitHub token poll failed: 503',
      );
    });
  });
});
