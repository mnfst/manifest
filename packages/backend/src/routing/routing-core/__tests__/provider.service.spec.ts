import type { ModelRoute } from 'manifest-shared';
import { ProviderService } from '../provider.service';
import { UserProvider } from '../../../entities/user-provider.entity';
import { TierAssignment } from '../../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../../entities/specificity-assignment.entity';
import { Agent } from '../../../entities/agent.entity';
import { HeaderTier } from '../../../entities/header-tier.entity';
import { AgentProviderAccess } from '../../../entities/agent-provider-access.entity';
import type { Repository } from 'typeorm';
import type { RoutingCacheService } from '../routing-cache.service';
import type { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import { encrypt, getEncryptionSecret } from '../../../common/utils/crypto.util';

const route = (
  provider: string,
  model: string,
  authType: ModelRoute['authType'] = 'api_key',
): ModelRoute => ({
  provider,
  authType,
  model,
});

const makeQueryBuilder = (agentIds: string[] = ['agent-1']) => ({
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
  update: jest.fn().mockResolvedValue(undefined),
  manager: { transaction: jest.fn() },
  createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder(agentIds)),
});

describe('ProviderService — route-only cleanup paths', () => {
  let providerRepo: ReturnType<typeof makeRepo>;
  let tierRepo: ReturnType<typeof makeRepo>;
  let specRepo: ReturnType<typeof makeRepo>;
  let headerTierRepo: ReturnType<typeof makeRepo>;
  let pricingCache: jest.Mocked<Pick<ModelPricingCacheService, 'getByModel'>>;
  let routingCache: {
    getProviders: jest.Mock;
    setProviders: jest.Mock;
    invalidateAgent: jest.Mock;
    invalidateUser: jest.Mock;
  };
  let svc: ProviderService;

  beforeEach(() => {
    providerRepo = makeRepo();
    tierRepo = makeRepo();
    specRepo = makeRepo();
    headerTierRepo = makeRepo();
    pricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    routingCache = {
      getProviders: jest.fn().mockReturnValue(null),
      setProviders: jest.fn(),
      invalidateAgent: jest.fn(),
      invalidateUser: jest.fn(),
    };

    svc = new ProviderService(
      providerRepo as unknown as Repository<UserProvider>,
      tierRepo as unknown as Repository<TierAssignment>,
      specRepo as unknown as Repository<SpecificityAssignment>,
      makeRepo() as unknown as Repository<Agent>,
      headerTierRepo as unknown as Repository<HeaderTier>,
      pricingCache as unknown as ModelPricingCacheService,
      routingCache as unknown as RoutingCacheService,
    );
  });

  describe('removeProvider — route guards', () => {
    it('blocks disconnect when a tier override uses the provider', async () => {
      providerRepo.find.mockResolvedValueOnce([
        {
          id: 'p1',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'Default',
          priority: 0,
          is_active: true,
        } as unknown as UserProvider,
      ]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: route('OpenAI', 'gpt-4o'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([]);

      await expect(svc.removeProvider('agent-1', 'user-1', 'openai')).rejects.toThrow(
        /Cannot disconnect provider/,
      );
      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('blocks disconnect using model-prefix matching for routes with no explicit provider', async () => {
      providerRepo.find.mockResolvedValueOnce([
        {
          id: 'p1',
          agent_id: 'agent-1',
          provider: 'custom-x',
          auth_type: 'api_key',
          label: 'Default',
          priority: 0,
          is_active: true,
        } as unknown as UserProvider,
      ]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: { provider: '', authType: 'api_key', model: 'custom-x/some' },
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([]);

      await expect(svc.removeProvider('agent-1', 'user-1', 'custom-x')).rejects.toThrow(
        /Cannot disconnect provider/,
      );
      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('blocks disconnect using pricing cache attribution for opaque model names', async () => {
      providerRepo.find.mockResolvedValueOnce([
        {
          id: 'p1',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'Default',
          priority: 0,
          is_active: true,
        } as unknown as UserProvider,
      ]);
      pricingCache.getByModel.mockReturnValue({ provider: 'openai' } as never);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: { provider: '', authType: 'api_key', model: 'opaque-id' },
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([]);

      await expect(svc.removeProvider('agent-1', 'user-1', 'openai')).rejects.toThrow(
        /Cannot disconnect provider/,
      );
      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('blocks disconnect when specificity or header-tier fallbacks use the provider', async () => {
      providerRepo.find.mockResolvedValueOnce([
        {
          id: 'p1',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'Default',
          priority: 0,
          is_active: true,
        } as unknown as UserProvider,
      ]);
      tierRepo.find.mockResolvedValueOnce([]);
      specRepo.find.mockResolvedValueOnce([
        {
          category: 'coding',
          override_route: null,
          fallback_routes: [route('openai', 'gpt-4o-mini')],
        } as unknown as SpecificityAssignment,
      ]);
      headerTierRepo.find.mockResolvedValue([]);

      await expect(svc.removeProvider('agent-1', 'user-1', 'openai')).rejects.toThrow(
        /Cannot disconnect provider/,
      );
      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('deactivates the provider when no user-controlled routes reference it', async () => {
      const row = {
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'Default',
        priority: 0,
        is_active: true,
      } as unknown as UserProvider;
      providerRepo.find.mockResolvedValueOnce([row]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: { provider: 'other', authType: 'api_key', model: 'custom-x/some' },
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'openai');

      expect(row.is_active).toBe(false);
      expect(providerRepo.save).toHaveBeenCalledWith([row]);
      expect(tierRepo.save).not.toHaveBeenCalled();
      expect(specRepo.save).not.toHaveBeenCalled();
      expect(result.notifications).toEqual([]);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('blocks only disconnected auth-type routes when another auth type stays active', async () => {
      providerRepo.find.mockResolvedValueOnce([
        {
          id: 'p-sub',
          agent_id: 'agent-1',
          provider: 'anthropic',
          auth_type: 'subscription',
          label: 'Default',
          priority: 0,
          is_active: true,
        } as unknown as UserProvider,
      ]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: route('anthropic', 'claude-sonnet-4-6', 'subscription'),
          fallback_routes: [route('anthropic', 'claude-haiku-4-6', 'api_key')],
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([]);

      await expect(
        svc.removeProvider('agent-1', 'user-1', 'anthropic', 'subscription'),
      ).rejects.toThrow(/Cannot disconnect provider/);
      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no provider record exists', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(svc.removeProvider('agent-1', 'user-1', 'missing')).rejects.toThrow();
    });

    it('returns no notifications when no tiers/specs reference the provider', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([]);
      tierRepo.find.mockResolvedValueOnce([]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'openai');
      expect(result.notifications).toEqual([]);
    });
  });

  describe('removeProvider — removeKeyByLabel', () => {
    it('throws NotFoundException when no keys match the (provider, auth_type)', async () => {
      providerRepo.find.mockResolvedValue([]);
      await expect(
        svc.removeProvider('agent-1', 'user-1', 'openai', 'api_key', 'default'),
      ).rejects.toThrow('Provider not found');
    });

    it('throws NotFoundException when no key carries the requested label', async () => {
      providerRepo.find.mockResolvedValue([
        {
          id: 'p1',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'primary',
          is_active: true,
        } as unknown as UserProvider,
      ]);
      await expect(
        svc.removeProvider('agent-1', 'user-1', 'openai', 'api_key', 'secondary'),
      ).rejects.toThrow('Provider key not found');
    });

    it('does not block removing a non-primary Default-labeled key used only by an unlabeled route', async () => {
      const target = {
        id: 'target',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'Default',
        priority: 1,
        is_active: true,
      } as unknown as UserProvider;
      providerRepo.find.mockResolvedValue([
        target,
        {
          id: 'primary',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'Work',
          priority: 0,
          is_active: true,
        } as unknown as UserProvider,
      ]);
      tierRepo.find.mockResolvedValue([
        {
          tier: 'standard',
          override_route: route('openai', 'gpt-4o'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([]);

      await expect(
        svc.removeProvider('agent-1', 'user-1', 'openai', 'api_key', 'Default'),
      ).resolves.toEqual({ notifications: [] });

      expect(providerRepo.remove).toHaveBeenCalledWith(target);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('deactivateAllProviders', () => {
    it('updates providers and invalidates cache when no routes reference them', async () => {
      providerRepo.find.mockResolvedValueOnce([
        {
          id: 'p1',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'Default',
          priority: 0,
          is_active: true,
        } as unknown as UserProvider,
      ]);
      tierRepo.find.mockResolvedValue([]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([]);

      await svc.deactivateAllProviders('agent-1', 'user-1');

      expect(providerRepo.update).toHaveBeenCalledWith(
        { user_id: 'user-1' },
        expect.objectContaining({ is_active: false }),
      );
      expect(tierRepo.update).not.toHaveBeenCalled();
      expect(headerTierRepo.update).not.toHaveBeenCalled();
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('blocks bulk disable when a route references an active provider', async () => {
      providerRepo.find.mockResolvedValueOnce([
        {
          id: 'p1',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'Default',
          priority: 0,
          is_active: true,
        } as unknown as UserProvider,
      ]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: route('openai', 'gpt-4o'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([]);

      await expect(svc.deactivateAllProviders('agent-1', 'user-1')).rejects.toThrow(
        /Cannot disconnect provider/,
      );
      expect(providerRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('header-tier cleanup on disconnect / rename', () => {
    const headerPin = (keyLabel: string | null) => ({
      provider: 'openai',
      authType: 'subscription' as const,
      model: 'openai/gpt-5',
      keyLabel,
    });

    it('blocks removing a labeled key while header tiers pin that key', async () => {
      providerRepo.find.mockResolvedValue([
        {
          id: 'target',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'subscription',
          label: 'Key 2',
          is_active: true,
        },
        {
          id: 'other',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'subscription',
          label: 'Default',
          is_active: true,
        },
      ]);
      tierRepo.find.mockResolvedValue([]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([
        {
          id: 'h1',
          override_route: headerPin('Key 2'),
          fallback_routes: [headerPin('Key 2'), headerPin('Default')],
        } as unknown as HeaderTier,
        // Non-matching tier (different pinned label) must be left untouched.
        {
          id: 'h2',
          override_route: headerPin('Default'),
          fallback_routes: null,
        } as unknown as HeaderTier,
      ]);

      await expect(
        svc.removeProvider('agent-1', 'user-1', 'openai', 'subscription', 'Key 2'),
      ).rejects.toThrow(/Cannot disconnect provider/);

      expect(headerTierRepo.save).not.toHaveBeenCalled();
      expect(providerRepo.remove).not.toHaveBeenCalled();
    });

    it('rewrites header-tier key pins to the new label on rename', async () => {
      providerRepo.find.mockResolvedValue([
        {
          id: 'target',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'subscription',
          label: 'Key 2',
          is_active: true,
        },
      ]);
      tierRepo.find.mockResolvedValue([]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([
        {
          id: 'h1',
          override_route: headerPin('Key 2'),
          fallback_routes: null,
        } as unknown as HeaderTier,
      ]);

      await svc.renameKey('agent-1', 'user-1', 'openai', 'subscription', 'Key 2', 'Renamed');

      const saved = headerTierRepo.save.mock.calls[0][0] as HeaderTier[];
      expect(saved[0].override_route?.keyLabel).toBe('Renamed');
    });

    it('blocks full provider disconnect while header tiers route to it', async () => {
      providerRepo.find.mockResolvedValue([
        {
          id: 'p1',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'Default',
          priority: 0,
          is_active: true,
        } as unknown as UserProvider,
      ]);
      tierRepo.find.mockResolvedValue([]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([
        {
          id: 'h1',
          override_route: route('OpenAI', 'gpt-4o'),
          fallback_routes: [route('openai', 'gpt-4o-mini'), route('anthropic', 'claude')],
        } as unknown as HeaderTier,
        // Belongs to another provider — must survive.
        {
          id: 'h2',
          override_route: route('anthropic', 'claude'),
          fallback_routes: null,
        } as unknown as HeaderTier,
      ]);

      await expect(svc.removeProvider('agent-1', 'user-1', 'openai')).rejects.toThrow(
        /Cannot disconnect provider/,
      );

      expect(headerTierRepo.save).not.toHaveBeenCalled();
      expect(providerRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cleanupUnsupportedSubscriptionProviders (via getProviders)', () => {
    it('no-ops when no unsupported subscription rows exist', async () => {
      providerRepo.find.mockResolvedValue([
        {
          id: 'p1',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'api_key',
          is_active: true,
        },
      ]);
      const result = await svc.getProviders('user-1');
      expect(result).toHaveLength(1);
      expect(providerRepo.save).not.toHaveBeenCalled();
      expect(routingCache.invalidateUser).not.toHaveBeenCalled();
    });

    it('deactivates unsupported subscription rows and returns only usable providers', async () => {
      // Pretend 'foobar' is an unsupported subscription provider.
      providerRepo.find.mockResolvedValueOnce([
        {
          id: 'p1',
          agent_id: 'agent-1',
          provider: 'foobar',
          auth_type: 'subscription',
          is_active: true,
        },
      ]);

      const result = await svc.getProviders('user-1');
      // The unsupported row was deactivated.
      expect(providerRepo.save).toHaveBeenCalled();
      // After filter only usable providers are returned (none in this case).
      expect(result).toEqual([]);
    });

    it('reads from cache when present', async () => {
      const cached = [
        { id: 'p1', provider: 'openai', auth_type: 'api_key', is_active: true } as UserProvider,
      ];
      routingCache.getProviders.mockReturnValue(cached);
      const result = await svc.getProviders('user-1');
      expect(result).toBe(cached);
      expect(providerRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('upsertProvider — MiniMax subscription region', () => {
    // upsertProvider encrypts the apiKey, which requires an encryption secret —
    // the rest of this suite mocks repos but never hits the encrypt path, so
    // there's no global setup. Keep the secret scoped to this describe.
    let originalSecret: string | undefined;
    beforeAll(() => {
      originalSecret = process.env.BETTER_AUTH_SECRET;
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(48);
    });
    afterAll(() => {
      if (originalSecret === undefined) {
        delete process.env.BETTER_AUTH_SECRET;
      } else {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      }
    });

    it('persists region=cn on a new MiniMax subscription row', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await svc.upsertProvider(
        'agent-1',
        'user-1',
        'minimax',
        'sk-cp-token-from-cn',
        'subscription',
        'cn',
      );

      expect(providerRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'minimax',
          auth_type: 'subscription',
          region: 'cn',
        }),
      );
    });

    it('updates region on an existing MiniMax subscription row', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'minimax',
        auth_type: 'subscription',
        label: 'Default',
        region: 'global',
        is_active: true,
      });

      await svc.upsertProvider(
        'agent-1',
        'user-1',
        'minimax',
        'sk-cp-new-token',
        'subscription',
        'cn',
      );

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'cn',
        }),
      );
    });

    it('preserves existing MiniMax subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'minimax',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'minimax', 'sk-cp-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'cn',
        }),
      );
    });

    it('rejects unsupported MiniMax subscription region', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.upsertProvider('agent-1', 'user-1', 'minimax', 'sk-cp-token', 'subscription', 'eu'),
      ).rejects.toThrow('MiniMax subscription region must be one of: global, cn');
    });
  });

  describe('upsertProvider — Z.ai subscription region', () => {
    let originalSecret: string | undefined;
    beforeAll(() => {
      originalSecret = process.env.BETTER_AUTH_SECRET;
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(48);
    });
    afterAll(() => {
      if (originalSecret === undefined) {
        delete process.env.BETTER_AUTH_SECRET;
      } else {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      }
    });

    it('persists region=global on a new Z.ai subscription row', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await svc.upsertProvider('agent-1', 'user-1', 'zai', 'zai-sub-key', 'subscription', 'global');

      expect(providerRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'zai',
          auth_type: 'subscription',
          region: 'global',
        }),
      );
    });

    it('updates region on an existing Z.ai subscription row', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'zai',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'zai', 'zai-new-key', 'subscription', 'global');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'global',
        }),
      );
    });

    it('preserves existing Z.ai subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'zai',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'zai', 'zai-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'cn',
        }),
      );
    });

    it('preserves existing dotted Z.ai alias subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'z.ai',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'z.ai', 'zai-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'z.ai',
          region: 'cn',
        }),
      );
    });

    it('rejects unsupported Z.ai subscription region', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.upsertProvider('agent-1', 'user-1', 'zai', 'zai-sub-key', 'subscription', 'eu'),
      ).rejects.toThrow('Z.ai subscription region must be one of: global, cn');
    });
  });

  describe('upsertProvider — Xiaomi MiMo Token Plan region', () => {
    let originalSecret: string | undefined;
    beforeAll(() => {
      originalSecret = process.env.BETTER_AUTH_SECRET;
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(48);
    });
    afterAll(() => {
      if (originalSecret === undefined) {
        delete process.env.BETTER_AUTH_SECRET;
      } else {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      }
    });

    it('persists region=ams on a new Xiaomi subscription row', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await svc.upsertProvider(
        'agent-1',
        'user-1',
        'xiaomi',
        'tp-mimo-token',
        'subscription',
        'ams',
      );

      expect(providerRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'xiaomi',
          auth_type: 'subscription',
          region: 'ams',
        }),
      );
    });

    it('updates region on an existing Xiaomi subscription row', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'xiaomi',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider(
        'agent-1',
        'user-1',
        'xiaomi',
        'tp-mimo-new-token',
        'subscription',
        'sgp',
      );

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'sgp',
        }),
      );
    });

    it('preserves existing Xiaomi subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'xiaomi',
        auth_type: 'subscription',
        label: 'Default',
        region: 'ams',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'xiaomi', 'tp-mimo-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'ams',
        }),
      );
    });

    it('preserves existing Xiaomi alias subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'mimo',
        auth_type: 'subscription',
        label: 'Default',
        region: 'ams',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'mimo', 'tp-mimo-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'mimo',
          region: 'ams',
        }),
      );
    });

    it('rejects unsupported Xiaomi subscription region', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.upsertProvider('agent-1', 'user-1', 'xiaomi', 'tp-mimo-token', 'subscription', 'eu'),
      ).rejects.toThrow('Xiaomi MiMo Token Plan region must be one of: cn, sgp, ams');
    });
  });

  describe('nextOAuthLabel', () => {
    it('returns undefined when no subscription rows exist', async () => {
      providerRepo.find.mockResolvedValue([]);
      const label = await svc.nextOAuthLabel('user-1', 'openai');
      expect(label).toBeUndefined();
    });

    it('returns "Key 2" when one subscription row exists', async () => {
      providerRepo.find.mockResolvedValue([{ label: 'Default', is_active: true }]);
      const label = await svc.nextOAuthLabel('user-1', 'openai');
      expect(label).toBe('Key 2');
    });

    it('skips existing labels', async () => {
      providerRepo.find.mockResolvedValue([
        { label: 'Default', is_active: true },
        { label: 'Key 2', is_active: true },
      ]);
      const label = await svc.nextOAuthLabel('user-1', 'openai');
      expect(label).toBe('Key 3');
    });

    it('is case-insensitive when checking existing labels', async () => {
      providerRepo.find.mockResolvedValue([
        { label: 'Default', is_active: true },
        { label: 'key 2', is_active: true },
      ]);
      const label = await svc.nextOAuthLabel('user-1', 'openai');
      expect(label).toBe('Key 3');
    });
  });
});

