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

  it('lists multiple provider rows without deleting them', async () => {
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
      { list: jest.fn().mockResolvedValue([]) } as never,
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

  it('returns empty providers when user has none', async () => {
    const providerRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const controller = new UserProvidersController(
      providerRepo as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders({ id: 'user-1' } as never);

    expect(result.providers).toEqual([]);
    expect(result.model_counts).toEqual({});
  });

  it('groups providers by provider+auth_type key', async () => {
    const providerRepo = {
      find: jest.fn().mockResolvedValue([
        {
          ...makeProvider('p1', 'Key1'),
          provider: 'anthropic',
          auth_type: 'api_key',
          cached_models: [],
        },
        {
          ...makeProvider('p2', 'Key2'),
          provider: 'openai',
          auth_type: 'api_key',
          cached_models: [],
        },
        {
          ...makeProvider('p3', 'OpenAI Sub'),
          provider: 'openai',
          auth_type: 'subscription',
          cached_models: [],
        },
      ]),
    };
    const controller = new UserProvidersController(
      providerRepo as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders({ id: 'user-1' } as never);

    expect(result.providers).toHaveLength(3);
    expect(result.providers.map((p) => `${p.provider}::${p.auth_type}`)).toEqual(
      expect.arrayContaining(['anthropic::api_key', 'openai::api_key', 'openai::subscription']),
    );
  });

  it('returns model_counts from pricing cache', async () => {
    const providerRepo = { find: jest.fn().mockResolvedValue([]) };
    const controller = new UserProvidersController(
      providerRepo as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {
        getAll: jest.fn().mockReturnValue([
          { provider: 'OpenAI', model_name: 'gpt-4o' },
          { provider: 'OpenAI', model_name: 'gpt-4o-mini' },
          { provider: 'Anthropic', model_name: 'claude-3-5-sonnet' },
        ]),
      } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders({ id: 'user-1' } as never);

    expect(result.model_counts).toEqual({ openai: 2, anthropic: 1 });
  });

  it('includes consumption data when tenant exists', async () => {
    const tenantId = 'tenant-123';
    const providerRepo = {
      find: jest.fn().mockResolvedValue([makeProvider('p1', 'Default')]),
    };
    const messageRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            provider: 'openai',
            auth_type: 'api_key',
            tokens: '1000',
            messages: '10',
            cost: '0.05',
            last_used_at: '2026-01-15T00:00:00.000Z',
            day: '2026-01-15',
          },
        ]),
      }),
    };
    const controller = new UserProvidersController(
      providerRepo as never,
      messageRepo as never,
      { findOne: jest.fn().mockResolvedValue({ id: tenantId }) } as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders({ id: 'user-1' } as never);

    expect(result.providers[0].consumption_tokens).toBe(1000);
    expect(result.providers[0].consumption_messages).toBe(10);
    expect(result.providers[0].consumption_cost).toBe(0.05);
    expect(result.providers[0].last_used_at).toBe('2026-01-15T00:00:00.000Z');
  });

  it('resolves display_name for custom provider groups', async () => {
    const providerRepo = {
      find: jest
        .fn()
        .mockResolvedValue([{ ...makeProvider('p1', 'Default'), provider: 'custom:u-9' }]),
    };
    const customProviderService = {
      list: jest.fn().mockResolvedValue([{ id: 'u-9', name: 'MyLLM' }]),
    };
    const controller = new UserProvidersController(
      providerRepo as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      customProviderService as never,
    );

    const result = await controller.listProviders({ id: 'user-1' } as never);

    expect(customProviderService.list).toHaveBeenCalledWith('user-1');
    expect(result.providers[0]).toMatchObject({
      provider: 'custom:u-9',
      display_name: 'MyLLM',
    });
  });

  it('returns null display_name for built-in groups and deleted custom providers', async () => {
    const providerRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          makeProvider('p1', 'Default'),
          { ...makeProvider('p2', 'Gone'), provider: 'custom:gone' },
        ]),
    };
    const controller = new UserProvidersController(
      providerRepo as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders({ id: 'user-1' } as never);

    expect(result.providers.find((p) => p.provider === 'openai')!.display_name).toBeNull();
    expect(result.providers.find((p) => p.provider === 'custom:gone')!.display_name).toBeNull();
  });
});
