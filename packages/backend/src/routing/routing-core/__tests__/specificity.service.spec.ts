import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ModelRoute } from 'manifest-shared';
import { SpecificityService } from '../specificity.service';
import { SpecificityAssignment } from '../../../entities/specificity-assignment.entity';
import type { DiscoveredModel } from '../../../model-discovery/model-fetcher';
import type { RoutingCacheService } from '../routing-cache.service';
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

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockImplementation(async (row) => row),
  update: jest.fn().mockResolvedValue(undefined),
});

describe('SpecificityService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let routingCache: {
    getSpecificity: jest.Mock;
    setSpecificity: jest.Mock;
    invalidateAgent: jest.Mock;
  };
  let discoveryService: jest.Mocked<Pick<ModelDiscoveryService, 'getModelsForAgent'>>;
  let svc: SpecificityService;

  beforeEach(() => {
    repo = makeRepo();
    routingCache = {
      getSpecificity: jest.fn().mockReturnValue(null),
      setSpecificity: jest.fn(),
      invalidateAgent: jest.fn(),
    };
    discoveryService = { getModelsForAgent: jest.fn().mockResolvedValue([]) };

    svc = new SpecificityService(
      repo as unknown as Repository<SpecificityAssignment>,
      routingCache as unknown as RoutingCacheService,
      discoveryService as unknown as ModelDiscoveryService,
    );
  });

  describe('getAssignments', () => {
    it('returns the cached value without touching the repo', async () => {
      const cached = [{ category: 'coding' }] as SpecificityAssignment[];
      routingCache.getSpecificity.mockReturnValue(cached);
      const result = await svc.getAssignments('agent-1');
      expect(result).toBe(cached);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('reads from the repo and caches when no cache hit', async () => {
      const rows = [{ category: 'coding' }] as SpecificityAssignment[];
      repo.find.mockResolvedValue(rows);
      const result = await svc.getAssignments('agent-1');
      expect(result).toBe(rows);
      expect(routingCache.setSpecificity).toHaveBeenCalledWith('agent-1', rows);
    });
  });

  describe('getActiveAssignments', () => {
    it('returns only active assignments', async () => {
      repo.find.mockResolvedValue([
        { category: 'coding', is_active: true } as SpecificityAssignment,
        { category: 'web_browsing', is_active: false } as SpecificityAssignment,
      ]);
      const result = await svc.getActiveAssignments('agent-1');
      expect(result.map((a) => a.category)).toEqual(['coding']);
    });
  });

  describe('toggleCategory', () => {
    it('updates the existing row when present', async () => {
      const existing = {
        category: 'coding',
        is_active: false,
      } as unknown as SpecificityAssignment;
      repo.findOne.mockResolvedValue(existing);
      const result = await svc.toggleCategory('agent-1', 'user-1', 'coding', true);
      expect(result.is_active).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(existing);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('inserts a new row when none exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await svc.toggleCategory('agent-1', 'user-1', 'coding', true);
      expect(repo.insert).toHaveBeenCalledTimes(1);
      expect(result.is_active).toBe(true);
      expect(result.category).toBe('coding');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('retries when insert collides with a unique index', async () => {
      repo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ category: 'coding', is_active: false } as SpecificityAssignment)
        .mockResolvedValueOnce({ category: 'coding', is_active: false } as SpecificityAssignment);
      repo.insert.mockRejectedValueOnce(new Error('duplicate'));
      const result = await svc.toggleCategory('agent-1', 'user-1', 'coding', true);
      expect(result.is_active).toBe(true);
    });

    it('returns the freshly built record when insert fails and no retry row exists', async () => {
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      repo.insert.mockRejectedValueOnce(new Error('unrelated'));
      const result = await svc.toggleCategory('agent-1', 'user-1', 'coding', true);
      expect(result.category).toBe('coding');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('setOverride', () => {
    it('throws when the route is ambiguous', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
        discovered('gpt-4o', 'openai', 'subscription'),
      ]);
      await expect(svc.setOverride('agent-1', 'user-1', 'coding', 'gpt-4o')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates existing row, marks active, and saves', async () => {
      const existing = {
        category: 'coding',
        is_active: false,
        override_route: null,
      } as unknown as SpecificityAssignment;
      repo.findOne.mockResolvedValue(existing);
      const result = await svc.setOverride(
        'agent-1',
        'user-1',
        'coding',
        'gpt-4o',
        'openai',
        'api_key',
      );
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
      expect(result.is_active).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(existing);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('falls back to discovery resolution when no explicit triple is passed', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      repo.findOne.mockResolvedValue(null);
      const result = await svc.setOverride('agent-1', 'user-1', 'coding', 'gpt-4o');
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
      expect(repo.insert).toHaveBeenCalledTimes(1);
    });

    it('inserts a new row when no existing row exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await svc.setOverride(
        'agent-1',
        'user-1',
        'coding',
        'gpt-4o',
        'openai',
        'api_key',
      );
      expect(repo.insert).toHaveBeenCalledTimes(1);
      expect(result.is_active).toBe(true);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('retries on unique-index collision', async () => {
      const existing = {
        category: 'coding',
        is_active: false,
        override_route: null,
      } as unknown as SpecificityAssignment;
      repo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(existing);
      repo.insert.mockRejectedValueOnce(new Error('duplicate'));
      const result = await svc.setOverride(
        'agent-1',
        'user-1',
        'coding',
        'gpt-4o',
        'openai',
        'api_key',
      );
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
    });

    it('returns built record when insert fails without a retry row', async () => {
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      repo.insert.mockRejectedValueOnce(new Error('unrelated'));
      const result = await svc.setOverride(
        'agent-1',
        'user-1',
        'coding',
        'gpt-4o',
        'openai',
        'api_key',
      );
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
    });
  });

  describe('clearOverride', () => {
    it('no-ops when no row exists', async () => {
      repo.findOne.mockResolvedValue(null);
      await svc.clearOverride('agent-1', 'coding');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('clears override_route and fallback_routes', async () => {
      const existing = {
        override_route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: [route('anthropic', 'api_key', 'claude')],
      } as unknown as SpecificityAssignment;
      repo.findOne.mockResolvedValue(existing);
      await svc.clearOverride('agent-1', 'coding');
      expect(existing.override_route).toBeNull();
      expect(existing.fallback_routes).toBeNull();
      expect(repo.save).toHaveBeenCalledWith(existing);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('setFallbacks', () => {
    it('returns [] when no row exists', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await svc.setFallbacks('agent-1', 'coding', ['gpt-4o'])).toEqual([]);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('saves caller-provided routes when they validate', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      repo.findOne.mockResolvedValue({
        agent_id: 'agent-1',
        category: 'coding',
        fallback_routes: null,
      } as SpecificityAssignment);
      const provided = [route('openai', 'api_key', 'gpt-4o')];
      const result = await svc.setFallbacks('agent-1', 'coding', ['gpt-4o'], provided);
      expect(result).toEqual(provided);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('falls back to discovery when explicit routes fail validation', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      repo.findOne.mockResolvedValue({
        agent_id: 'agent-1',
        category: 'coding',
        fallback_routes: null,
      } as SpecificityAssignment);
      const result = await svc.setFallbacks(
        'agent-1',
        'coding',
        ['gpt-4o'],
        [route('different-provider', 'api_key', 'gpt-4o')],
      );
      expect(result).toEqual([route('openai', 'api_key', 'gpt-4o')]);
    });

    it('returns [] when models is empty', async () => {
      repo.findOne.mockResolvedValue({
        fallback_routes: null,
      } as SpecificityAssignment);
      expect(await svc.setFallbacks('agent-1', 'coding', [])).toEqual([]);
    });

    it('returns [] when any model cannot be unambiguously resolved', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
        discovered('gpt-4o', 'openai', 'subscription'),
      ]);
      repo.findOne.mockResolvedValue({
        fallback_routes: null,
      } as SpecificityAssignment);
      const result = await svc.setFallbacks('agent-1', 'coding', ['gpt-4o']);
      expect(result).toEqual([]);
    });
  });

  describe('clearFallbacks', () => {
    it('no-ops when no row exists', async () => {
      repo.findOne.mockResolvedValue(null);
      await svc.clearFallbacks('agent-1', 'coding');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('clears fallback_routes when row exists', async () => {
      const existing = {
        fallback_routes: [route('openai', 'api_key', 'gpt-4o')],
      } as unknown as SpecificityAssignment;
      repo.findOne.mockResolvedValue(existing);
      await svc.clearFallbacks('agent-1', 'coding');
      expect(existing.fallback_routes).toBeNull();
      expect(repo.save).toHaveBeenCalledWith(existing);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('resetAll', () => {
    it('deactivates and clears all assignments for an agent', async () => {
      await svc.resetAll('agent-1');
      expect(repo.update).toHaveBeenCalledWith(
        { agent_id: 'agent-1' },
        expect.objectContaining({
          is_active: false,
          override_route: null,
          fallback_routes: null,
        }),
      );
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });
});
