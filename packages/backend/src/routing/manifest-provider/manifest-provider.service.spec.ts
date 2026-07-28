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
    process.env['MANIFEST_CREDITS_MASTER_KEY'] = 'sk-master';
    process.env['MANIFEST_CREDITS_BASE_URL'] = 'https://credits.test';
    delete process.env['MANIFEST_CREDITS_AUTO_PROVISION_ALLOWLIST'];
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
      auto_available: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('preserves an explicit disconnect without minting a replacement key', async () => {
    providerRepo.find.mockResolvedValue([{ id: 'conn-1', is_active: false }]);

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
    expect(global.fetch).not.toHaveBeenCalled();
    expect(providerService.upsertProvider).not.toHaveBeenCalled();
  });

  it('stores a pasted virtual key (manual path)', async () => {
    providerRepo.find
      .mockResolvedValueOnce([]) // findConnection first
      .mockResolvedValueOnce([]); // findConnection inside persistKey
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

  it('rejects a concurrent second connection before persisting', async () => {
    providerRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'conn-existing', is_active: true }]);

    await expect(
      service.ensureConnection({
        tenantId: 't1',
        userId: 'u1',
        userEmail: 'a@x.com',
        apiKey: 'sk-virtual',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(providerService.upsertProvider).not.toHaveBeenCalled();
  });

  it('keeps a connection when model discovery fails', async () => {
    providerRepo.find.mockResolvedValue([]);
    providerService.upsertProvider.mockResolvedValue({
      provider: { id: 'conn-2' },
      isNew: true,
    });
    discoveryService.discoverModels.mockRejectedValueOnce(new Error('discovery unavailable'));

    await expect(
      service.ensureConnection({
        tenantId: 't1',
        userId: 'u1',
        userEmail: 'a@x.com',
        apiKey: 'sk-virtual',
      }),
    ).resolves.toMatchObject({ connected: true, connection_id: 'conn-2', source: 'manual' });
  });

  it('auto-mints a virtual key when eligible', async () => {
    process.env['MANIFEST_CREDITS_AUTO_PROVISION_ALLOWLIST'] = 'a@x.com';
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
      'https://credits.test/key/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-master' }),
        signal: expect.any(AbortSignal),
      }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.max_budget).toBe(10);
    expect(body.key_alias).toBe('manifest:t1');
  });

  it('returns none when not eligible and no key pasted', async () => {
    delete process.env['MANIFEST_CREDITS_MASTER_KEY'];
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

  it('does not auto-mint with a master key but no allowlist', async () => {
    providerRepo.find.mockResolvedValue([]);

    await expect(
      service.ensureConnection({
        tenantId: 't1',
        userId: 'u1',
        userEmail: 'a@x.com',
      }),
    ).resolves.toEqual({
      connected: false,
      connection_id: null,
      source: 'none',
      auto_available: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(providerService.upsertProvider).not.toHaveBeenCalled();
  });

  it('throws when credit-key generation fails', async () => {
    process.env['MANIFEST_CREDITS_AUTO_PROVISION_ALLOWLIST'] = 'a@x.com';
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

  it('throws when the credit-key request rejects or times out', async () => {
    process.env['MANIFEST_CREDITS_AUTO_PROVISION_ALLOWLIST'] = 'a@x.com';
    providerRepo.find.mockResolvedValue([]);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('request timed out'));

    await expect(
      service.ensureConnection({
        tenantId: 't1',
        userId: 'u1',
        userEmail: 'a@x.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the credits service omits the key', async () => {
    process.env['MANIFEST_CREDITS_AUTO_PROVISION_ALLOWLIST'] = 'a@x.com';
    providerRepo.find.mockResolvedValue([]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(
      service.ensureConnection({
        tenantId: 't1',
        userId: 'u1',
        userEmail: 'a@x.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects direct key minting when the master key is unavailable', async () => {
    delete process.env['MANIFEST_CREDITS_MASTER_KEY'];

    await expect(
      (
        service as unknown as {
          mintVirtualKey: (tenantId: string, email: string) => Promise<string>;
        }
      ).mintVirtualKey('t1', 'a@x.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
