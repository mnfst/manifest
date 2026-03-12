import { CopilotTokenService } from '../copilot-token.service';

describe('CopilotTokenService', () => {
  let service: CopilotTokenService;
  const mockFetch = jest.fn();

  beforeEach(() => {
    service = new CopilotTokenService();
    global.fetch = mockFetch;
    jest.clearAllMocks();
  });

  it('exchanges a GitHub token for a Copilot API token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'tid=copilot-session-token',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      }),
    });

    const token = await service.getCopilotToken('ghu_github_oauth_token');

    expect(token).toBe('tid=copilot-session-token');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/copilot_internal/v2/token',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'token ghu_github_oauth_token',
        }),
      }),
    );
  });

  it('returns cached token on subsequent calls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'tid=cached-token',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      }),
    });

    const first = await service.getCopilotToken('ghu_test');
    const second = await service.getCopilotToken('ghu_test');

    expect(first).toBe('tid=cached-token');
    expect(second).toBe('tid=cached-token');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('re-exchanges when cached token is near expiry', async () => {
    // First call: token expires in 60 seconds (within 2-min buffer)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'tid=expiring-soon',
        expires_at: Math.floor(Date.now() / 1000) + 60,
      }),
    });
    // Second call: fresh token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'tid=fresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      }),
    });

    const first = await service.getCopilotToken('ghu_test');
    expect(first).toBe('tid=expiring-soon');

    const second = await service.getCopilotToken('ghu_test');
    expect(second).toBe('tid=fresh-token');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(service.getCopilotToken('ghu_bad')).rejects.toThrow(
      'Copilot token exchange failed: 401',
    );
  });

  it('throws on invalid response body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unexpected: 'data' }),
    });

    await expect(service.getCopilotToken('ghu_test')).rejects.toThrow(
      'Invalid Copilot token exchange response',
    );
  });

  it('caches separately per GitHub token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'tid=token-a',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'tid=token-b',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      }),
    });

    const a = await service.getCopilotToken('ghu_a');
    const b = await service.getCopilotToken('ghu_b');

    expect(a).toBe('tid=token-a');
    expect(b).toBe('tid=token-b');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
