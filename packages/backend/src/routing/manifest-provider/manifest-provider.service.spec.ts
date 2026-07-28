import { BadRequestException } from '@nestjs/common';
import { ManifestProviderService } from './manifest-provider.service';

describe('ManifestProviderService', () => {
  const providerRepo = {
    find: jest.fn(),
  };
  const providerService = {
    upsertProvider: jest.fn(),
  };
  const discoveryService = {
    discoverModels: jest.fn().mockResolvedValue(undefined),
  };

  let service: ManifestProviderService;
  const originalFetch = global.fetch;
  const env = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...env };
    process.env['LITELLM_MASTER_KEY'] = 'sk-master';
    process.env['LITELLM_BASE_URL'] = 'https://litellm.test';
    delete process.env['LITELLM_AUTO_PROVISION_ALLOWLIST'];
    service = new ManifestProviderService(
      providerRepo as never,
      providerService as never,
      discoveryService as never,
    );
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env = env;
  });

  it('returns existing connection without minting', async () => {
    providerRepo.find.mockResolvedValue([{ id: 'conn-1', is_active: true }]);
    const result = await service.ensureConnection({
      tenantId: 't1',
      userId: 'u1',
      userEmail: 'a@x.com',
    });
    expect(result).toEqual({
      connected: true,
      connection_id: 'conn-1',
      source: 'existing',
      auto_available: true,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stores a pasted virtual key (manual path)', async () => {
    providerRepo.find
      .mockResolvedValueOnce([]) // findActive first
      .mockResolvedValueOnce([]); // findActive inside persistKey
    providerService.upsertProvider.mockResolvedValue({
      provider: { id: 'conn-2' },
      isNew: true,
    });

    const result = await service.ensureConnection({
      tenantId: 't1',
      userId: 'u1',
      userEmail: 'a@x.com',
      apiKey: 'sk-virtual',
    });

    expect(result.source).toBe('manual');
    expect(result.connection_id).toBe('conn-2');
    expect(providerService.upsertProvider).toHaveBeenCalledWith(
      null,
      't1',
      'manifest',
      'sk-virtual',
      'api_key',
      undefined,
      undefined,
      'u1',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('auto-mints a virtual key when eligible', async () => {
    providerRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'sk-minted' }),
    });
    providerService.upsertProvider.mockResolvedValue({
      provider: { id: 'conn-3' },
      isNew: true,
    });

    const result = await service.ensureConnection({
      tenantId: 't1',
      userId: 'u1',
      userEmail: 'a@x.com',
    });

    expect(result).toEqual({
      connected: true,
      connection_id: 'conn-3',
      source: 'auto',
      auto_available: true,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://litellm.test/key/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-master' }),
      }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.max_budget).toBe(10);
    expect(body.key_alias).toBe('manifest:t1');
  });

  it('returns none when not eligible and no key pasted', async () => {
    delete process.env['LITELLM_MASTER_KEY'];
    providerRepo.find.mockResolvedValue([]);
    const result = await service.ensureConnection({
      tenantId: 't1',
      userId: 'u1',
      userEmail: 'a@x.com',
    });
    expect(result).toEqual({
      connected: false,
      connection_id: null,
      source: 'none',
      auto_available: false,
    });
  });

  it('throws when LiteLLM generate fails', async () => {
    providerRepo.find.mockResolvedValue([]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    await expect(
      service.ensureConnection({
        tenantId: 't1',
        userId: 'u1',
        userEmail: 'a@x.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
