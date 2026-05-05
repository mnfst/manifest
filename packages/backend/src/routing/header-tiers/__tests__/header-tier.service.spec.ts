import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ModelRoute, TierColor } from 'manifest-shared';
import { HeaderTierService, RESERVED_HEADER_KEYS } from '../header-tier.service';
import { HeaderTier } from '../../../entities/header-tier.entity';
import type { DiscoveredModel } from '../../../model-discovery/model-fetcher';
import type { RoutingCacheService } from '../../routing-core/routing-cache.service';
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

const validInput = (overrides: Partial<Parameters<HeaderTierService['create']>[3]> = {}) => ({
  name: 'Premium',
  header_key: 'x-tier',
  header_value: 'premium',
  badge_color: 'red' as TierColor,
  ...overrides,
});

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockImplementation(async (row) => row),
  delete: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
});

describe('HeaderTierService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let routingCache: {
    getHeaderTiers: jest.Mock;
    setHeaderTiers: jest.Mock;
    invalidateAgent: jest.Mock;
  };
  let discoveryService: jest.Mocked<Pick<ModelDiscoveryService, 'getModelsForAgent'>>;
  let svc: HeaderTierService;

  beforeEach(() => {
    repo = makeRepo();
    routingCache = {
      getHeaderTiers: jest.fn().mockReturnValue(null),
      setHeaderTiers: jest.fn(),
      invalidateAgent: jest.fn(),
    };
    discoveryService = { getModelsForAgent: jest.fn().mockResolvedValue([]) };
    svc = new HeaderTierService(
      repo as unknown as Repository<HeaderTier>,
      routingCache as unknown as RoutingCacheService,
      discoveryService as unknown as ModelDiscoveryService,
    );
  });

  describe('list', () => {
    it('returns the cached value when present', async () => {
      const cached = [{ id: 'h1' }] as HeaderTier[];
      routingCache.getHeaderTiers.mockReturnValue(cached);
      expect(await svc.list('agent-1')).toBe(cached);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('reads sorted by sort_order and caches', async () => {
      const rows = [{ id: 'h1' }] as HeaderTier[];
      repo.find.mockResolvedValue(rows);
      const result = await svc.list('agent-1');
      expect(result).toBe(rows);
      expect(repo.find).toHaveBeenCalledWith({
        where: { agent_id: 'agent-1' },
        order: { sort_order: 'ASC' },
      });
      expect(routingCache.setHeaderTiers).toHaveBeenCalledWith('agent-1', rows);
    });
  });

  describe('create', () => {
    it('creates a header tier with sort_order 0 when no siblings exist', async () => {
      repo.find.mockResolvedValue([]);
      const result = await svc.create('agent-1', 'user-1', 'tenant-1', validInput());
      expect(repo.insert).toHaveBeenCalledTimes(1);
      expect(result.sort_order).toBe(0);
      expect(result.name).toBe('Premium');
      expect(result.header_key).toBe('x-tier');
      expect(result.header_value).toBe('premium');
      expect(result.badge_color).toBe('red');
      expect(result.tenant_id).toBe('tenant-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('appends after the highest existing sort_order', async () => {
      repo.find.mockResolvedValue([
        { id: 'a', sort_order: 0, name: 'A', header_key: 'x', header_value: 'a' } as HeaderTier,
        { id: 'b', sort_order: 4, name: 'B', header_key: 'x', header_value: 'b' } as HeaderTier,
      ]);
      const result = await svc.create('agent-1', 'user-1', null, validInput());
      expect(result.sort_order).toBe(5);
    });

    it('rejects empty names', async () => {
      await expect(
        svc.create('agent-1', 'user-1', null, validInput({ name: '   ' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects oversized names', async () => {
      await expect(
        svc.create('agent-1', 'user-1', null, validInput({ name: 'a'.repeat(33) })),
      ).rejects.toThrow(/32 characters/);
    });

    it('rejects header keys with disallowed characters', async () => {
      await expect(
        svc.create('agent-1', 'user-1', null, validInput({ header_key: 'X-Bad_Key' })),
      ).rejects.toThrow(/lowercase letters/);
    });

    it('rejects empty header keys', async () => {
      await expect(
        svc.create('agent-1', 'user-1', null, validInput({ header_key: '' })),
      ).rejects.toThrow(/Header key is required/);
    });

    it('rejects reserved header keys', async () => {
      const reserved = [...RESERVED_HEADER_KEYS][0];
      await expect(
        svc.create('agent-1', 'user-1', null, validInput({ header_key: reserved })),
      ).rejects.toThrow(/stripped for security/);
    });

    it('rejects empty header values', async () => {
      await expect(
        svc.create('agent-1', 'user-1', null, validInput({ header_value: '' })),
      ).rejects.toThrow(/Header value is required/);
    });

    it('rejects oversized header values', async () => {
      await expect(
        svc.create('agent-1', 'user-1', null, validInput({ header_value: 'x'.repeat(129) })),
      ).rejects.toThrow(/128 characters/);
    });

    it('rejects invalid colors', async () => {
      await expect(
        svc.create('agent-1', 'user-1', null, validInput({ badge_color: 'rainbow' as TierColor })),
      ).rejects.toThrow(/badge color/);
    });

    it('rejects duplicate names case-insensitively', async () => {
      repo.find.mockResolvedValue([
        {
          id: 'h1',
          name: 'PREMIUM',
          header_key: 'x',
          header_value: 'a',
          sort_order: 0,
        } as HeaderTier,
      ]);
      await expect(
        svc.create('agent-1', 'user-1', null, validInput({ name: 'premium' })),
      ).rejects.toThrow(/already exists/);
    });

    it('rejects duplicate (header_key, header_value) pairs', async () => {
      repo.find.mockResolvedValue([
        {
          id: 'h1',
          name: 'Other',
          header_key: 'x-tier',
          header_value: 'premium',
          sort_order: 0,
        } as HeaderTier,
      ]);
      await expect(svc.create('agent-1', 'user-1', null, validInput())).rejects.toThrow(
        /already matches/,
      );
    });
  });

  describe('update', () => {
    it('throws NotFound when row does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.update('agent-1', 'h1', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('updates only provided fields', async () => {
      const row = {
        id: 'h1',
        agent_id: 'agent-1',
        name: 'Old',
        header_key: 'x-tier',
        header_value: 'old',
        badge_color: 'red' as TierColor,
        sort_order: 0,
      } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      repo.find.mockResolvedValue([row]);

      const result = await svc.update('agent-1', 'h1', { name: 'New' });
      expect(result.name).toBe('New');
      expect(result.header_key).toBe('x-tier');
      expect(result.header_value).toBe('old');
      expect(repo.save).toHaveBeenCalledWith(row);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('updates header_key, header_value and badge_color when supplied', async () => {
      const row = {
        id: 'h1',
        agent_id: 'agent-1',
        name: 'A',
        header_key: 'x-tier',
        header_value: 'old',
        badge_color: 'red' as TierColor,
      } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      repo.find.mockResolvedValue([row]);

      const result = await svc.update('agent-1', 'h1', {
        header_key: 'x-band',
        header_value: 'gold',
        badge_color: 'blue' as TierColor,
      });
      expect(result.header_key).toBe('x-band');
      expect(result.header_value).toBe('gold');
      expect(result.badge_color).toBe('blue');
    });

    it('rejects renaming to a sibling name', async () => {
      const row = { id: 'h1', agent_id: 'agent-1', name: 'A' } as HeaderTier;
      const sibling = {
        id: 'h2',
        agent_id: 'agent-1',
        name: 'B',
        header_key: 'x',
        header_value: '1',
      } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      repo.find.mockResolvedValue([row, sibling]);
      await expect(svc.update('agent-1', 'h1', { name: 'B' })).rejects.toThrow(/already exists/);
    });

    it('rejects updates that collide with a sibling rule', async () => {
      const row = {
        id: 'h1',
        agent_id: 'agent-1',
        name: 'A',
        header_key: 'x-tier',
        header_value: 'a',
      } as HeaderTier;
      const sibling = {
        id: 'h2',
        agent_id: 'agent-1',
        name: 'B',
        header_key: 'x-tier',
        header_value: 'b',
      } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      repo.find.mockResolvedValue([row, sibling]);
      await expect(svc.update('agent-1', 'h1', { header_value: 'b' })).rejects.toThrow(
        /already matches/,
      );
    });
  });

  describe('setEnabled', () => {
    it('flips the enabled flag and saves', async () => {
      const row = { id: 'h1', agent_id: 'agent-1', enabled: false } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      const result = await svc.setEnabled('agent-1', 'h1', true);
      expect(result.enabled).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(row);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('throws NotFound when missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.setEnabled('agent-1', 'h1', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes when row exists', async () => {
      const row = { id: 'h1', agent_id: 'agent-1' } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      await svc.delete('agent-1', 'h1');
      expect(repo.delete).toHaveBeenCalledWith({ id: 'h1' });
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('throws NotFound when row missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.delete('agent-1', 'h1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('rejects non-array input', async () => {
      await expect(svc.reorder('agent-1', 'not-array' as unknown as string[])).rejects.toThrow(
        /array/,
      );
    });

    it('rejects when length mismatches the existing tier count', async () => {
      repo.find.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as HeaderTier[]);
      await expect(svc.reorder('agent-1', ['a'])).rejects.toThrow(/include every existing tier/);
    });

    it('rejects when ids contain duplicates', async () => {
      repo.find.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as HeaderTier[]);
      await expect(svc.reorder('agent-1', ['a', 'a'])).rejects.toThrow(/duplicate ids/);
    });

    it('rejects when ids reference unknown rows', async () => {
      repo.find.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as HeaderTier[]);
      await expect(svc.reorder('agent-1', ['a', 'unknown'])).rejects.toThrow(
        /include every existing tier/,
      );
    });

    it('updates sort_order in place and saves the batch', async () => {
      const rows = [
        { id: 'a', sort_order: 0 } as HeaderTier,
        { id: 'b', sort_order: 1 } as HeaderTier,
      ];
      repo.find.mockResolvedValue(rows);
      await svc.reorder('agent-1', ['b', 'a']);
      expect(rows[0].sort_order).toBe(1);
      expect(rows[1].sort_order).toBe(0);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('setOverride', () => {
    it('uses the explicit triple when supplied (skipping discovery)', async () => {
      const row = { id: 'h1', agent_id: 'agent-1', override_route: null } as HeaderTier;
      repo.findOne.mockResolvedValue(row);

      const result = await svc.setOverride('agent-1', 'h1', 'gpt-4o', 'openai', 'api_key');
      expect(discoveryService.getModelsForAgent).not.toHaveBeenCalled();
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
      expect(repo.save).toHaveBeenCalledWith(row);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('resolves via discovery when only the model is given', async () => {
      const row = { id: 'h1', agent_id: 'agent-1', override_route: null } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      const result = await svc.setOverride('agent-1', 'h1', 'gpt-4o');
      expect(result.override_route).toEqual(route('openai', 'api_key', 'gpt-4o'));
    });

    it('persists null when discovery cannot resolve unambiguously', async () => {
      const row = { id: 'h1', agent_id: 'agent-1', override_route: null } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      discoveryService.getModelsForAgent.mockResolvedValue([]);
      const result = await svc.setOverride('agent-1', 'h1', 'gpt-4o');
      expect(result.override_route).toBeNull();
    });

    it('throws NotFound when row missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.setOverride('agent-1', 'h1', 'gpt-4o')).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearOverride', () => {
    it('clears override and fallbacks', async () => {
      const row = {
        id: 'h1',
        agent_id: 'agent-1',
        override_route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: [route('anthropic', 'api_key', 'claude')],
      } as unknown as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      await svc.clearOverride('agent-1', 'h1');
      expect(row.override_route).toBeNull();
      expect(row.fallback_routes).toBeNull();
      expect(repo.save).toHaveBeenCalledWith(row);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('setFallbacks', () => {
    it('saves caller-provided routes when they validate', async () => {
      const row = {
        id: 'h1',
        agent_id: 'agent-1',
        fallback_routes: null,
      } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);

      const provided = [route('openai', 'api_key', 'gpt-4o')];
      const result = await svc.setFallbacks('agent-1', 'h1', ['gpt-4o'], provided);
      expect(result).toEqual(provided);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('returns [] when models is empty', async () => {
      repo.findOne.mockResolvedValue({ id: 'h1', agent_id: 'agent-1' } as HeaderTier);
      const result = await svc.setFallbacks('agent-1', 'h1', []);
      expect(result).toEqual([]);
    });

    it('returns [] when discovery cannot disambiguate', async () => {
      repo.findOne.mockResolvedValue({ id: 'h1', agent_id: 'agent-1' } as HeaderTier);
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
        discovered('gpt-4o', 'openai', 'subscription'),
      ]);
      const result = await svc.setFallbacks('agent-1', 'h1', ['gpt-4o']);
      expect(result).toEqual([]);
    });

    it('falls back to discovery when provided routes do not align', async () => {
      repo.findOne.mockResolvedValue({
        id: 'h1',
        agent_id: 'agent-1',
        fallback_routes: null,
      } as HeaderTier);
      discoveryService.getModelsForAgent.mockResolvedValue([
        discovered('gpt-4o', 'openai', 'api_key'),
      ]);
      const result = await svc.setFallbacks(
        'agent-1',
        'h1',
        ['gpt-4o'],
        [route('different', 'api_key', 'gpt-4o')],
      );
      expect(result).toEqual([route('openai', 'api_key', 'gpt-4o')]);
    });

    it('throws NotFound when row missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.setFallbacks('agent-1', 'h1', ['gpt-4o'])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('clearFallbacks', () => {
    it('clears fallback_routes when row exists', async () => {
      const row = {
        id: 'h1',
        agent_id: 'agent-1',
        fallback_routes: [route('openai', 'api_key', 'gpt-4o')],
      } as unknown as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      await svc.clearFallbacks('agent-1', 'h1');
      expect(row.fallback_routes).toBeNull();
      expect(repo.save).toHaveBeenCalledWith(row);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('throws NotFound when row missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.clearFallbacks('agent-1', 'h1')).rejects.toThrow(NotFoundException);
    });
  });
});
