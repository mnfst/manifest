import type { Repository } from 'typeorm';
import type { ModelRoute } from 'manifest-shared';
import { RoutingInvalidationService } from '../routing-invalidation.service';
import { TierAssignment } from '../../../entities/tier-assignment.entity';
import type { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import type { TierAutoAssignService } from '../tier-auto-assign.service';
import type { RoutingCacheService } from '../routing-cache.service';

const route = (provider: string, model: string): ModelRoute => ({
  provider,
  authType: 'api_key',
  model,
});

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  save: jest.fn().mockImplementation(async (rows) => rows),
});

describe('RoutingInvalidationService', () => {
  let tierRepo: ReturnType<typeof makeRepo>;
  let pricingCache: jest.Mocked<Pick<ModelPricingCacheService, 'getByModel'>>;
  let autoAssign: jest.Mocked<Pick<TierAutoAssignService, 'recalculate'>>;
  let routingCache: { invalidateAgent: jest.Mock };
  let svc: RoutingInvalidationService;

  beforeEach(() => {
    tierRepo = makeRepo();
    pricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    autoAssign = { recalculate: jest.fn().mockResolvedValue(undefined) };
    routingCache = { invalidateAgent: jest.fn() };

    svc = new RoutingInvalidationService(
      tierRepo as unknown as Repository<TierAssignment>,
      pricingCache as unknown as ModelPricingCacheService,
      autoAssign as unknown as TierAutoAssignService,
      routingCache as unknown as RoutingCacheService,
    );
  });

  it('no-ops when removedModels is empty', async () => {
    await svc.invalidateOverridesForRemovedModels([]);
    expect(tierRepo.find).not.toHaveBeenCalled();
    expect(autoAssign.recalculate).not.toHaveBeenCalled();
  });

  it('clears override_route when its model is in the removed set', async () => {
    tierRepo.find.mockResolvedValue([
      {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: route('openai', 'gpt-4o'),
        fallback_routes: null,
      } as TierAssignment,
    ]);
    await svc.invalidateOverridesForRemovedModels(['gpt-4o']);

    expect(tierRepo.save).toHaveBeenCalledTimes(1);
    const saved = tierRepo.save.mock.calls[0][0];
    expect(saved[0].override_route).toBeNull();
    expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
  });

  it('filters fallback_routes when some entries are removed', async () => {
    tierRepo.find.mockResolvedValue([
      {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: null,
        fallback_routes: [route('openai', 'gpt-4o'), route('anthropic', 'claude')],
      } as TierAssignment,
    ]);

    await svc.invalidateOverridesForRemovedModels(['gpt-4o']);
    const saved = tierRepo.save.mock.calls[0][0];
    expect(saved[0].fallback_routes).toEqual([route('anthropic', 'claude')]);
  });

  it('nulls fallback_routes when every entry is removed', async () => {
    tierRepo.find.mockResolvedValue([
      {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: null,
        fallback_routes: [route('openai', 'gpt-4o')],
      } as TierAssignment,
    ]);

    await svc.invalidateOverridesForRemovedModels(['gpt-4o']);
    const saved = tierRepo.save.mock.calls[0][0];
    expect(saved[0].fallback_routes).toBeNull();
  });

  it('clears both override_route and fallback_routes when both reference removed models', async () => {
    tierRepo.find.mockResolvedValue([
      {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: route('openai', 'gpt-4o'),
        fallback_routes: [route('openai', 'gpt-4o-mini')],
      } as TierAssignment,
    ]);

    await svc.invalidateOverridesForRemovedModels(['gpt-4o', 'gpt-4o-mini']);
    const saved = tierRepo.save.mock.calls[0][0];
    expect(saved[0].override_route).toBeNull();
    expect(saved[0].fallback_routes).toBeNull();
  });

  it('skips rows with no overlap and saves nothing', async () => {
    tierRepo.find.mockResolvedValue([
      {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: route('openai', 'still-here'),
        fallback_routes: [route('anthropic', 'also-here')],
      } as TierAssignment,
    ]);

    await svc.invalidateOverridesForRemovedModels(['something-else']);
    expect(tierRepo.save).not.toHaveBeenCalled();
    expect(autoAssign.recalculate).not.toHaveBeenCalled();
    expect(routingCache.invalidateAgent).not.toHaveBeenCalled();
  });

  it('aggregates per-agent recalculations across multiple impacted tiers', async () => {
    tierRepo.find.mockResolvedValue([
      {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: route('openai', 'm-1'),
        fallback_routes: null,
      } as TierAssignment,
      {
        agent_id: 'agent-1',
        tier: 'complex',
        override_route: route('openai', 'm-2'),
        fallback_routes: null,
      } as TierAssignment,
      {
        agent_id: 'agent-2',
        tier: 'standard',
        override_route: route('openai', 'm-1'),
        fallback_routes: null,
      } as TierAssignment,
    ]);

    await svc.invalidateOverridesForRemovedModels(['m-1', 'm-2']);
    expect(autoAssign.recalculate).toHaveBeenCalledTimes(2);
    expect(routingCache.invalidateAgent).toHaveBeenCalledTimes(2);
    const calls = autoAssign.recalculate.mock.calls.map((c) => c[0]).sort();
    expect(calls).toEqual(['agent-1', 'agent-2']);
  });
});