describe('ProviderService — symmetric provider↔agent auto-connect', () => {
  const PREV_SECRET = process.env.BETTER_AUTH_SECRET;

  // A query-builder mock whose insert chain records the granted (agent, provider)
  // pairs so the symmetric-grant tests can assert exactly which grants were made.
  const makeAccessRepo = (granted: Array<{ agent: string; provider: string }>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertChain: any = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn((v: { agent_id: string; user_provider_id: string }) => {
        granted.push({ agent: v.agent_id, provider: v.user_provider_id });
        return insertChain;
      }),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    return {
      createQueryBuilder: jest.fn().mockReturnValue(insertChain),
      delete: jest.fn().mockResolvedValue(undefined),
    };
  };

  const build = (agentIds: string[], granted: Array<{ agent: string; provider: string }>) => {
    const providerRepo = makeRepo();
    const agentRepo = makeRepo(agentIds);
    const routingCache = {
      getProviders: jest.fn().mockReturnValue(null),
      setProviders: jest.fn(),
      invalidateAgent: jest.fn(),
      invalidateUser: jest.fn(),
    };
    const accessRepo = makeAccessRepo(granted);
    const svc = new ProviderService(
      providerRepo as unknown as Repository<UserProvider>,
      makeRepo() as unknown as Repository<TierAssignment>,
      makeRepo() as unknown as Repository<SpecificityAssignment>,
      agentRepo as unknown as Repository<Agent>,
      makeRepo() as unknown as Repository<HeaderTier>,
      { getByModel: jest.fn() } as unknown as ModelPricingCacheService,
      routingCache as unknown as RoutingCacheService,
      accessRepo as unknown as Repository<AgentProviderAccess>,
    );
    return { svc, providerRepo, routingCache };
  };

  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = 'a'.repeat(48);
  });
  afterAll(() => {
    if (PREV_SECRET === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = PREV_SECRET;
  });

  describe('enableAllProvidersForAgent', () => {
    it('grants every usable provider to the agent and invalidates that agent', async () => {
      const granted: Array<{ agent: string; provider: string }> = [];
      const { svc, providerRepo, routingCache } = build(['agent-x'], granted);
      providerRepo.find.mockResolvedValue([
        { id: 'p1', provider: 'openai', auth_type: 'api_key', is_active: true } as UserProvider,
        { id: 'p2', provider: 'anthropic', auth_type: 'api_key', is_active: true } as UserProvider,
      ]);

      await svc.enableAllProvidersForAgent('new-agent', 'user-1');

      expect(granted).toEqual([
        { agent: 'new-agent', provider: 'p1' },
        { agent: 'new-agent', provider: 'p2' },
      ]);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('new-agent');
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('is a no-op grant when the user has no usable providers', async () => {
      const granted: Array<{ agent: string; provider: string }> = [];
      const { svc, providerRepo, routingCache } = build(['agent-x'], granted);
      providerRepo.find.mockResolvedValue([]);

      await expect(svc.enableAllProvidersForAgent('new-agent', 'user-1')).resolves.toBeUndefined();
      expect(granted).toEqual([]);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('new-agent');
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('grantNewProviderToAllAgents', () => {
    it('grants the new provider to every owned agent and invalidates their caches', async () => {
      const granted: Array<{ agent: string; provider: string }> = [];
      const { svc, routingCache } = build(['agent-1', 'agent-2'], granted);

      await svc.grantNewProviderToAllAgents('user-1', 'new-provider');

      expect(granted).toEqual([
        { agent: 'agent-1', provider: 'new-provider' },
        { agent: 'agent-2', provider: 'new-provider' },
      ]);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-2');
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('is a no-op grant when the user owns no agents', async () => {
      const granted: Array<{ agent: string; provider: string }> = [];
      const { svc, routingCache } = build([], granted);

      await expect(
        svc.grantNewProviderToAllAgents('user-1', 'new-provider'),
      ).resolves.toBeUndefined();
      expect(granted).toEqual([]);
      expect(routingCache.invalidateAgent).not.toHaveBeenCalled();
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('upsertProvider — new provider connect fans out to all agents', () => {
    it('grants a brand-new api_key provider to every owned agent (Default label path)', async () => {
      const granted: Array<{ agent: string; provider: string }> = [];
      const { svc, providerRepo } = build(['agent-1', 'agent-2'], granted);
      // No existing row → new-row branch.
      providerRepo.findOne.mockResolvedValue(null);

      const { isNew, provider } = await svc.upsertProvider(
        'agent-1',
        'user-1',
        'openai',
        'sk-new-key',
        'api_key',
      );

      expect(isNew).toBe(true);
      // Every owned agent (not just the connecting one) gets the grant.
      expect(granted).toEqual([
        { agent: 'agent-1', provider: provider.id },
        { agent: 'agent-2', provider: provider.id },
      ]);
    });

    it('grants a brand-new labeled provider to every owned agent', async () => {
      const granted: Array<{ agent: string; provider: string }> = [];
      const { svc, providerRepo } = build(['agent-1', 'agent-2'], granted);
      // upsertProviderWithLabel: no existing rows → new-row branch.
      providerRepo.find.mockResolvedValue([]);

      const { isNew, provider } = await svc.upsertProvider(
        'agent-1',
        'user-1',
        'openai',
        'sk-labeled-key',
        'api_key',
        undefined,
        'Work',
      );

      expect(isNew).toBe(true);
      expect(granted).toEqual([
        { agent: 'agent-1', provider: provider.id },
        { agent: 'agent-2', provider: provider.id },
      ]);
    });

    it('grants a brand-new tokenless subscription provider to every owned agent', async () => {
      const granted: Array<{ agent: string; provider: string }> = [];
      const { svc, providerRepo } = build(['agent-1', 'agent-2'], granted);
      // registerSubscriptionProvider new-row branch: no existing sub/api_key row.
      providerRepo.findOne.mockResolvedValue(null);

      const { isNew } = await svc.registerSubscriptionProvider('agent-1', 'user-1', 'anthropic');

      expect(isNew).toBe(true);
      expect(granted.map((g) => g.agent)).toEqual(['agent-1', 'agent-2']);
    });
  });

  describe('reconnect of an EXISTING provider does NOT re-grant (per-agent disables preserved)', () => {
    it('does not grant other agents when an existing Default-label row is updated', async () => {
      const granted: Array<{ agent: string; provider: string }> = [];
      const { svc, providerRepo } = build(['agent-1', 'agent-2'], granted);
      const grantSpy = jest.spyOn(svc, 'grantNewProviderToAllAgents');
      // Existing row → update-in-place branch (afterProviderChange path).
      providerRepo.findOne.mockResolvedValue({
        id: 'p-existing',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'Default',
        is_active: true,
      });

      const { isNew } = await svc.upsertProvider('agent-1', 'user-1', 'openai', 'sk-rotated');

      expect(isNew).toBe(false);
      // The fan-out-to-all-agents path is NOT taken on reconnect.
      expect(grantSpy).not.toHaveBeenCalled();
      // Only the connecting agent is (re)granted via afterProviderChange —
      // sibling agent-2 keeps whatever per-agent disable state it had.
      expect(granted).toEqual([{ agent: 'agent-1', provider: 'p-existing' }]);
      expect(granted.some((g) => g.agent === 'agent-2')).toBe(false);
    });

    it('does not re-grant when reconnecting the same key under a new label (sameKey path)', async () => {
      const granted: Array<{ agent: string; provider: string }> = [];
      const { svc, providerRepo } = build(['agent-1', 'agent-2'], granted);
      const grantSpy = jest.spyOn(svc, 'grantNewProviderToAllAgents');
      const sameKeyEncrypted = encrypt('sk-same-key', getEncryptionSecret());
      // upsertProviderWithLabel: a row with the SAME decrypted key already
      // exists under a different label → sameKey reactivation branch.
      providerRepo.find.mockResolvedValue([
        {
          id: 'p-same',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'Default',
          api_key_encrypted: sameKeyEncrypted,
          is_active: true,
          priority: 0,
        } as unknown as UserProvider,
      ]);

      const { isNew } = await svc.upsertProvider(
        'agent-1',
        'user-1',
        'openai',
        'sk-same-key',
        'api_key',
        undefined,
        'Key 2',
      );

      expect(isNew).toBe(false);
      // The fan-out-to-all-agents path is NOT taken on a same-key reconnect.
      expect(grantSpy).not.toHaveBeenCalled();
      // Only the connecting agent is (re)granted via afterProviderChange —
      // sibling agent-2 keeps whatever per-agent disable state it had.
      expect(granted).toEqual([{ agent: 'agent-1', provider: 'p-same' }]);
      expect(granted.some((g) => g.agent === 'agent-2')).toBe(false);
    });
  });
});

describe('ProviderService — getFreshSubscriptionCredential', () => {
  const PREV_KEY = process.env.MANIFEST_ENCRYPTION_KEY;
  let providerRepo: ReturnType<typeof makeRepo>;
  let svc: ProviderService;

  beforeAll(() => {
    process.env.MANIFEST_ENCRYPTION_KEY = 'unit-test-encryption-key-1234567890';
  });
  afterAll(() => {
    if (PREV_KEY === undefined) delete process.env.MANIFEST_ENCRYPTION_KEY;
    else process.env.MANIFEST_ENCRYPTION_KEY = PREV_KEY;
  });

  beforeEach(() => {
    providerRepo = makeRepo();
    svc = new ProviderService(
      providerRepo as unknown as Repository<UserProvider>,
      makeRepo() as unknown as Repository<TierAssignment>,
      makeRepo() as unknown as Repository<SpecificityAssignment>,
      makeRepo() as unknown as Repository<Agent>,
      makeRepo() as unknown as Repository<HeaderTier>,
      { getByModel: jest.fn() } as unknown as ModelPricingCacheService,
      {
        getProviders: jest.fn(),
        setProviders: jest.fn(),
        invalidateAgent: jest.fn(),
        invalidateUser: jest.fn(),
      } as unknown as RoutingCacheService,
    );
  });

  it('returns the decrypted raw credential, scanning subscription rows for the agent/provider', async () => {
    const raw = JSON.stringify({ t: 'access', r: 'refresh', e: 123 });
    providerRepo.find.mockResolvedValue([
      { label: 'Work', api_key_encrypted: encrypt(raw, getEncryptionSecret()) },
    ]);

    const out = await svc.getFreshSubscriptionCredential('user-1', 'openai', 'Work');

    expect(out).toBe(raw);
    expect(providerRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-1', provider: 'openai', auth_type: 'subscription' },
    });
  });

  it('matches the label case-insensitively', async () => {
    const raw = JSON.stringify({ t: 'a', r: 'r', e: 1 });
    providerRepo.find.mockResolvedValue([
      { label: 'Other', api_key_encrypted: encrypt('nope', getEncryptionSecret()) },
      { label: 'work', api_key_encrypted: encrypt(raw, getEncryptionSecret()) },
    ]);

    // Stored row is "work"; the pinned route asks for "WORK".
    const out = await svc.getFreshSubscriptionCredential('user-1', 'openai', 'WORK');

    expect(out).toBe(raw);
  });

  it('defaults the label to Default when none is provided', async () => {
    const raw = JSON.stringify({ t: 'a', r: 'r', e: 1 });
    providerRepo.find.mockResolvedValue([
      { label: 'Default', api_key_encrypted: encrypt(raw, getEncryptionSecret()) },
    ]);

    expect(await svc.getFreshSubscriptionCredential('user-1', 'anthropic')).toBe(raw);
  });

  it('returns null when no row matches the label', async () => {
    providerRepo.find.mockResolvedValue([
      { label: 'Something else', api_key_encrypted: encrypt('x', getEncryptionSecret()) },
    ]);
    expect(await svc.getFreshSubscriptionCredential('user-1', 'openai')).toBeNull();
  });

  it('returns null when there are no subscription rows', async () => {
    providerRepo.find.mockResolvedValue([]);
    expect(await svc.getFreshSubscriptionCredential('user-1', 'openai')).toBeNull();
  });

  it('returns null when the matched row has no stored credential', async () => {
    providerRepo.find.mockResolvedValue([{ label: 'Default', api_key_encrypted: null }]);
    expect(await svc.getFreshSubscriptionCredential('user-1', 'openai')).toBeNull();
  });

  it('returns null when the stored credential cannot be decrypted', async () => {
    providerRepo.find.mockResolvedValue([
      { label: 'Default', api_key_encrypted: 'not-a-valid-ciphertext' },
    ]);
    expect(await svc.getFreshSubscriptionCredential('user-1', 'openai')).toBeNull();
  });
});
