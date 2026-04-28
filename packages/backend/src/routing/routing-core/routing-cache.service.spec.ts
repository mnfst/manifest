import { RoutingCacheService } from './routing-cache.service';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';

// Minimal stand-ins for the TypeORM entities. The cache is entity-agnostic — it
// only stores arrays by reference, so shape fidelity is unnecessary.
const tier = (name: string): TierAssignment => ({ id: name }) as unknown as TierAssignment;
const provider = (name: string): UserProvider => ({ id: name }) as unknown as UserProvider;
const customProvider = (name: string): CustomProvider =>
  ({ id: name }) as unknown as CustomProvider;
const specificity = (name: string): SpecificityAssignment =>
  ({ id: name }) as unknown as SpecificityAssignment;

describe('RoutingCacheService', () => {
  let svc: RoutingCacheService;

  beforeEach(() => {
    svc = new RoutingCacheService();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('tier cache', () => {
    it('returns null when nothing is cached', () => {
      expect(svc.getTiers('agent-1')).toBeNull();
    });

    it('returns cached data on a hit', () => {
      const data = [tier('t1')];
      svc.setTiers('agent-1', data);
      expect(svc.getTiers('agent-1')).toBe(data);
    });

    it('expires entries after the 2-minute TTL and purges the stale key', () => {
      svc.setTiers('agent-1', [tier('t1')]);
      jest.advanceTimersByTime(119_000);
      expect(svc.getTiers('agent-1')).not.toBeNull();
      jest.advanceTimersByTime(2_000); // cross the 120s boundary
      expect(svc.getTiers('agent-1')).toBeNull();
    });
  });

  describe('provider, customProvider and specificity caches', () => {
    it('store and return data independently', () => {
      const p = [provider('p1')];
      const c = [customProvider('c1')];
      const s = [specificity('s1')];
      svc.setProviders('a', p);
      svc.setCustomProviders('a', c);
      svc.setSpecificity('a', s);
      expect(svc.getProviders('a')).toBe(p);
      expect(svc.getCustomProviders('a')).toBe(c);
      expect(svc.getSpecificity('a')).toBe(s);
    });

    it('return null for a different agent id', () => {
      svc.setProviders('a', [provider('p1')]);
      expect(svc.getProviders('b')).toBeNull();
    });
  });

  describe('api key cache', () => {
    it('returns undefined when nothing is cached', () => {
      expect(svc.getApiKey('a', 'openai')).toBeUndefined();
    });

    it('caches a null value (provider with no key) as a distinct hit', () => {
      svc.setApiKey('a', 'openai', null);
      // Null is a cached value — getApiKey should return null, not undefined.
      expect(svc.getApiKey('a', 'openai')).toBeNull();
    });

    it('keys by (agentId, provider, authType) — different authType is a separate slot', () => {
      svc.setApiKey('a', 'openai', 'key-default');
      svc.setApiKey('a', 'openai', 'key-sub', 'subscription');
      expect(svc.getApiKey('a', 'openai')).toBe('key-default');
      expect(svc.getApiKey('a', 'openai', 'subscription')).toBe('key-sub');
    });
  });

  describe('invalidateAgent', () => {
    it('clears every cache slot for the agent, including all per-provider api keys', () => {
      svc.setTiers('a', [tier('t1')]);
      svc.setProviders('a', [provider('p1')]);
      svc.setCustomProviders('a', [customProvider('c1')]);
      svc.setSpecificity('a', [specificity('s1')]);
      svc.setApiKey('a', 'openai', 'k');
      svc.setApiKey('a', 'anthropic', 'k', 'subscription');

      // Unrelated agent entries should survive.
      svc.setTiers('b', [tier('t-b')]);
      svc.setApiKey('b', 'openai', 'k-b');

      svc.invalidateAgent('a');

      expect(svc.getTiers('a')).toBeNull();
      expect(svc.getProviders('a')).toBeNull();
      expect(svc.getCustomProviders('a')).toBeNull();
      expect(svc.getSpecificity('a')).toBeNull();
      expect(svc.getApiKey('a', 'openai')).toBeUndefined();
      expect(svc.getApiKey('a', 'anthropic', 'subscription')).toBeUndefined();

      expect(svc.getTiers('b')).not.toBeNull();
      expect(svc.getApiKey('b', 'openai')).toBe('k-b');
    });
  });

  describe('LRU-style eviction at the cap', () => {
    it('evicts the oldest entry when a new key is inserted at the cap', () => {
      // Fill to MAX_ENTRIES (5000) using tier slots.
      for (let i = 0; i < 5000; i++) {
        svc.setTiers(`agent-${i}`, [tier(`t-${i}`)]);
      }
      // Inserting a new key should evict the first-inserted one.
      svc.setTiers('agent-new', [tier('t-new')]);
      expect(svc.getTiers('agent-0')).toBeNull();
      expect(svc.getTiers('agent-new')).not.toBeNull();
      expect(svc.getTiers('agent-4999')).not.toBeNull();
    });

    it('updates (does not evict) when writing the same key at the cap', () => {
      for (let i = 0; i < 5000; i++) {
        svc.setTiers(`agent-${i}`, [tier(`t-${i}`)]);
      }
      svc.setTiers('agent-0', [tier('t-updated')]);
      expect(svc.getTiers('agent-0')).toEqual([{ id: 't-updated' }]);
      // No eviction should have happened.
      expect(svc.getTiers('agent-4999')).not.toBeNull();
    });
  });
});
