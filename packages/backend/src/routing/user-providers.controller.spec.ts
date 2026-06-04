import { UserProvidersController } from './user-providers.controller';
import type { UserProvider } from '../entities/user-provider.entity';

describe('UserProvidersController', () => {
  const makeProvider = (id: string, label: string): UserProvider =>
    ({
      id,
      user_id: 'user-1',
      agent_id: null,
      provider: 'openai',
      auth_type: 'api_key',
      label,
      priority: 0,
      api_key_encrypted: 'encrypted-same-key',
      key_prefix: 'sk-test',
      region: null,
      is_active: true,
      connected_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      cached_models: [{ id: 'gpt-4o' }] as never,
      models_fetched_at: '2026-01-01T00:00:00.000Z',
    }) as UserProvider;

  it('lists duplicate-looking provider rows without deleting them', async () => {
    const providerRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          makeProvider('provider-agent-a', 'Default'),
          makeProvider('provider-agent-b', 'Default [provider-agent-b]'),
        ]),
      delete: jest.fn(),
    };
    const controller = new UserProvidersController(
      providerRepo as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
    );

    const result = await controller.listProviders({ id: 'user-1' } as never);

    expect(providerRepo.find).toHaveBeenCalledWith({ where: { user_id: 'user-1' } });
    expect(providerRepo.delete).not.toHaveBeenCalled();
    expect(result.providers).toEqual([
      expect.objectContaining({
        provider: 'openai',
        auth_type: 'api_key',
        connection_count: 2,
        connections: [
          expect.objectContaining({ id: 'provider-agent-a', label: 'Default' }),
          expect.objectContaining({
            id: 'provider-agent-b',
            label: 'Default [provider-agent-b]',
          }),
        ],
      }),
    ]);
  });
});
