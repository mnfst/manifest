import { Test, TestingModule } from '@nestjs/testing';
import { RoutingCacheService } from './routing-cache.service';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { UserProvider } from '../entities/user-provider.entity';

describe('RoutingCacheService', () => {
  let service: RoutingCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoutingCacheService],
    }).compile();

    service = module.get<RoutingCacheService>(RoutingCacheService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getTiers', () => {
    it('returns null when not cached', () => {
      expect(service.getTiers('agent-1')).toBeNull();
    });

    it('returns cached data within TTL', () => {
      const tiers = [{ id: 'ta-1', tier: 'fast' }] as TierAssignment[];
      service.setTiers('agent-1', tiers);

      const result = service.getTiers('agent-1');
      expect(result).toEqual(tiers);
    });

    it('returns null after TTL expires', () => {
      jest.useFakeTimers();
      const tiers = [{ id: 'ta-1', tier: 'fast' }] as TierAssignment[];
      service.setTiers('agent-1', tiers);

      jest.advanceTimersByTime(120_001);

      expect(service.getTiers('agent-1')).toBeNull();
    });
  });

  describe('setTiers', () => {
    it('stores data that can be retrieved', () => {
      const tiers = [
        { id: 'ta-1', tier: 'fast' },
        { id: 'ta-2', tier: 'cheap' },
      ] as TierAssignment[];

      service.setTiers('agent-1', tiers);

      expect(service.getTiers('agent-1')).toEqual(tiers);
    });
  });

  describe('getProviders', () => {
    it('returns null when not cached', () => {
      expect(service.getProviders('agent-1')).toBeNull();
    });

    it('returns cached data within TTL', () => {
      const providers = [{ id: 'up-1', provider: 'openai' }] as UserProvider[];
      service.setProviders('agent-1', providers);

      const result = service.getProviders('agent-1');
      expect(result).toEqual(providers);
    });

    it('returns null after TTL expires', () => {
      jest.useFakeTimers();
      const providers = [{ id: 'up-1', provider: 'openai' }] as UserProvider[];
      service.setProviders('agent-1', providers);

      jest.advanceTimersByTime(120_001);

      expect(service.getProviders('agent-1')).toBeNull();
    });
  });

  describe('setProviders', () => {
    it('stores data that can be retrieved', () => {
      const providers = [
        { id: 'up-1', provider: 'openai' },
        { id: 'up-2', provider: 'anthropic' },
      ] as UserProvider[];

      service.setProviders('agent-1', providers);

      expect(service.getProviders('agent-1')).toEqual(providers);
    });
  });

  describe('setWithEviction', () => {
    it('evicts oldest entry when cache reaches MAX_ENTRIES', () => {
      const tiersMap = (service as any).tiers as Map<string, unknown>;
      for (let i = 0; i < 5_000; i++) {
        tiersMap.set(`agent-${i}`, { data: [], expiresAt: Date.now() + 120_000 });
      }
      expect(tiersMap.size).toBe(5_000);

      service.setTiers('new-agent', [{ id: 'ta-new' }] as TierAssignment[]);

      expect(tiersMap.size).toBe(5_000);
      expect(tiersMap.has('agent-0')).toBe(false);
    });

    it('does not evict when updating an existing key at capacity', () => {
      const tiersMap = (service as any).tiers as Map<string, unknown>;
      for (let i = 0; i < 5_000; i++) {
        tiersMap.set(`agent-${i}`, { data: [], expiresAt: Date.now() + 120_000 });
      }

      service.setTiers('agent-0', [{ id: 'ta-updated' }] as TierAssignment[]);

      expect(tiersMap.size).toBe(5_000);
      expect(tiersMap.has('agent-0')).toBe(true);
      expect(tiersMap.has('agent-1')).toBe(true);
    });
  });

  describe('getApiKey', () => {
    it('returns undefined when not cached', () => {
      expect(service.getApiKey('agent-1', 'openai')).toBeUndefined();
    });

    it('returns cached key within TTL', () => {
      service.setApiKey('agent-1', 'openai', 'sk-test-123');

      expect(service.getApiKey('agent-1', 'openai')).toBe('sk-test-123');
    });

    it('returns cached null within TTL', () => {
      service.setApiKey('agent-1', 'openai', null);

      expect(service.getApiKey('agent-1', 'openai')).toBeNull();
    });

    it('returns undefined after TTL expires', () => {
      jest.useFakeTimers();
      service.setApiKey('agent-1', 'openai', 'sk-test-123');

      jest.advanceTimersByTime(120_001);

      expect(service.getApiKey('agent-1', 'openai')).toBeUndefined();
    });

    it('isolates keys by provider', () => {
      service.setApiKey('agent-1', 'openai', 'sk-openai');
      service.setApiKey('agent-1', 'anthropic', 'sk-ant');

      expect(service.getApiKey('agent-1', 'openai')).toBe('sk-openai');
      expect(service.getApiKey('agent-1', 'anthropic')).toBe('sk-ant');
    });
  });

  describe('invalidateAgent', () => {
    it('clears tiers, providers, and api keys for agent', () => {
      const tiers = [{ id: 'ta-1', tier: 'fast' }] as TierAssignment[];
      const providers = [{ id: 'up-1', provider: 'openai' }] as UserProvider[];

      service.setTiers('agent-1', tiers);
      service.setProviders('agent-1', providers);
      service.setApiKey('agent-1', 'openai', 'sk-test');

      expect(service.getTiers('agent-1')).toEqual(tiers);
      expect(service.getProviders('agent-1')).toEqual(providers);
      expect(service.getApiKey('agent-1', 'openai')).toBe('sk-test');

      service.invalidateAgent('agent-1');

      expect(service.getTiers('agent-1')).toBeNull();
      expect(service.getProviders('agent-1')).toBeNull();
      expect(service.getApiKey('agent-1', 'openai')).toBeUndefined();
    });

    it('does not clear api keys for other agents', () => {
      service.setApiKey('agent-1', 'openai', 'sk-1');
      service.setApiKey('agent-2', 'openai', 'sk-2');

      service.invalidateAgent('agent-1');

      expect(service.getApiKey('agent-1', 'openai')).toBeUndefined();
      expect(service.getApiKey('agent-2', 'openai')).toBe('sk-2');
    });

    it('is a no-op for unknown agent', () => {
      // Should not throw when called with an agent that has no cached data
      expect(() => service.invalidateAgent('nonexistent-agent')).not.toThrow();
    });
  });
});
