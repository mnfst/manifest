import type { ModelRoute } from 'manifest-shared';
import { ProviderService } from '../provider.service';
import { UserProvider } from '../../../entities/user-provider.entity';
import { TierAssignment } from '../../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../../entities/specificity-assignment.entity';
import type { Repository } from 'typeorm';
import type { TierAutoAssignService } from '../tier-auto-assign.service';
import type { RoutingCacheService } from '../routing-cache.service';
import type { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';

const route = (provider: string, model: string): ModelRoute => ({
  provider,
  authType: 'api_key',
  model,
});

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockImplementation(async (rows) => rows),
  delete: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  manager: { transaction: jest.fn() },
});

describe('ProviderService — route-only cleanup paths', () => {
  let providerRepo: ReturnType<typeof makeRepo>;
  let tierRepo: ReturnType<typeof makeRepo>;
  let specRepo: ReturnType<typeof makeRepo>;
  let autoAssign: jest.Mocked<Pick<TierAutoAssignService, 'recalculate'>>;
  let pricingCache: jest.Mocked<Pick<ModelPricingCacheService, 'getByModel'>>;
  let routingCache: {
    getProviders: jest.Mock;
    setProviders: jest.Mock;
    invalidateAgent: jest.Mock;
  };
  let svc: ProviderService;

  beforeEach(() => {
    providerRepo = makeRepo();
    tierRepo = makeRepo();
    specRepo = makeRepo();
    autoAssign = { recalculate: jest.fn().mockResolvedValue(undefined) };
    pricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    routingCache = {
      getProviders: jest.fn().mockReturnValue(null),
      setProviders: jest.fn(),
      invalidateAgent: jest.fn(),
    };

    svc = new ProviderService(
      providerRepo as unknown as Repository<UserProvider>,
      tierRepo as unknown as Repository<TierAssignment>,
      specRepo as unknown as Repository<SpecificityAssignment>,
      autoAssign as unknown as TierAutoAssignService,
      pricingCache as unknown as ModelPricingCacheService,
      routingCache as unknown as RoutingCacheService,
    );
  });

  describe('removeProvider — cleanupProviderReferences', () => {
    it('clears tier override_route when its provider matches removed provider (case-insensitive)', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      // After save, no other active records.
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: route('OpenAI', 'gpt-4o'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      // Re-read tiers for notification map.
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('anthropic', 'claude'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'openai');
      expect(tierRepo.save).toHaveBeenCalledTimes(1);
      const savedTiers = tierRepo.save.mock.calls[0][0];
      expect(savedTiers[0].override_route).toBeNull();
      expect(result.notifications[0]).toMatch(/gpt-4o is no longer available/);
      expect(result.notifications[0]).toMatch(/automatic mode \(claude\)/);
    });

    it('uses model-prefix matching for routes whose provider does not equal the removed key', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'custom-x',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: { provider: 'other', authType: 'api_key', model: 'custom-x/some' },
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: null,
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'custom-x');
      const saved = tierRepo.save.mock.calls[0][0];
      expect(saved[0].override_route).toBeNull();
      // Notification for the removed model.
      expect(result.notifications).toHaveLength(1);
    });

    it('uses pricing cache provider attribution for opaque model names', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      pricingCache.getByModel.mockReturnValue({ provider: 'openai' } as never);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          // provider in route doesn't match — only pricing cache attribution does.
          override_route: { provider: 'mystery', authType: 'api_key', model: 'opaque-id' },
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      tierRepo.find.mockResolvedValueOnce([
        { tier: 'standard', override_route: null, auto_assigned_route: null } as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      await svc.removeProvider('agent-1', 'openai');
      expect(tierRepo.save).toHaveBeenCalled();
    });

    it('filters fallback_routes and nulls when emptied', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: null,
          fallback_routes: [route('openai', 'gpt-4o')],
        } as unknown as TierAssignment,
      ]);
      tierRepo.find.mockResolvedValueOnce([{ tier: 'standard' } as TierAssignment]);
      specRepo.find.mockResolvedValue([]);

      await svc.removeProvider('agent-1', 'openai');
      const saved = tierRepo.save.mock.calls[0][0];
      expect(saved[0].fallback_routes).toBeNull();
    });

    it('preserves remaining fallback_routes when only some entries match', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: null,
          fallback_routes: [route('openai', 'gpt-4o'), route('anthropic', 'claude')],
        } as unknown as TierAssignment,
      ]);
      tierRepo.find.mockResolvedValueOnce([{ tier: 'standard' } as TierAssignment]);
      specRepo.find.mockResolvedValue([]);

      await svc.removeProvider('agent-1', 'openai');
      const saved = tierRepo.save.mock.calls[0][0];
      expect(saved[0].fallback_routes).toEqual([route('anthropic', 'claude')]);
    });

    it('cleans specificity rows independently from tier rows', async () => {
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
      specRepo.find.mockResolvedValue([
        {
          category: 'coding',
          override_route: route('openai', 'gpt-4o'),
          fallback_routes: [route('openai', 'gpt-4o-mini')],
        } as unknown as SpecificityAssignment,
      ]);

      await svc.removeProvider('agent-1', 'openai');
      expect(specRepo.save).toHaveBeenCalled();
      const savedSpec = specRepo.save.mock.calls[0][0];
      expect(savedSpec[0].override_route).toBeNull();
      expect(savedSpec[0].fallback_routes).toBeNull();
    });

    it('skips override clearing when another auth-type record is still active for the provider', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      // Sibling subscription record remains active.
      providerRepo.find.mockResolvedValue([
        {
          id: 'p2',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'subscription',
          is_active: true,
        },
      ]);

      const result = await svc.removeProvider('agent-1', 'openai');
      expect(tierRepo.find).not.toHaveBeenCalled();
      expect(result.notifications).toEqual([]);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('throws NotFoundException when no provider record exists', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(svc.removeProvider('agent-1', 'missing')).rejects.toThrow();
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

      const result = await svc.removeProvider('agent-1', 'openai');
      expect(result.notifications).toEqual([]);
    });
  });

  describe('deactivateAllProviders', () => {
    it('updates providers and tiers, then recalculates and invalidates cache', async () => {
      await svc.deactivateAllProviders('agent-1');

      expect(providerRepo.update).toHaveBeenCalledWith(
        { agent_id: 'agent-1' },
        expect.objectContaining({ is_active: false }),
      );
      expect(tierRepo.update).toHaveBeenCalledWith(
        { agent_id: 'agent-1' },
        expect.objectContaining({
          override_route: null,
          auto_assigned_route: null,
          fallback_routes: null,
        }),
      );
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
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
      const result = await svc.getProviders('agent-1');
      expect(result).toHaveLength(1);
      expect(providerRepo.save).not.toHaveBeenCalled();
      expect(autoAssign.recalculate).not.toHaveBeenCalled();
    });

    it('deactivates unsupported subscription rows and triggers cleanup when no usable sibling remains', async () => {
      // Pretend 'foobar' is an unsupported subscription provider — neither
      // anthropic nor any usable sibling stays for the same provider.
      providerRepo.find
        .mockResolvedValueOnce([
          {
            id: 'p1',
            agent_id: 'agent-1',
            provider: 'foobar',
            auth_type: 'subscription',
            is_active: true,
          },
        ])
        // After cleanupProviderReferences runs.
        .mockResolvedValueOnce([]);
      tierRepo.find.mockResolvedValue([
        {
          tier: 'standard',
          override_route: route('foobar', 'fb-1'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.getProviders('agent-1');
      // The unsupported row was deactivated.
      expect(providerRepo.save).toHaveBeenCalled();
      // After filter only usable providers are returned (none in this case).
      expect(result).toEqual([]);
      // Tier override referencing the removed provider gets cleared.
      expect(tierRepo.save).toHaveBeenCalled();
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
    });

    it('reads from cache when present', async () => {
      const cached = [
        { id: 'p1', provider: 'openai', auth_type: 'api_key', is_active: true } as UserProvider,
      ];
      routingCache.getProviders.mockReturnValue(cached);
      const result = await svc.getProviders('agent-1');
      expect(result).toBe(cached);
      expect(providerRepo.find).not.toHaveBeenCalled();
    });
  });
});
