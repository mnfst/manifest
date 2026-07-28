import { ManifestProviderController } from './manifest-provider.controller';

describe('ManifestProviderController', () => {
  const manifestProvider = {
    ensureConnection: jest.fn(),
  };
  const tenantCache = {
    ensureForUser: jest.fn(),
  };
  let controller: ManifestProviderController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new ManifestProviderController(manifestProvider as never, tenantCache as never);
  });

  it('uses the authenticated tenant context', async () => {
    const expected = {
      connected: true,
      connection_id: 'conn-1',
      source: 'existing',
      auto_available: true,
    };
    manifestProvider.ensureConnection.mockResolvedValue(expected);

    await expect(
      controller.ensure(
        { tenantId: 'tenant-1', userId: 'user-1' },
        { id: 'user-1', email: 'user@example.com' },
        { apiKey: 'sk-gifted' },
      ),
    ).resolves.toBe(expected);
    expect(tenantCache.ensureForUser).not.toHaveBeenCalled();
    expect(manifestProvider.ensureConnection).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      userEmail: 'user@example.com',
      apiKey: 'sk-gifted',
    });
  });

  it('creates a tenant lazily for an authenticated user', async () => {
    tenantCache.ensureForUser.mockResolvedValue('tenant-created');
    manifestProvider.ensureConnection.mockResolvedValue({ connected: false });

    await controller.ensure(
      { tenantId: null, userId: null },
      { id: 'user-1', email: 'user@example.com' },
      {},
    );

    expect(tenantCache.ensureForUser).toHaveBeenCalledWith('user-1');
    expect(manifestProvider.ensureConnection).toHaveBeenCalledWith({
      tenantId: 'tenant-created',
      userId: 'user-1',
      userEmail: 'user@example.com',
      apiKey: undefined,
    });
  });

  it('returns unavailable when no tenant can be resolved', async () => {
    await expect(
      controller.ensure({ tenantId: null, userId: null }, {}, undefined as never),
    ).resolves.toEqual({
      connected: false,
      connection_id: null,
      source: 'none',
      auto_available: false,
    });
    expect(manifestProvider.ensureConnection).not.toHaveBeenCalled();
  });
});
