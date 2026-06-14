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

    it('keys by (userId, provider, authType) — different authType is a separate slot', () => {
      const def = [providerKey('Default', 'key-default')];
      const sub = [providerKey('Default', 'key-sub')];
      svc.setProviderKeys('a', 'openai', def);
      svc.setProviderKeys('a', 'openai', sub, 'subscription');
      expect(svc.getProviderKeys('a', 'openai')).toBe(def);
      expect(svc.getProviderKeys('a', 'openai', 'subscription')).toBe(sub);
    });

    it('scopes the agent-qualified chain separately from the user-global one', () => {
      const global = [providerKey('Default', 'k-global')];
      const scoped = [providerKey('Default', 'k-scoped')];
      svc.setProviderKeys('u1', 'openai', global);
      svc.setProviderKeys('u1', 'openai', scoped, undefined, 'agent-1');
      expect(svc.getProviderKeys('u1', 'openai')).toBe(global);
      expect(svc.getProviderKeys('u1', 'openai', undefined, 'agent-1')).toBe(scoped);
    });
  });

  describe('invalidateAgent', () => {
    it('clears agent-scoped caches (tiers, specificity, modelParams, providerKeys); providers remain user-scoped', () => {
      svc.setTiers('a', [tier('t1')]);
      // Providers and customProviders are now user-scoped — stored under userId 'u1', not agentId 'a'.
      svc.setProviders('u1', [provider('p1')]);
      svc.setCustomProviders('u1', [customProvider('c1')]);
      svc.setSpecificity('a', [specificity('s1')]);
      svc.setModelParams('a', [modelParams('mp1')]);
      // Agent-scoped key chains carry the agentId as the trailing segment.
      svc.setProviderKeys('u1', 'openai', [providerKey('Default', 'k')], undefined, 'a');
      svc.setProviderKeys('u1', 'anthropic', [providerKey('Default', 'k')], 'subscription', 'a');

      // Unrelated agent entries should survive.
      svc.setTiers('b', [tier('t-b')]);
      const bKeys = [providerKey('Default', 'k-b')];
      svc.setProviderKeys('u1', 'openai', bKeys, undefined, 'b');

      svc.invalidateAgent('a');

      // Agent-scoped caches cleared
      expect(svc.getTiers('a')).toBeNull();
      expect(svc.getSpecificity('a')).toBeNull();
      expect(svc.getModelParams('a')).toBeNull();
      expect(svc.getProviderKeys('u1', 'openai', undefined, 'a')).toBeUndefined();
      expect(svc.getProviderKeys('u1', 'anthropic', 'subscription', 'a')).toBeUndefined();

      // User-scoped provider caches NOT cleared by invalidateAgent
      expect(svc.getProviders('u1')).not.toBeNull();
      expect(svc.getCustomProviders('u1')).not.toBeNull();

      // Unrelated agent entries survive
      expect(svc.getTiers('b')).not.toBeNull();
      expect(svc.getProviderKeys('u1', 'openai', undefined, 'b')).toBe(bKeys);
    });
  });

  describe('invalidateUser', () => {
    it('clears user-scoped provider caches and user-keyed providerKeys; agent caches survive', () => {
      svc.setProviders('u1', [provider('p1')]);
      svc.setCustomProviders('u1', [customProvider('c1')]);
      svc.setProviderKeys('u1', 'openai', [providerKey('Default', 'k')]);
      // Agent-scoped chain for the same user — also cleared by invalidateUser.
      svc.setProviderKeys(
        'u1',
        'openai',
        [providerKey('Default', 'k-scoped')],
        undefined,
        'agent-x',
      );
      // A different user's chain must survive.
      svc.setProviderKeys('u2', 'openai', [providerKey('Default', 'k-other')]);

      // Agent-scoped tier cache should survive invalidateUser (it is not user-keyed).
      svc.setTiers('agent-x', [tier('t1')]);

      svc.invalidateUser('u1');

      expect(svc.getProviders('u1')).toBeNull();
      expect(svc.getCustomProviders('u1')).toBeNull();
      expect(svc.getProviderKeys('u1', 'openai')).toBeUndefined();
      expect(svc.getProviderKeys('u1', 'openai', undefined, 'agent-x')).toBeUndefined();

      // Other user's chain survives
      expect(svc.getProviderKeys('u2', 'openai')?.[0].apiKey).toBe('k-other');

      // Agent tiers are untouched
      expect(svc.getTiers('agent-x')).not.toBeNull();
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
