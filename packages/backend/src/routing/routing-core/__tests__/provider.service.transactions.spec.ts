// Transaction-manager threading for ProviderService.
//
// CustomProviderService wraps its two-row dance (custom_providers +
// companion tenant_providers) in a single transaction and passes the
// EntityManager down to upsertProvider / removeProvider. These tests pin
// the contract that, when a manager is supplied, every TenantProvider /
// AgentEnabledProvider write goes through manager.getRepository(...) —
// NOT the injected repositories — so the writes commit or roll back
// together with the caller's transaction.
import { ProviderService } from '../provider.service';
import { TenantProvider } from '../../../entities/tenant-provider.entity';
import { TierAssignment } from '../../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../../entities/specificity-assignment.entity';
import { Agent } from '../../../entities/agent.entity';
import { HeaderTier } from '../../../entities/header-tier.entity';
import { AgentEnabledProvider } from '../../../entities/agent-enabled-provider.entity';
import type { EntityManager, Repository } from 'typeorm';
import type { RoutingCacheService } from '../routing-cache.service';
import type { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';

const makeQueryBuilder = (agentIds: string[]) => ({
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(agentIds.map((id) => ({ id }))),
});

const makeRepo = (agentIds: string[] = ['agent-1']) => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockImplementation(async (rows) => rows),
  delete: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  createQueryBuilder: jest.fn().mockImplementation(() => ({
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
    ...makeQueryBuilder(agentIds),
  })),
});

