import { RateLimitTrackerService } from '../rate-limit-tracker.service';
import { ProviderRateLimit } from '../../../entities/provider-rate-limit.entity';

interface FakeRow {
  provider: string;
  auth_type: string;
  key_label: string | null;
  limit_type: string;
  period: string;
  limit_value: string | null;
  remaining_value: string | null;
  used_value: string;
  resets_at: string | null;
}

function makeHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('RateLimitTrackerService', () => {
  let repo: {
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let qb: Record<string, jest.Mock>;
  let getManyRows: ProviderRateLimit[];
  let service: RateLimitTrackerService;

  beforeEach(() => {
    getManyRows = [];
    qb = {
      where: jest.fn(),
      andWhere: jest.fn(),
      getMany: jest.fn(async () => getManyRows),
    };
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);

    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    service = new RateLimitTrackerService(
      repo as unknown as ConstructorParameters<typeof RateLimitTrackerService>[0],
    );
  });

  // Flush in-memory cache between tests by using unique userIds.
  let userCounter = 0;
  const nextUser = () => `user-${userCounter++}`;

  describe('captureFromResponse — OpenAI headers', () => {
    it('parses request + token limits and persists rows', async () => {
      const userId = nextUser();
      const res = new Response(null, {
        headers: makeHeaders({
          'x-ratelimit-limit-requests': '100',
          'x-ratelimit-remaining-requests': '60',
          'x-ratelimit-reset-requests': '6m32.512s',
          'x-ratelimit-limit-tokens': '1000',
          'x-ratelimit-remaining-tokens': '750',
          'x-ratelimit-reset-tokens': '30s',
        }),
      });

      service.captureFromResponse(res, userId, 'openai', 'api_key', 'k1');
      // allow fire-and-forget persistence microtask to settle
      await Promise.resolve();
      await Promise.resolve();

      expect(repo.save).toHaveBeenCalledTimes(2);
      const saved = repo.save.mock.calls.map((c) => c[0]);
      const requests = saved.find((s) => s.limit_type === 'requests');
      expect(requests.used_value).toBe('40');
      expect(requests.limit_value).toBe('100');
      expect(requests.remaining_value).toBe('60');
      expect(requests.resets_at).toContain('T'); // ISO timestamp
      const tokens = saved.find((s) => s.limit_type === 'tokens');
      expect(tokens.used_value).toBe('250');
    });

    it('treats chatgpt as openai', async () => {
      const userId = nextUser();
      const res = new Response(null, {
        headers: makeHeaders({ 'x-ratelimit-limit-requests': '10' }),
      });
      service.captureFromResponse(res, userId, 'chatgpt', 'subscription');
      await Promise.resolve();
      await Promise.resolve();
      expect(repo.save).toHaveBeenCalled();
    });

    it('computes null used_value when remaining missing', async () => {
      const userId = nextUser();
      const res = new Response(null, {
        headers: makeHeaders({ 'x-ratelimit-limit-requests': '10' }),
      });
      service.captureFromResponse(res, userId, 'openai', 'api_key');
      await Promise.resolve();
      await Promise.resolve();
      const saved = repo.save.mock.calls[0][0];
      expect(saved.used_value).toBe('0'); // null used -> '0'
      expect(saved.remaining_value).toBeNull();
    });

    it('persists an unlabeled key under the canonical Default connection label', async () => {
      const userId = nextUser();
      const res = new Response(null, {
        headers: makeHeaders({ 'x-ratelimit-limit-requests': '10' }),
      });
      // No keyLabel passed: the row must store an explicit 'Default', not NULL,
      // so it matches the analytics layer's NULL→'Default' connection keying.
      service.captureFromResponse(res, userId, 'openai', 'api_key');
      await Promise.resolve();
      await Promise.resolve();
      expect(repo.save.mock.calls[0][0].key_label).toBe('Default');

      const out = await service.getRateLimits(userId);
      expect(out[0].keyLabel).toBe('Default');
    });

    it('persists an empty-string key label under the canonical Default connection', async () => {
      const userId = nextUser();
      const res = new Response(null, {
        headers: makeHeaders({ 'x-ratelimit-limit-requests': '10' }),
      });
      service.captureFromResponse(res, userId, 'openai', 'api_key', '');
      await Promise.resolve();
      await Promise.resolve();
      expect(repo.save.mock.calls[0][0].key_label).toBe('Default');
    });
  });

  describe('captureFromResponse — Anthropic headers', () => {
    it('parses anthropic request + token limits with ISO reset passthrough', async () => {
      const userId = nextUser();
      const iso = '2026-01-01T00:00:00Z';
      const res = new Response(null, {
        headers: makeHeaders({
          'anthropic-ratelimit-requests-limit': '50',
          'anthropic-ratelimit-requests-remaining': '20',
          'anthropic-ratelimit-requests-reset': iso,
          'anthropic-ratelimit-tokens-limit': '5000',
          'anthropic-ratelimit-tokens-remaining': '4000',
          'anthropic-ratelimit-tokens-reset': iso,
        }),
      });
      service.captureFromResponse(res, userId, 'anthropic', 'subscription');
      await Promise.resolve();
      await Promise.resolve();
      expect(repo.save).toHaveBeenCalledTimes(2);
      const saved = repo.save.mock.calls.map((c) => c[0]);
      expect(saved.find((s) => s.limit_type === 'requests').resets_at).toBe(iso);
      expect(saved.find((s) => s.limit_type === 'tokens').used_value).toBe('1000');
    });

    it('handles anthropic headers with no reset value', async () => {
      const userId = nextUser();
      const res = new Response(null, {
        headers: makeHeaders({ 'anthropic-ratelimit-tokens-remaining': '100' }),
      });
      service.captureFromResponse(res, userId, 'anthropic', 'api_key');
      await Promise.resolve();
      await Promise.resolve();
      const saved = repo.save.mock.calls[0][0];
      expect(saved.limit_type).toBe('tokens');
      expect(saved.resets_at).toBeNull();
    });
  });

  describe('captureFromResponse — no-op paths', () => {
    it('does nothing for providers without rate-limit headers', () => {
      const userId = nextUser();
      const res = new Response(null, { headers: makeHeaders({}) });
      service.captureFromResponse(res, userId, 'gemini', 'api_key');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('does nothing for a known provider that emits no recognized headers', () => {
      const userId = nextUser();
      const res = new Response(null, { headers: makeHeaders({ 'x-other': '1' }) });
      service.captureFromResponse(res, userId, 'openai', 'api_key');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('swallows persistence errors (fire-and-forget)', async () => {
      const userId = nextUser();
      repo.save.mockRejectedValueOnce(new Error('db down'));
      const res = new Response(null, {
        headers: makeHeaders({ 'x-ratelimit-limit-requests': '10' }),
      });
      expect(() => service.captureFromResponse(res, userId, 'openai', 'api_key')).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('never throws when header access blows up', () => {
      const userId = nextUser();
      const badResponse = {
        get headers(): Headers {
          throw new Error('boom');
        },
      } as unknown as Response;
      expect(() =>
        service.captureFromResponse(badResponse, userId, 'openai', 'api_key'),
      ).not.toThrow();
    });
  });

  describe('parseResetDuration branches', () => {
    it('parses combined h/m/s/ms durations', async () => {
      const userId = nextUser();
      const res = new Response(null, {
        headers: makeHeaders({
          'x-ratelimit-limit-requests': '10',
          'x-ratelimit-remaining-requests': '5',
          'x-ratelimit-reset-requests': '1h2m3s500ms',
        }),
      });
      service.captureFromResponse(res, userId, 'openai', 'api_key');
      await Promise.resolve();
      await Promise.resolve();
      const saved = repo.save.mock.calls[0][0];
      expect(saved.resets_at).toContain('T');
    });

    it('returns null for an unparseable duration (no time units)', async () => {
      const userId = nextUser();
      const res = new Response(null, {
        headers: makeHeaders({
          'x-ratelimit-limit-requests': '10',
          'x-ratelimit-remaining-requests': '5',
          'x-ratelimit-reset-requests': 'soon',
        }),
      });
      service.captureFromResponse(res, userId, 'openai', 'api_key');
      await Promise.resolve();
      await Promise.resolve();
      const saved = repo.save.mock.calls[0][0];
      expect(saved.resets_at).toBeNull();
    });
  });

  describe('cache eviction', () => {
    it('evicts the oldest entry once the cache is full', async () => {
      // Use a single OpenAI provider but rotate the userId so each capture
      // writes a distinct cache key (userId:provider). MAX_CACHE is 2000, so
      // 2001 distinct keys forces one eviction of the oldest entry.
      const res = new Response(null, {
        headers: makeHeaders({ 'x-ratelimit-limit-requests': '1' }),
      });
      for (let i = 0; i < 2001; i++) {
        service.captureFromResponse(res.clone(), `evict-${i}`, 'openai', 'api_key');
      }
      await Promise.resolve();
      await Promise.resolve();
      // The very first user's entry should have been evicted.
      const out = await service.getRateLimits('evict-0');
      // DB returns nothing for that user, so the evicted in-memory entry is gone.
      expect(out).toEqual([]);
    });

    it('reclaims expired entries before evicting a live one when full', async () => {
      const res = new Response(null, {
        headers: makeHeaders({ 'x-ratelimit-limit-requests': '1' }),
      });
      const t0 = 1_000_000_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(t0);
      // Fill the cache to capacity; every entry expires at t0 + TTL.
      for (let i = 0; i < 2000; i++) {
        service.captureFromResponse(res.clone(), `stale-${i}`, 'openai', 'api_key');
      }
      await Promise.resolve();
      await Promise.resolve();
      // Advance past the TTL so all 2000 entries are now expired, then insert a
      // fresh one: setCapped must sweep the expired entries (freeing capacity)
      // rather than evicting a live entry.
      nowSpy.mockReturnValue(t0 + 60_001);
      service.captureFromResponse(res.clone(), 'fresh-user', 'openai', 'api_key');
      await Promise.resolve();
      await Promise.resolve();
      // The fresh entry is live and served straight from the in-memory cache.
      const fresh = await service.getRateLimits('fresh-user');
      expect(fresh.length).toBeGreaterThan(0);
      nowSpy.mockRestore();
    });

    it('enforces MAX_CACHE on the DB-repopulation path', async () => {
      // Fill the cache to exactly MAX_CACHE via captures.
      const res = new Response(null, {
        headers: makeHeaders({ 'x-ratelimit-limit-requests': '1' }),
      });
      for (let i = 0; i < 2000; i++) {
        service.captureFromResponse(res.clone(), `repop-${i}`, 'openai', 'api_key');
      }
      await Promise.resolve();
      await Promise.resolve();

      // A getRateLimits for a brand-new user whose DB returns a fresh
      // connection forces a repopulation cache.set. With the cache already at
      // capacity, the repopulation must evict the oldest entry (repop-0)
      // instead of growing past MAX_CACHE.
      const row: FakeRow = {
        provider: 'anthropic',
        auth_type: 'subscription',
        key_label: 'team',
        limit_type: 'tokens',
        period: 'minute',
        limit_value: '1000',
        remaining_value: '400',
        used_value: '600',
        resets_at: null,
      };
      getManyRows = [row as unknown as ProviderRateLimit];
      const fresh = await service.getRateLimits('repop-new');
      expect(fresh).toHaveLength(1);

      // The oldest captured connection was evicted by the capped repopulation;
      // its in-memory entry is gone and its DB lookup returns nothing.
      getManyRows = [];
      const evicted = await service.getRateLimits('repop-0');
      expect(evicted).toEqual([]);
    });
  });

  describe('getRateLimits', () => {
    it('returns cached snapshot without hitting DB grouping for that provider', async () => {
      const userId = nextUser();
      const res = new Response(null, {
        headers: makeHeaders({
          'x-ratelimit-limit-requests': '100',
          'x-ratelimit-remaining-requests': '90',
        }),
      });
      service.captureFromResponse(res, userId, 'openai', 'api_key', 'lbl');
      await Promise.resolve();
      await Promise.resolve();

      const out = await service.getRateLimits(userId);
      expect(out).toHaveLength(1);
      expect(out[0].provider).toBe('openai');
      expect(out[0].keyLabel).toBe('lbl');
      expect(out[0].limits[0].usedValue).toBe(10);
    });

    it('reads from DB when nothing cached and populates cache', async () => {
      const userId = nextUser();
      const row: FakeRow = {
        provider: 'anthropic',
        auth_type: 'subscription',
        key_label: null,
        limit_type: 'tokens',
        period: 'minute',
        limit_value: '1000',
        remaining_value: '400',
        used_value: '600',
        resets_at: '2026-01-01T00:00:00Z',
      };
      getManyRows = [row as unknown as ProviderRateLimit];

      const out = await service.getRateLimits(userId);
      expect(out).toHaveLength(1);
      expect(out[0].provider).toBe('anthropic');
      expect(out[0].keyLabel).toBeUndefined();
      expect(out[0].limits[0].limitValue).toBe(1000);
      expect(out[0].limits[0].remainingValue).toBe(400);
      expect(out[0].limits[0].usedValue).toBe(600);

      // Second call should serve from the cache populated above.
      repo.createQueryBuilder.mockClear();
      const out2 = await service.getRateLimits(userId);
      expect(out2).toHaveLength(1);
    });

    it('handles DB rows with null numeric fields', async () => {
      const userId = nextUser();
      const row: FakeRow = {
        provider: 'anthropic',
        auth_type: 'api_key',
        key_label: 'k',
        limit_type: 'requests',
        period: 'minute',
        limit_value: null,
        remaining_value: null,
        used_value: '0',
        resets_at: null,
      };
      getManyRows = [row as unknown as ProviderRateLimit];
      const out = await service.getRateLimits(userId);
      expect(out[0].limits[0].limitValue).toBeNull();
      expect(out[0].limits[0].remainingValue).toBeNull();
      // '0' is falsy as a value but a truthy string, so it parses to 0.
      expect(out[0].limits[0].usedValue).toBe(0);
      expect(out[0].keyLabel).toBe('k');
    });

    it('keeps same-provider connections separate by auth_type and label (cache)', async () => {
      const userId = nextUser();
      const res = () =>
        new Response(null, {
          headers: makeHeaders({
            'x-ratelimit-limit-requests': '100',
            'x-ratelimit-remaining-requests': '90',
          }),
        });

      // Same provider, three distinct connections: differing auth_type and label.
      service.captureFromResponse(res(), userId, 'openai', 'api_key', 'work');
      service.captureFromResponse(res(), userId, 'openai', 'api_key', 'personal');
      service.captureFromResponse(res(), userId, 'openai', 'subscription', 'work');
      await Promise.resolve();
      await Promise.resolve();

      const out = await service.getRateLimits(userId);
      expect(out).toHaveLength(3);
      const ids = out.map((s) => `${s.provider}|${s.authType}|${s.keyLabel}`).sort();
      expect(ids).toEqual([
        'openai|api_key|personal',
        'openai|api_key|work',
        'openai|subscription|work',
      ]);
    });

    it('groups DB rows by full connection tuple, not just provider', async () => {
      const userId = nextUser();
      const mk = (auth: string, label: string | null, limitType: string): FakeRow => ({
        provider: 'openai',
        auth_type: auth,
        key_label: label,
        limit_type: limitType,
        period: 'minute',
        limit_value: '100',
        remaining_value: '50',
        used_value: '50',
        resets_at: null,
      });
      // Two distinct connections for the same provider plus a second limit_type
      // on the first connection. Must yield two snapshots; the first carries
      // both its limit rows.
      getManyRows = [
        mk('api_key', 'work', 'requests'),
        mk('api_key', 'work', 'tokens'),
        mk('subscription', 'personal', 'requests'),
      ] as unknown as ProviderRateLimit[];

      const out = await service.getRateLimits(userId);
      expect(out).toHaveLength(2);
      const work = out.find((s) => s.authType === 'api_key' && s.keyLabel === 'work');
      const personal = out.find((s) => s.authType === 'subscription' && s.keyLabel === 'personal');
      expect(work?.limits).toHaveLength(2);
      expect(personal?.limits).toHaveLength(1);
    });

    it('matches the latest-snapshot subquery on the full connection identity', async () => {
      const userId = nextUser();
      getManyRows = [];
      await service.getRateLimits(userId);
      // The correlated subquery must constrain auth_type, key_label and
      // limit_type (collapsing NULL labels to 'Default'), not just provider.
      const subqueryCall = qb.andWhere.mock.calls.find((c) =>
        String(c[0]).includes('MAX(rl2.captured_at)'),
      );
      expect(subqueryCall).toBeDefined();
      const sql = String(subqueryCall![0]);
      expect(sql).toContain('rl2.auth_type = rl.auth_type');
      expect(sql).toContain(
        "COALESCE(rl2.key_label, 'Default') = COALESCE(rl.key_label, 'Default')",
      );
      expect(sql).toContain('rl2.limit_type = rl.limit_type');
    });

    it('expires stale cache entries and falls back to DB', async () => {
      const userId = nextUser();
      const realNow = Date.now;
      // Seed cache at t=0
      const res = new Response(null, {
        headers: makeHeaders({ 'x-ratelimit-limit-requests': '10' }),
      });
      service.captureFromResponse(res, userId, 'openai', 'api_key');
      await Promise.resolve();
      await Promise.resolve();

      // Jump forward beyond TTL so the cached entry is expired.
      jest.spyOn(Date, 'now').mockReturnValue(realNow() + 120_000);
      getManyRows = [];
      const out = await service.getRateLimits(userId);
      // expired openai entry deleted; DB returns nothing -> empty
      expect(out).toEqual([]);
      (Date.now as jest.Mock).mockRestore();
    });
  });
});
