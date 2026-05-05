import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ModelRoute } from 'manifest-shared';
import { TIER_SLOTS } from 'manifest-shared';
import { TierService } from '../tier.service';
import { TierAssignment } from '../../../entities/tier-assignment.entity';
import { UserProvider } from '../../../entities/user-provider.entity';
import type { DiscoveredModel } from '../../../model-discovery/model-fetcher';
import type { TierAutoAssignService } from '../tier-auto-assign.service';
import type { RoutingCacheService } from '../routing-cache.service';
import type { ProviderService } from '../provider.service';
import type { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';

const route = (provider: string, authType: ModelRoute['authType'], model: string): ModelRoute => ({
  provider,
  authType,
  model,
});

const discovered = (
  id: string,
  provider: string,
  authType: ModelRoute['authType'],
): DiscoveredModel =>
  ({
    id,
    displayName: id,
    provider,
    contextWindow: 0,
    inputPricePerToken: 0,
    outputPricePerToken: 0,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
    authType,
  }) as DiscoveredModel;

interface RepoMock<T> {
  find: jest.Mock;
  findOne: jest.Mock;
  insert: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
}

const makeRepo = <T>(): RepoMock<T> => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockImplementation(async (row) => row),
  update: jest.fn().mockResolvedValue(undefined),
});

