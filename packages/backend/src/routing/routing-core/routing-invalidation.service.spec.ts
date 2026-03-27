import { RoutingInvalidationService } from './routing-invalidation.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { RoutingCacheService } from './routing-cache.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { TierAssignment } from '../../entities/tier-assignment.entity';

function makeMockRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
  };
}

function makeTier(overrides: Partial<TierAssignment> = {}): TierAssignment {
  return Object.assign(new TierAssignment(), {
    id: 'tier-1',
    user_id: 'user-1',
    agent_id: 'agent-1',
    tier: 'simple',
    override_model: null,
    override_provider: null,
    override_auth_type: null,
    auto_assigned_model: 'gpt-4o-mini',
    fallback_models: null,
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  });
}

describe('RoutingInvalidationService', () => {
  let service: RoutingInvalidationService;
  let tierRepo: ReturnType<typeof makeMockRepo>;
  let pricingCache: { getByModel: jest.Mock };
  let autoAssign: { recalculate: jest.Mock };
  let routingCache: { invalidateAgent: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    tierRepo = makeMockRepo();
    pricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    autoAssign = { recalculate: jest.fn().mockResolvedValue(undefined) };
    routingCache = { invalidateAgent: jest.fn() };

    service = new RoutingInvalidationService(
      tierRepo as unknown as any,
      pricingCache as unknown as ModelPricingCacheService,
      autoAssign as unknown as TierAutoAssignService,
      routingCache as unknown as RoutingCacheService,
    );
  });

  describe('invalidateOverridesForRemovedModels', () => {
    it('should be a no-op when removedModels is empty', async () => {
      await service.invalidateOverridesForRemovedModels([]);

      expect(tierRepo.find).not.toHaveBeenCalled();
    });

    it('should clear overrides that match removed models', async () => {
      const tier = makeTier({
        override_model: 'gpt-4o',
        override_provider: 'openai',
        override_auth_type: 'api_key',
        agent_id: 'agent-1',
      });
      // First find: affected overrides
      tierRepo.find.mockResolvedValueOnce([tier]);
      // Second find: fallbackTiers scoped to agentIds
      tierRepo.find.mockResolvedValueOnce([tier]);

      await service.invalidateOverridesForRemovedModels(['gpt-4o']);

      expect(tier.override_model).toBeNull();
      expect(tier.override_provider).toBeNull();
      expect(tier.override_auth_type).toBeNull();
      expect(tierRepo.save).toHaveBeenCalled();
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('should clean fallback models referencing removed models', async () => {
      // No overrides matched
      tierRepo.find.mockResolvedValueOnce([]);
      // Scan all tiers with fallbacks (agentIds.size === 0)
      const tierWithFallbacks = makeTier({
        agent_id: 'agent-2',
        fallback_models: ['gpt-4o', 'claude-3-haiku'],
      });
      tierRepo.find.mockResolvedValueOnce([tierWithFallbacks]);

      await service.invalidateOverridesForRemovedModels(['gpt-4o']);

      expect(tierWithFallbacks.fallback_models).toEqual(['claude-3-haiku']);
      expect(tierRepo.save).toHaveBeenCalledWith([tierWithFallbacks]);
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-2');
    });

    it('should set fallback_models to null when all removed', async () => {
      tierRepo.find.mockResolvedValueOnce([]);
      const tier = makeTier({ agent_id: 'agent-1', fallback_models: ['gpt-4o'] });
      tierRepo.find.mockResolvedValueOnce([tier]);

      await service.invalidateOverridesForRemovedModels(['gpt-4o']);

      expect(tier.fallback_models).toBeNull();
    });

    it('should not save when no tiers are affected', async () => {
      tierRepo.find.mockResolvedValueOnce([]); // no overrides
      tierRepo.find.mockResolvedValueOnce([]); // no fallback tiers

      await service.invalidateOverridesForRemovedModels(['nonexistent-model']);

      expect(tierRepo.save).not.toHaveBeenCalled();
      expect(autoAssign.recalculate).not.toHaveBeenCalled();
    });

    it('should handle multiple agents affected', async () => {
      const tier1 = makeTier({
        id: 't1',
        agent_id: 'agent-1',
        override_model: 'gpt-4o',
        override_provider: 'openai',
      });
      const tier2 = makeTier({
        id: 't2',
        agent_id: 'agent-2',
        override_model: 'gpt-4o',
        override_provider: 'openai',
      });
      tierRepo.find.mockResolvedValueOnce([tier1, tier2]);
      tierRepo.find.mockResolvedValueOnce([tier1, tier2]);

      await service.invalidateOverridesForRemovedModels(['gpt-4o']);

      expect(autoAssign.recalculate).toHaveBeenCalledTimes(2);
      expect(routingCache.invalidateAgent).toHaveBeenCalledTimes(2);
    });

    it('should not duplicate tier in save when override and fallback both match', async () => {
      const tier = makeTier({
        id: 'shared-tier',
        agent_id: 'agent-1',
        override_model: 'gpt-4o',
        override_provider: 'openai',
        fallback_models: ['gpt-4o-mini'],
      });
      tierRepo.find.mockResolvedValueOnce([tier]); // overrides
      tierRepo.find.mockResolvedValueOnce([tier]); // fallbackTiers

      await service.invalidateOverridesForRemovedModels(['gpt-4o', 'gpt-4o-mini']);

      const savedEntities = tierRepo.save.mock.calls[0][0] as TierAssignment[];
      expect(savedEntities.filter((t: TierAssignment) => t.id === 'shared-tier')).toHaveLength(1);
    });

    it('should skip fallback tiers with no fallback_models', async () => {
      tierRepo.find.mockResolvedValueOnce([]);
      const tierNoFallbacks = makeTier({ fallback_models: null });
      tierRepo.find.mockResolvedValueOnce([tierNoFallbacks]);

      await service.invalidateOverridesForRemovedModels(['gpt-4o']);

      expect(tierRepo.save).not.toHaveBeenCalled();
    });

    it('should skip fallback tiers with empty fallback_models array', async () => {
      tierRepo.find.mockResolvedValueOnce([]);
      const tierEmptyFallbacks = makeTier({ fallback_models: [] });
      tierRepo.find.mockResolvedValueOnce([tierEmptyFallbacks]);

      await service.invalidateOverridesForRemovedModels(['gpt-4o']);

      expect(tierRepo.save).not.toHaveBeenCalled();
    });

    it('should scope fallback scan to affected agents when overrides found', async () => {
      const overrideTier = makeTier({
        agent_id: 'agent-1',
        override_model: 'gpt-4o',
        override_provider: 'openai',
      });
      tierRepo.find.mockResolvedValueOnce([overrideTier]); // overrides found
      tierRepo.find.mockResolvedValueOnce([]); // fallbackTiers scoped to agent-1

      await service.invalidateOverridesForRemovedModels(['gpt-4o']);

      // Second find should be scoped
      expect(tierRepo.find).toHaveBeenCalledTimes(2);
      expect(tierRepo.find.mock.calls[1][0]).toEqual({
        where: { agent_id: expect.anything() },
      });
    });
  });
});
