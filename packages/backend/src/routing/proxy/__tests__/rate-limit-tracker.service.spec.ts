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
