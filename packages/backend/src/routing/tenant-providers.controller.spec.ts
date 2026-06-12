import { TenantProvidersController } from './tenant-providers.controller';
import type { TenantContext } from '../common/decorators/tenant-context.decorator';
import type { TenantProvider } from '../entities/tenant-provider.entity';

describe('TenantProvidersController', () => {
  const ctx: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };

  // The controller always queries consumption + sparklines when ctx.tenantId is
  // set, so every tenant-scoped test needs a message repo whose query builder
  // returns no rows.
  const emptyMessageRepo = () => ({
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    }),
  });

  const makeProvider = (id: string, label: string): TenantProvider =>
    ({
      id,
      tenant_id: 'tenant-1',
      created_by_user_id: 'user-1',
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
    }) as TenantProvider;

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
    const controller = new TenantProvidersController(
      providerRepo as never,
      emptyMessageRepo() as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders(ctx);

    expect(providerRepo.find).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-1' } });
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

  it('returns empty providers when tenant has none', async () => {
    const providerRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const controller = new TenantProvidersController(
      providerRepo as never,
      emptyMessageRepo() as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders(ctx);

    expect(result.providers).toEqual([]);
    expect(result.model_counts).toEqual({});
  });

  it('returns empty providers when ctx has no tenant (fresh account)', async () => {
    const providerRepo = { find: jest.fn() };
    const customProviderService = { list: jest.fn() };
    const controller = new TenantProvidersController(
      providerRepo as never,
      emptyMessageRepo() as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      customProviderService as never,
    );

    const result = await controller.listProviders({ tenantId: null, userId: 'user-1' });

    expect(providerRepo.find).not.toHaveBeenCalled();
    expect(customProviderService.list).not.toHaveBeenCalled();
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
    const controller = new TenantProvidersController(
      providerRepo as never,
      emptyMessageRepo() as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders(ctx);

    expect(result.providers).toHaveLength(3);
    expect(
      result.providers.map(
        (p: { provider: string; auth_type: string }) => `${p.provider}::${p.auth_type}`,
      ),
    ).toEqual(
      expect.arrayContaining(['anthropic::api_key', 'openai::api_key', 'openai::subscription']),
    );
  });

  it('returns model_counts from pricing cache', async () => {
    const providerRepo = { find: jest.fn().mockResolvedValue([]) };
    const controller = new TenantProvidersController(
      providerRepo as never,
      emptyMessageRepo() as never,
      {
        getAll: jest.fn().mockReturnValue([
          { provider: 'OpenAI', model_name: 'gpt-4o' },
          { provider: 'OpenAI', model_name: 'gpt-4o-mini' },
          { provider: 'Anthropic', model_name: 'claude-3-5-sonnet' },
        ]),
      } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders(ctx);

    expect(result.model_counts).toEqual({ openai: 2, anthropic: 1 });
  });

  it('includes consumption data when tenant exists', async () => {
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
    const controller = new TenantProvidersController(
      providerRepo as never,
      messageRepo as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders(ctx);

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
    const controller = new TenantProvidersController(
      providerRepo as never,
      emptyMessageRepo() as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      customProviderService as never,
    );

    const result = await controller.listProviders(ctx);

    expect(customProviderService.list).toHaveBeenCalledWith('tenant-1');
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
    const controller = new TenantProvidersController(
      providerRepo as never,
      emptyMessageRepo() as never,
      { getAll: jest.fn().mockReturnValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await controller.listProviders(ctx);

    expect(
      result.providers.find((p: { provider: string }) => p.provider === 'openai')!.display_name,
    ).toBeNull();
    expect(
      result.providers.find((p: { provider: string }) => p.provider === 'custom:gone')!
        .display_name,
    ).toBeNull();
  });
});
