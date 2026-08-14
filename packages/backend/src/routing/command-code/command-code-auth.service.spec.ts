import { CommandCodeAuthService } from './command-code-auth.service';

describe('CommandCodeAuthService', () => {
  let service: CommandCodeAuthService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new CommandCodeAuthService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('accepts a valid key (whoami 200)', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200 });

    await expect(service.validateApiKey('user_test')).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.commandcode.ai/alpha/whoami',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer user_test',
          'x-command-code-version': '0.25.7',
          'x-cli-environment': 'cli',
        }),
      }),
    );
  });

  it('rejects a key refused by Command Code (whoami 401)', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401 });

    const result = await service.validateApiKey('user_bad');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('user_');
  });

  it('rejects a forbidden key (whoami 403)', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 403 });

    await expect(service.validateApiKey('user_bad')).resolves.toMatchObject({ ok: false });
  });

  it('treats a whoami 5xx as non-fatal so setup is not blocked by an outage', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 502 });

    await expect(service.validateApiKey('user_test')).resolves.toEqual({ ok: true });
  });

  it('treats a network error as non-fatal', async () => {
    fetchSpy.mockRejectedValue(new Error('ENOTFOUND api.commandcode.ai'));

    await expect(service.validateApiKey('user_test')).resolves.toEqual({ ok: true });
  });

  it('rejects an empty key without calling the network', async () => {
    const result = await service.validateApiKey('   ');
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