describe('ProviderService — transaction manager threading', () => {
  let providerRepo: ReturnType<typeof makeRepo>;
  let accessRepo: ReturnType<typeof makeRepo>;
  let txProviderRepo: ReturnType<typeof makeRepo>;
  let txAccessRepo: ReturnType<typeof makeRepo>;
  let manager: EntityManager;
  let svc: ProviderService;
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = 'a'.repeat(48);

    providerRepo = makeRepo();
    accessRepo = makeRepo();
    txProviderRepo = makeRepo();
    txAccessRepo = makeRepo();
    manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === TenantProvider ? txProviderRepo : txAccessRepo,
      ),
    } as unknown as EntityManager;

    svc = new ProviderService(
      providerRepo as unknown as Repository<TenantProvider>,
      makeRepo() as unknown as Repository<TierAssignment>,
      makeRepo() as unknown as Repository<SpecificityAssignment>,
      makeRepo() as unknown as Repository<Agent>,
      makeRepo() as unknown as Repository<HeaderTier>,
      { getByModel: jest.fn() } as unknown as ModelPricingCacheService,
      {
        getProviders: jest.fn().mockReturnValue(null),
        setProviders: jest.fn(),
        invalidateAgent: jest.fn(),
        invalidateTenant: jest.fn(),
      } as unknown as RoutingCacheService,
      accessRepo as unknown as Repository<AgentEnabledProvider>,
    );
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = originalSecret;
    }
  });

  it('upsertProvider (new row) writes through the manager repositories only', async () => {
    const { isNew } = await svc.upsertProvider(
      null,
      'tenant-1',
      'custom:cp-1',
      'sk-key',
      'api_key',
      undefined,
      undefined,
      undefined,
      manager,
    );

    expect(isNew).toBe(true);
    expect(txProviderRepo.insert).toHaveBeenCalledTimes(1);
    expect(providerRepo.insert).not.toHaveBeenCalled();
    // The all-agents grant must join the same transaction.
    expect(txAccessRepo.createQueryBuilder).toHaveBeenCalled();
    expect(accessRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('upsertProvider (existing row) saves through the manager repository', async () => {
    txProviderRepo.findOne.mockResolvedValueOnce({
      id: 'up-1',
      tenant_id: 'tenant-1',
      provider: 'custom:cp-1',
      auth_type: 'api_key',
      label: 'Default',
      is_active: false,
    } as unknown as TenantProvider);

    const { isNew } = await svc.upsertProvider(
      null,
      'tenant-1',
      'custom:cp-1',
      'sk-rotated',
      'api_key',
      undefined,
      undefined,
      undefined,
      manager,
    );

    expect(isNew).toBe(false);
    expect(txProviderRepo.save).toHaveBeenCalledTimes(1);
    expect(providerRepo.save).not.toHaveBeenCalled();
  });

  it('upsertProvider with a label updates an existing labeled row through the manager', async () => {
    txProviderRepo.find.mockResolvedValueOnce([
      {
        id: 'up-7',
        tenant_id: 'tenant-1',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'Work',
        priority: 0,
        is_active: false,
      } as unknown as TenantProvider,
    ]);

    const { isNew } = await svc.upsertProvider(
      'agent-1',
      'tenant-1',
      'openai',
      'sk-rotated',
      'api_key',
      undefined,
      'Work',
      undefined,
      manager,
    );

    expect(isNew).toBe(false);
    expect(txProviderRepo.save).toHaveBeenCalledTimes(1);
    expect(providerRepo.save).not.toHaveBeenCalled();
  });

  it('upsertProvider with a label routes the labeled path through the manager too', async () => {
    await svc.upsertProvider(
      'agent-1',
      'tenant-1',
      'openai',
      'sk-labeled',
      'api_key',
      undefined,
      'Work',
      undefined,
      manager,
    );

    expect(txProviderRepo.find).toHaveBeenCalled();
    expect(txProviderRepo.insert).toHaveBeenCalledTimes(1);
    expect(providerRepo.find).not.toHaveBeenCalled();
    expect(providerRepo.insert).not.toHaveBeenCalled();
  });

  it('removeProvider deactivates rows and deletes grants through the manager', async () => {
    txProviderRepo.find.mockResolvedValueOnce([
      {
        id: 'up-1',
        tenant_id: 'tenant-1',
        provider: 'custom:cp-1',
        auth_type: 'api_key',
        label: 'Default',
        priority: 0,
        is_active: true,
      } as unknown as TenantProvider,
    ]);

    await svc.removeProvider(null, 'tenant-1', 'custom:cp-1', undefined, undefined, manager);

    expect(txProviderRepo.save).toHaveBeenCalledTimes(1);
    expect(txAccessRepo.delete).toHaveBeenCalledTimes(1);
    expect(providerRepo.save).not.toHaveBeenCalled();
    expect(accessRepo.delete).not.toHaveBeenCalled();
  });

  it('removeProvider with a label deletes the key and renumbers through the manager', async () => {
    const target = {
      id: 'up-2',
      tenant_id: 'tenant-1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'Work',
      priority: 1,
      is_active: true,
    } as unknown as TenantProvider;
    const survivor = {
      id: 'up-1',
      tenant_id: 'tenant-1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'Default',
      priority: 0,
      is_active: true,
    } as unknown as TenantProvider;
    // First find: removeKeyByLabel lookup; second find: renumberPriorities.
    txProviderRepo.find.mockResolvedValueOnce([survivor, target]).mockResolvedValueOnce([survivor]);

    await svc.removeProvider('agent-1', 'tenant-1', 'openai', 'api_key', 'Work', manager);

    expect(txProviderRepo.remove).toHaveBeenCalledWith(target);
    expect(txAccessRepo.delete).toHaveBeenCalledTimes(1);
    expect(providerRepo.remove).not.toHaveBeenCalled();
    expect(accessRepo.delete).not.toHaveBeenCalled();
  });

  it('removeProvider with a label delegates the LAST key to the no-label path, keeping the manager', async () => {
    const onlyKey = {
      id: 'up-only',
      tenant_id: 'tenant-1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'Work',
      priority: 0,
      is_active: true,
    } as unknown as TenantProvider;
    // First find: removeKeyByLabel lookup; second find: the delegated
    // no-label teardown listing active rows.
    txProviderRepo.find.mockResolvedValueOnce([onlyKey]).mockResolvedValueOnce([onlyKey]);

    await svc.removeProvider('agent-1', 'tenant-1', 'openai', 'api_key', 'Work', manager);

    // The delegated teardown deactivates through the manager repo.
    expect(txProviderRepo.save).toHaveBeenCalledTimes(1);
    expect(txAccessRepo.delete).toHaveBeenCalledTimes(1);
    expect(providerRepo.save).not.toHaveBeenCalled();
  });

  it('enableProviderForAgent stays a no-op when no enabled-provider repository is injected, manager or not', async () => {
    const svcWithoutAccess = new ProviderService(
      providerRepo as unknown as Repository<TenantProvider>,
      makeRepo() as unknown as Repository<TierAssignment>,
      makeRepo() as unknown as Repository<SpecificityAssignment>,
      makeRepo() as unknown as Repository<Agent>,
      makeRepo() as unknown as Repository<HeaderTier>,
      { getByModel: jest.fn() } as unknown as ModelPricingCacheService,
      {
        getProviders: jest.fn().mockReturnValue(null),
        setProviders: jest.fn(),
        invalidateAgent: jest.fn(),
        invalidateTenant: jest.fn(),
      } as unknown as RoutingCacheService,
      null,
    );

    await expect(
      svcWithoutAccess.enableProviderForAgent('agent-1', 'up-1', manager),
    ).resolves.toBeUndefined();
    expect(manager.getRepository).not.toHaveBeenCalled();
  });
});