describe('TierService', () => {
  let providerRepo: RepoMock<UserProvider>;
  let tierRepo: RepoMock<TierAssignment>;
  let autoAssign: jest.Mocked<Pick<TierAutoAssignService, 'recalculate'>>;
  let routingCache: {
    getTiers: jest.Mock;
    setTiers: jest.Mock;
    invalidateAgent: jest.Mock;
  };
  let providerService: jest.Mocked<Pick<ProviderService, 'getProviders'>>;
  let discoveryService: jest.Mocked<Pick<ModelDiscoveryService, 'getModelsForAgent'>>;
  let svc: TierService;

  beforeEach(() => {
    providerRepo = makeRepo<UserProvider>();
    tierRepo = makeRepo<TierAssignment>();
    autoAssign = { recalculate: jest.fn().mockResolvedValue(undefined) };
    routingCache = {
      getTiers: jest.fn().mockReturnValue(null),
      setTiers: jest.fn(),
      invalidateAgent: jest.fn(),
    };
    providerService = { getProviders: jest.fn().mockResolvedValue([]) };
    discoveryService = { getModelsForAgent: jest.fn().mockResolvedValue([]) };

    svc = new TierService(
      providerRepo as unknown as Repository<UserProvider>,
      tierRepo as unknown as Repository<TierAssignment>,
      autoAssign as unknown as TierAutoAssignService,
      routingCache as unknown as RoutingCacheService,
      providerService as unknown as ProviderService,
      discoveryService as unknown as ModelDiscoveryService,
    );
  });

  describe('hasRoutableTier', () => {
    it('returns true when any tier has an override route', async () => {
      tierRepo.find.mockResolvedValue([
        { tier: 'simple', override_route: route('openai', 'api_key', 'gpt-4o-mini') },
      ]);
      expect(await svc.hasRoutableTier('agent-1')).toBe(true);
    });

    it('returns true when any tier has an auto-assigned route', async () => {
      tierRepo.find.mockResolvedValue([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o'),
        },
      ]);
      expect(await svc.hasRoutableTier('agent-1')).toBe(true);
    });

    it('returns false when every tier is empty', async () => {
      tierRepo.find.mockResolvedValue([
        { tier: 'simple', override_route: null, auto_assigned_route: null },
      ]);
      expect(await svc.hasRoutableTier('agent-1')).toBe(false);
    });

    it('returns false when no rows exist', async () => {
      tierRepo.find.mockResolvedValue([]);
      expect(await svc.hasRoutableTier('agent-1')).toBe(false);
    });
  });

  describe('getTiers', () => {
    it('returns the cached value when present without touching repos', async () => {
      const cached = [{ tier: 'simple' }] as TierAssignment[];
      routingCache.getTiers.mockReturnValue(cached);
      const result = await svc.getTiers('agent-1');
      expect(result).toBe(cached);
      expect(tierRepo.find).not.toHaveBeenCalled();
      expect(providerService.getProviders).not.toHaveBeenCalled();
    });

    it('returns existing rows and caches them when every slot is present', async () => {
      const existing = TIER_SLOTS.map(
        (slot) =>
          ({ tier: slot, override_route: null, auto_assigned_route: null }) as TierAssignment,
      );
      tierRepo.find.mockResolvedValue(existing);
      const result = await svc.getTiers('agent-1');
      expect(result).toEqual(existing);
      expect(routingCache.setTiers).toHaveBeenCalledWith('agent-1', existing);
      expect(autoAssign.recalculate).not.toHaveBeenCalled();
    });

    it('inserts the missing slots when some are absent', async () => {
      tierRepo.find.mockResolvedValueOnce([
        { tier: 'simple', override_route: null, auto_assigned_route: null } as TierAssignment,
      ]);
      const result = await svc.getTiers('agent-1', 'user-1');
      expect(tierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = tierRepo.insert.mock.calls[0][0] as TierAssignment[];
      const insertedSlots = inserted.map((r) => r.tier).sort();
      expect(insertedSlots).toEqual(['complex', 'default', 'reasoning', 'standard']);
      // user_id should be passed through to inserted rows
      expect(inserted.every((r) => r.user_id === 'user-1')).toBe(true);
      // No active providers — recalculate is not invoked
      expect(autoAssign.recalculate).not.toHaveBeenCalled();
      // result merges existing + created
      expect(result).toHaveLength(TIER_SLOTS.length);
    });

    it('uses an empty userId when none is passed', async () => {
      tierRepo.find.mockResolvedValueOnce([]);
      await svc.getTiers('agent-1');
      const inserted = tierRepo.insert.mock.calls[0][0] as TierAssignment[];
      expect(inserted.every((r) => r.user_id === '')).toBe(true);
    });

    it('falls back to existing rows on a unique-index race during insert', async () => {
      tierRepo.find.mockResolvedValueOnce([]);
      tierRepo.insert.mockRejectedValueOnce(new Error('duplicate key'));
      const racedRows = TIER_SLOTS.map((slot) => ({ tier: slot }) as TierAssignment);
      tierRepo.find.mockResolvedValueOnce(racedRows);

      const result = await svc.getTiers('agent-1');
      expect(result).toBe(racedRows);
      expect(routingCache.setTiers).toHaveBeenCalledWith('agent-1', racedRows);
    });

    it('rethrows when insert fails and no rows exist on retry', async () => {
      tierRepo.find.mockResolvedValueOnce([]);
      const err = new Error('FK violation');
      tierRepo.insert.mockRejectedValueOnce(err);
      tierRepo.find.mockResolvedValueOnce([]);
      await expect(svc.getTiers('agent-1')).rejects.toThrow(err);
    });

    it('triggers auto-assign and re-reads when a usable provider exists', async () => {
      tierRepo.find.mockResolvedValueOnce([]);
      providerRepo.find.mockResolvedValue([
        { agent_id: 'agent-1', is_active: true, provider: 'openai', auth_type: 'api_key' },
      ]);
      const finalRows = TIER_SLOTS.map((slot) => ({ tier: slot }) as TierAssignment);
      tierRepo.find.mockResolvedValueOnce(finalRows);

      const result = await svc.getTiers('agent-1');
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
      expect(routingCache.setTiers).toHaveBeenCalledWith('agent-1', finalRows);
      expect(result).toBe(finalRows);
    });
  });

  describe('setOverride', () => {
    it('throws when the model is not in the discovered list', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      await expect(
        svc.setOverride('agent-1', 'user-1', 'standard', 'unknown-model'),
      ).rejects.toThrow(BadRequestException);
    });

    it('truncates the available list in the error message at 20 entries', async () => {
      const list: DiscoveredModel[] = [];
      for (let i = 0; i < 25; i++) list.push(discovered(`m-${i}`, 'openai', 'api_key'));
      discoveryService.getModelsForAgent.mockResolvedValue(list);
      try {
        await svc.setOverride('agent-1', 'u', 'standard', 'unknown', 'openai');
        throw new Error('expected throw');
      } catch (err) {
        const msg = (err as BadRequestException).message;
        expect(msg).toContain('provider: openai');
        expect(msg).toMatch(/, …$/);
      }
    });

    it('throws when the provider does not offer the model', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      await expect(
        svc.setOverride('agent-1', 'user-1', 'standard', 'gpt-4o', 'anthropic'),
      ).rejects.toThrow('not offered by provider');
    });

    it('throws when ambiguous and no explicit triple is passed', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
        discovered('gpt-4o', 'openai', 'subscription'),
      ]);
      await expect(svc.setOverride('agent-1', 'user-1', 'standard', 'gpt-4o')).rejects.toThrow(
        /multiple providers/,
      );
    });

    it('updates an existing tier and clears the matching fallback tuple', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      const existing = {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: null,
        fallback_routes: [
          route('openai', 'api_key', 'gpt-4o'),
          route('anthropic', 'api_key', 'claude'),
        ],
      } as unknown as TierAssignment;
      tierRepo.findOne.mockResolvedValue(existing);

      const result = await svc.setOverride(
        'agent-1',
        'user-1',
        'standard',
        'gpt-4o',
        'openai',
        'api_key',
      );
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
      // The matching tuple is filtered out, leaving only claude.
      expect(result.fallback_routes).toEqual([route('anthropic', 'api_key', 'claude')]);
      expect(tierRepo.save).toHaveBeenCalledWith(existing);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('nulls fallback_routes when filtering the matched tuple leaves zero entries', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      const existing = {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: null,
        fallback_routes: [route('openai', 'api_key', 'gpt-4o')],
      } as unknown as TierAssignment;
      tierRepo.findOne.mockResolvedValue(existing);

      const result = await svc.setOverride(
        'agent-1',
        'user-1',
        'standard',
        'gpt-4o',
        'openai',
        'api_key',
      );
      expect(result.fallback_routes).toBeNull();
    });

    it('inserts a new row when no existing tier exists', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      tierRepo.findOne.mockResolvedValue(null);

      const result = await svc.setOverride(
        'agent-1',
        'user-1',
        'standard',
        'gpt-4o',
        'openai',
        'api_key',
      );
      expect(tierRepo.insert).toHaveBeenCalledTimes(1);
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('retries when insert hits the unique index and another row exists', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      tierRepo.findOne
        .mockResolvedValueOnce(null) // initial check
        .mockResolvedValueOnce({
          agent_id: 'agent-1',
          tier: 'standard',
          override_route: null,
        } as TierAssignment) // retry probe sees existing
        .mockResolvedValueOnce({
          agent_id: 'agent-1',
          tier: 'standard',
          override_route: null,
        } as TierAssignment); // recursive setOverride re-finds it
      tierRepo.insert.mockRejectedValueOnce(new Error('duplicate'));

      const result = await svc.setOverride(
        'agent-1',
        'user-1',
        'standard',
        'gpt-4o',
        'openai',
        'api_key',
      );
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
    });

    it('returns the freshly built record when insert fails and no row exists on retry', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      tierRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      tierRepo.insert.mockRejectedValueOnce(new Error('unrelated'));

      // No throw — service returns the local record and invalidates cache.
      const result = await svc.setOverride(
        'agent-1',
        'user-1',
        'standard',
        'gpt-4o',
        'openai',
        'api_key',
      );
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
    });
  });

  describe('clearOverride', () => {
    it('no-ops when no row exists', async () => {
      tierRepo.findOne.mockResolvedValue(null);
      await svc.clearOverride('agent-1', 'standard');
      expect(tierRepo.save).not.toHaveBeenCalled();
      expect(routingCache.invalidateAgent).not.toHaveBeenCalled();
    });

    it('clears override_route and saves when a row exists', async () => {
      const existing = {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: route('openai', 'api_key', 'gpt-4o'),
      } as unknown as TierAssignment;
      tierRepo.findOne.mockResolvedValue(existing);
      await svc.clearOverride('agent-1', 'standard');
      expect(existing.override_route).toBeNull();
      expect(tierRepo.save).toHaveBeenCalledWith(existing);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('resetAllOverrides', () => {
    it('clears override_route and fallback_routes for every tier of an agent', async () => {
      await svc.resetAllOverrides('agent-1');
      expect(tierRepo.update).toHaveBeenCalledWith(
        { agent_id: 'agent-1' },
        expect.objectContaining({ override_route: null, fallback_routes: null }),
      );
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('getFallbacks', () => {
    it('returns the existing fallback_routes when present', async () => {
      const fr = [route('openai', 'api_key', 'gpt-4o')];
      tierRepo.findOne.mockResolvedValue({ fallback_routes: fr } as TierAssignment);
      expect(await svc.getFallbacks('agent-1', 'standard')).toEqual(fr);
    });

    it('returns [] when row is missing', async () => {
      tierRepo.findOne.mockResolvedValue(null);
      expect(await svc.getFallbacks('agent-1', 'standard')).toEqual([]);
    });

    it('returns [] when fallback_routes is null', async () => {
      tierRepo.findOne.mockResolvedValue({ fallback_routes: null } as TierAssignment);
      expect(await svc.getFallbacks('agent-1', 'standard')).toEqual([]);
    });
  });

  describe('setFallbacks', () => {
    it('returns [] when no tier row exists', async () => {
      tierRepo.findOne.mockResolvedValue(null);
      expect(await svc.setFallbacks('agent-1', 'standard', ['gpt-4o'])).toEqual([]);
      expect(tierRepo.save).not.toHaveBeenCalled();
    });

    it('saves explicit caller routes when they validate', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      tierRepo.findOne.mockResolvedValue({
        agent_id: 'agent-1',
        tier: 'standard',
        fallback_routes: null,
      } as TierAssignment);

      const provided = [route('openai', 'api_key', 'gpt-4o')];
      const result = await svc.setFallbacks('agent-1', 'standard', ['gpt-4o'], provided);
      expect(result).toEqual(provided);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('falls back to discovery when caller route alignment fails', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      tierRepo.findOne.mockResolvedValue({
        agent_id: 'agent-1',
        tier: 'standard',
        fallback_routes: null,
      } as TierAssignment);

      // Provided route's model name doesn't align with the names array — should
      // ignore the explicit routes and resolve from discovery instead.
      const result = await svc.setFallbacks(
        'agent-1',
        'standard',
        ['gpt-4o'],
        [route('openai', 'api_key', 'different-model')],
      );
      expect(result).toEqual([route('openai', 'api_key', 'gpt-4o')]);
    });

    it('falls back to discovery when caller routes do not exist in available list', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      tierRepo.findOne.mockResolvedValue({
        agent_id: 'agent-1',
        tier: 'standard',
        fallback_routes: null,
      } as TierAssignment);
      // Aligned by name but provider doesn't match available list.
      const result = await svc.setFallbacks(
        'agent-1',
        'standard',
        ['gpt-4o'],
        [route('different-provider', 'api_key', 'gpt-4o')],
      );
      expect(result).toEqual([route('openai', 'api_key', 'gpt-4o')]);
    });

    it('returns [] when models is empty (buildFallbackRoutes returns null)', async () => {
      tierRepo.findOne.mockResolvedValue({
        agent_id: 'agent-1',
        tier: 'standard',
        fallback_routes: null,
      } as TierAssignment);

      const result = await svc.setFallbacks('agent-1', 'standard', []);
      expect(result).toEqual([]);
    });

    it('returns [] when a model cannot be unambiguously resolved', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
        discovered('gpt-4o', 'openai', 'subscription'),
      ]);
      tierRepo.findOne.mockResolvedValue({
        agent_id: 'agent-1',
        tier: 'standard',
        fallback_routes: null,
      } as TierAssignment);

      const result = await svc.setFallbacks('agent-1', 'standard', ['gpt-4o']);
      expect(result).toEqual([]);
    });
  });

  describe('clearFallbacks', () => {
    it('no-ops when no row exists', async () => {
      tierRepo.findOne.mockResolvedValue(null);
      await svc.clearFallbacks('agent-1', 'standard');
      expect(tierRepo.save).not.toHaveBeenCalled();
    });

    it('clears fallback_routes and saves when row exists', async () => {
      const existing = {
        fallback_routes: [route('openai', 'api_key', 'gpt-4o')],
      } as unknown as TierAssignment;
      tierRepo.findOne.mockResolvedValue(existing);

      await svc.clearFallbacks('agent-1', 'standard');
      expect(existing.fallback_routes).toBeNull();
      expect(tierRepo.save).toHaveBeenCalledWith(existing);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });
});
