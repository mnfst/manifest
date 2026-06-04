import { CachedProviderKey, RoutingCacheService } from './routing-cache.service';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { AgentModelParams } from '../../entities/agent-model-params.entity';

// Minimal stand-ins for the TypeORM entities. The cache is entity-agnostic — it
// only stores arrays by reference, so shape fidelity is unnecessary.
const tier = (name: string): TierAssignment => ({ id: name }) as unknown as TierAssignment;
const provider = (name: string): UserProvider => ({ id: name }) as unknown as UserProvider;
const customProvider = (name: string): CustomProvider =>
  ({ id: name }) as unknown as CustomProvider;
const specificity = (name: string): SpecificityAssignment =>
  ({ id: name }) as unknown as SpecificityAssignment;
const modelParams = (name: string): AgentModelParams =>
  ({ id: name }) as unknown as AgentModelParams;
const providerKey = (label: string, apiKey: string | null = 'sk-test'): CachedProviderKey => ({
  id: label,
  label,
  priority: 0,
  apiKey,
  region: null,
});

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

  describe('provider key cache', () => {
    it('returns undefined when nothing is cached', () => {
      expect(svc.getProviderKeys('a', 'openai')).toBeUndefined();
    });

    it('caches an empty list (provider with no keys) as a distinct hit', () => {
      svc.setProviderKeys('a', 'openai', []);
      expect(svc.getProviderKeys('a', 'openai')).toEqual([]);
    });

    it('keys by (agentId, provider, authType) — different authType is a separate slot', () => {
      const def = [providerKey('Default', 'key-default')];
      const sub = [providerKey('Default', 'key-sub')];
      svc.setProviderKeys('a', 'openai', def);
      svc.setProviderKeys('a', 'openai', sub, 'subscription');
      expect(svc.getProviderKeys('a', 'openai')).toBe(def);
      expect(svc.getProviderKeys('a', 'openai', 'subscription')).toBe(sub);
    });
  });

  describe('invalidateAgent', () => {
    it('clears every cache slot for the agent, including all per-provider key chains', () => {
      svc.setTiers('a', [tier('t1')]);
      svc.setProviders('a', [provider('p1')]);
      svc.setCustomProviders('a', [customProvider('c1')]);
      svc.setSpecificity('a', [specificity('s1')]);
      svc.setModelParams('a', [modelParams('mp1')]);
      svc.setProviderKeys('a', 'openai', [providerKey('Default', 'k')]);
      svc.setProviderKeys('a', 'anthropic', [providerKey('Default', 'k')], 'subscription');

      // Unrelated agent entries should survive.
      svc.setTiers('b', [tier('t-b')]);
      const bKeys = [providerKey('Default', 'k-b')];
      svc.setProviderKeys('b', 'openai', bKeys);

      svc.invalidateAgent('a');

      expect(svc.getTiers('a')).toBeNull();
      expect(svc.getProviders('a')).toBeNull();
      expect(svc.getCustomProviders('a')).toBeNull();
      expect(svc.getSpecificity('a')).toBeNull();
      expect(svc.getModelParams('a')).toBeNull();
      expect(svc.getProviderKeys('a', 'openai')).toBeUndefined();
      expect(svc.getProviderKeys('a', 'anthropic', 'subscription')).toBeUndefined();

      expect(svc.getTiers('b')).not.toBeNull();
      expect(svc.getProviderKeys('b', 'openai')).toBe(bKeys);
    });
  });

  describe('invalidation listeners', () => {
    it('fires each registered listener with the agentId on invalidateAgent', () => {
      const a = jest.fn();
      const b = jest.fn();
      svc.addInvalidationListener(a);
      svc.addInvalidationListener(b);

      svc.invalidateAgent('agent-x');

      expect(a).toHaveBeenCalledWith('agent-x');
      expect(b).toHaveBeenCalledWith('agent-x');
    });

    it('isolates listener failures so one throw neither propagates nor skips others', () => {
      const throwing = jest.fn(() => {
        throw new Error('listener boom');
      });
      const after = jest.fn();
      svc.addInvalidationListener(throwing);
      svc.addInvalidationListener(after);
      svc.setTiers('agent-y', [tier('t1')]);

      expect(() => svc.invalidateAgent('agent-y')).not.toThrow();
      expect(throwing).toHaveBeenCalledWith('agent-y');
      expect(after).toHaveBeenCalledWith('agent-y');
      expect(svc.getTiers('agent-y')).toBeNull();
    });
  });

  describe('model params cache', () => {
    it('returns null until set, returns cached rows after, and the granular invalidate clears just the model-params slot', () => {
      expect(svc.getModelParams('a')).toBeNull();
      const rows = [modelParams('mp1')];
      svc.setModelParams('a', rows);
      expect(svc.getModelParams('a')).toBe(rows);

      // Granular invalidate (called on every set/delete from the model-params
      // service) leaves the other caches untouched.
      svc.setTiers('a', [tier('t1')]);
      svc.invalidateModelParams('a');
      expect(svc.getModelParams('a')).toBeNull();
      expect(svc.getTiers('a')).not.toBeNull();
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
