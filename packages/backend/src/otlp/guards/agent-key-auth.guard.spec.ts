import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AgentKeyAuthGuard } from './agent-key-auth.guard';
import { hashKey } from '../../common/utils/hash.util';

function testCacheKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function makeContext(headers: Record<string, string | undefined>, ip = '203.0.113.1') {
  // The guard reads request.socket.remoteAddress for its loopback decision
  // (request.ip is spoofable via X-Forwarded-For when trust proxy is set).
  // Mirror the test's `ip` onto the socket so existing scenarios still hold.
  const request: Record<string, unknown> = { headers, ip, socket: { remoteAddress: ip } };
  return {
    req: request,
    ctx: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext,
  };
}

function createMockConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    'app.nodeEnv': 'test',
    ...overrides,
  };
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('AgentKeyAuthGuard', () => {
  let guard: AgentKeyAuthGuard;
  let mockGetMany: jest.Mock;
  let mockCreateQueryBuilder: jest.Mock;
  let mockExecute: jest.Mock;
  let mockFindOne: jest.Mock;
  let mockConfig: ConfigService;

  function buildMockRepo() {
    mockGetMany = jest.fn().mockResolvedValue([]);
    const mockSelectQb = {
      select: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: mockGetMany,
      // resolveDevContext seeds-tenant lookup; default to no row so it falls
      // back to repo.findOne — preserves existing test scenarios.
      getOne: jest.fn().mockResolvedValue(null),
    };
    mockExecute = jest.fn().mockResolvedValue({});
    const mockUpdateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockImplementation((setObj) => {
        if (setObj) {
          for (const val of Object.values(setObj)) {
            if (typeof val === 'function') (val as () => unknown)();
          }
        }
        return mockUpdateQb;
      }),
      where: jest.fn().mockReturnThis(),
      execute: mockExecute,
    };
    mockCreateQueryBuilder = jest.fn().mockImplementation((alias?: string) => {
      return alias ? mockSelectQb : mockUpdateQb;
    });
    mockFindOne = jest.fn().mockResolvedValue(null);
    return {
      createQueryBuilder: mockCreateQueryBuilder,
      findOne: mockFindOne,
    } as never;
  }

  function createGuard(configOverrides: Record<string, string> = {}) {
    mockConfig = createMockConfig(configOverrides);
    const repo = buildMockRepo();
    const g = new AgentKeyAuthGuard(repo, mockConfig);
    g.clearCache();
    return g;
  }

  beforeEach(() => {
    guard = createGuard();
  });

  afterEach(() => {
    guard.onModuleDestroy();
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const { ctx } = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Authorization header required');
  });

  it('throws UnauthorizedException when token is empty (Bearer with no value)', async () => {
    const { ctx } = makeContext({ authorization: 'Bearer ' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Empty token');
  });

  it('rejects token without mnfst_ prefix', async () => {
    const { ctx } = makeContext({ authorization: 'Bearer osk_some_old_key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key format');
    expect(mockCreateQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects mnfst_ token shorter than minimum length', async () => {
    const { ctx } = makeContext({ authorization: 'Bearer mnfst_ab' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key format');
    expect(mockCreateQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects bare mnfst_ prefix with no suffix', async () => {
    const { ctx } = makeContext({ authorization: 'Bearer mnfst_' });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key format');
    expect(mockCreateQueryBuilder).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when API key is not found in DB', async () => {
    mockGetMany.mockResolvedValue([]);
    const { ctx } = makeContext({ authorization: 'Bearer mnfst_unknown-key' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key');
  });

  it('returns true and attaches ingestionContext when key is valid', async () => {
    const token = 'mnfst_valid-key';
    mockGetMany.mockResolvedValue([
      {
        id: 'key-1',
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        key_hash: hashKey(token),
        expires_at: null,
        agent: { name: 'test-agent' },
        tenant: { name: 'user-1' },
      },
    ]);

    const { ctx, req } = makeContext({ authorization: `Bearer ${token}` });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.ingestionContext).toEqual({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      agentName: 'test-agent',
      userId: 'user-1',
    });
  });

  it('returns true when raw token (no Bearer prefix) matches', async () => {
    const token = 'mnfst_raw-key-test';
    mockGetMany.mockResolvedValue([
      {
        id: 'key-2',
        tenant_id: 'tenant-2',
        agent_id: 'agent-2',
        key_hash: hashKey(token),
        expires_at: null,
        agent: { name: 'test-agent-2' },
        tenant: { name: 'user-2' },
      },
    ]);

    const { ctx, req } = makeContext({ authorization: token });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.ingestionContext).toEqual({
      tenantId: 'tenant-2',
      agentId: 'agent-2',
      agentName: 'test-agent-2',
      userId: 'user-2',
    });
  });

  it('throws UnauthorizedException when API key is expired', async () => {
    const token = 'mnfst_expired-key-test';
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockGetMany.mockResolvedValue([
      {
        id: 'key-3',
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        key_hash: hashKey(token),
        expires_at: pastDate,
        agent: { name: 'test-agent' },
        tenant: { name: 'user-1' },
      },
    ]);

    const { ctx } = makeContext({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('API key expired');
  });

  it('uses cached result on second call without querying DB again', async () => {
    const token = 'mnfst_cached-key-test';
    mockGetMany.mockResolvedValue([
      {
        id: 'key-4',
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        key_hash: hashKey(token),
        expires_at: null,
        agent: { name: 'test-agent' },
        tenant: { name: 'user-1' },
      },
    ]);

    const { ctx: ctx1 } = makeContext({ authorization: `Bearer ${token}` });
    await guard.canActivate(ctx1);

    expect(mockGetMany).toHaveBeenCalledTimes(1);

    mockCreateQueryBuilder.mockClear();
    mockGetMany.mockClear();
    mockCreateQueryBuilder.mockClear();

    const { ctx: ctx2 } = makeContext({ authorization: `Bearer ${token}` });
    await guard.canActivate(ctx2);

    expect(mockCreateQueryBuilder).not.toHaveBeenCalled();
  });

  it('requires auth for loopback IPs in non-development mode', async () => {
    const { ctx } = makeContext({}, '127.0.0.1');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  describe('dev loopback bypass in development mode', () => {
    beforeEach(() => {
      guard.onModuleDestroy();
      guard = createGuard({ 'app.nodeEnv': 'development' });
    });

    it('allows loopback with non-mnfst token in dev mode by resolving first active key', async () => {
      mockFindOne.mockResolvedValue({
        tenant_id: 'dev-tenant',
        agent_id: 'dev-agent',
        agent: { name: 'demo-agent' },
        tenant: { name: 'dev-user' },
      });
      const { ctx, req } = makeContext({ authorization: 'Bearer dev-no-auth' }, '127.0.0.1');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.ingestionContext).toEqual({
        tenantId: 'dev-tenant',
        agentId: 'dev-agent',
        agentName: 'demo-agent',
        userId: 'dev-user',
      });
      expect(mockFindOne).toHaveBeenCalledWith({
        where: { is_active: true },
        relations: ['agent', 'tenant'],
      });
    });

    it('allows loopback without auth header in dev mode', async () => {
      mockFindOne.mockResolvedValue({
        tenant_id: 'dev-tenant',
        agent_id: 'dev-agent',
        agent: { name: 'demo-agent' },
        tenant: { name: 'dev-user' },
      });
      const { ctx, req } = makeContext({}, '127.0.0.1');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.ingestionContext).toEqual({
        tenantId: 'dev-tenant',
        agentId: 'dev-agent',
        agentName: 'demo-agent',
        userId: 'dev-user',
      });
    });

    it('rejects loopback without auth when no active keys exist in DB', async () => {
      mockFindOne.mockResolvedValue(null);
      const { ctx } = makeContext({}, '127.0.0.1');
      await expect(guard.canActivate(ctx)).rejects.toThrow('Authorization header required');
    });

    it('rejects non-mnfst token when no active keys exist in DB', async () => {
      mockFindOne.mockResolvedValue(null);
      const { ctx } = makeContext({ authorization: 'Bearer dev-no-auth' }, '127.0.0.1');
      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key format');
    });

    it('rejects non-mnfst token from non-loopback IP in dev mode', async () => {
      const { ctx } = makeContext({ authorization: 'Bearer dev-no-auth' }, '192.168.1.100');
      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key format');
    });

    it('rejects loopback with non-mnfst token in production mode', async () => {
      guard.onModuleDestroy();
      guard = createGuard({ 'app.nodeEnv': 'production' });
      const { ctx } = makeContext({ authorization: 'Bearer dev-no-auth' }, '127.0.0.1');
      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key format');
    });

    it('rejects loopback with non-mnfst token in test mode', async () => {
      guard.onModuleDestroy();
      guard = createGuard({ 'app.nodeEnv': 'test' });
      const { ctx } = makeContext({ authorization: 'Bearer dev-no-auth' }, '127.0.0.1');
      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key format');
    });

    it('caches dev context and reuses it on subsequent calls', async () => {
      mockFindOne.mockResolvedValue({
        tenant_id: 'dev-tenant',
        agent_id: 'dev-agent',
        agent: { name: 'demo-agent' },
        tenant: { name: 'dev-user' },
      });

      const { ctx: ctx1 } = makeContext({ authorization: 'Bearer dev-no-auth' }, '127.0.0.1');
      await guard.canActivate(ctx1);
      expect(mockFindOne).toHaveBeenCalledTimes(1);

      mockFindOne.mockClear();
      const { ctx: ctx2 } = makeContext({ authorization: 'Bearer dev-no-auth' }, '::1');
      await guard.canActivate(ctx2);
      expect(mockFindOne).not.toHaveBeenCalled();
    });
  });

  it('handles request.ip being undefined without crashing', async () => {
    const request: Record<string, unknown> = { headers: {}, ip: undefined, socket: {} };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('does not throw when last_used_at update fails', async () => {
    const token = 'mnfst_update-fail-key';
    mockGetMany.mockResolvedValue([
      {
        id: 'key-5',
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        key_hash: hashKey(token),
        expires_at: null,
        agent: { name: 'test-agent' },
        tenant: { name: 'user-1' },
      },
    ]);
    mockExecute.mockRejectedValueOnce(new Error('DB write error'));

    const { ctx, req } = makeContext({ authorization: `Bearer ${token}` });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.ingestionContext).toBeDefined();
    expect(mockExecute).toHaveBeenCalled();
  });

  it('evicts the first cache entry when cache reaches MAX_CACHE_SIZE', async () => {
    const internalCache = (guard as any).cache as Map<string, unknown>;

    const firstFillerHash = testCacheKey('mnfst_filler-0');
    for (let i = 0; i < 10_000; i++) {
      internalCache.set(testCacheKey(`mnfst_filler-${i}`), {
        tenantId: 't',
        agentId: 'a',
        agentName: 'n',
        userId: 'u',
        expiresAt: Date.now() + 999_999,
      });
    }
    expect(internalCache.size).toBe(10_000);

    const token = 'mnfst_overflow-key';
    mockGetMany.mockResolvedValue([
      {
        id: 'key-max',
        tenant_id: 'tenant-max',
        agent_id: 'agent-max',
        key_hash: hashKey(token),
        expires_at: null,
        agent: { name: 'test-agent-max' },
        tenant: { name: 'user-max' },
      },
    ]);

    const { ctx } = makeContext({ authorization: `Bearer ${token}` });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(internalCache.has(firstFillerHash)).toBe(false);
    expect(internalCache.has(testCacheKey(token))).toBe(true);
  });

  it('evictExpired removes entries whose expiresAt has passed', async () => {
    const internalCache = (guard as any).cache as Map<string, unknown>;

    const expiredHash = testCacheKey('mnfst_expired-cache');
    const validHash = testCacheKey('mnfst_valid-cache');
    internalCache.set(expiredHash, {
      tenantId: 't',
      agentId: 'a',
      agentName: 'n',
      userId: 'u',
      expiresAt: Date.now() - 1000,
    });
    internalCache.set(validHash, {
      tenantId: 't2',
      agentId: 'a2',
      agentName: 'n2',
      userId: 'u2',
      expiresAt: Date.now() + 999_999,
    });

    expect(internalCache.size).toBe(2);

    const evictToken = 'mnfst_trigger-evict-key';
    mockGetMany.mockResolvedValue([
      {
        id: 'key-evict',
        tenant_id: 'tenant-evict',
        agent_id: 'agent-evict',
        key_hash: hashKey(evictToken),
        expires_at: null,
        agent: { name: 'test-agent-evict' },
        tenant: { name: 'user-evict' },
      },
    ]);

    const { ctx } = makeContext({ authorization: `Bearer ${evictToken}` });
    await guard.canActivate(ctx);

    expect(internalCache.has(expiredHash)).toBe(false);
    expect(internalCache.has(validHash)).toBe(true);
    expect(internalCache.has(testCacheKey(evictToken))).toBe(true);
  });

  it('periodic timer fires evictExpired', () => {
    jest.useFakeTimers();

    const repo = buildMockRepo();
    const timedGuard = new AgentKeyAuthGuard(repo, createMockConfig());

    const internalCache = (timedGuard as any).cache as Map<string, unknown>;
    internalCache.set(testCacheKey('mnfst_stale'), {
      tenantId: 't',
      agentId: 'a',
      agentName: 'n',
      userId: 'u',
      expiresAt: Date.now() - 1000,
    });

    expect(internalCache.size).toBe(1);
    jest.advanceTimersByTime(60_000);
    expect(internalCache.size).toBe(0);

    timedGuard.onModuleDestroy();
    jest.useRealTimers();
  });

  it('onModuleDestroy stops the periodic cleanup timer', () => {
    jest.useFakeTimers();

    const repo = buildMockRepo();
    const timedGuard = new AgentKeyAuthGuard(repo, createMockConfig());

    const internalCache = (timedGuard as any).cache as Map<string, unknown>;
    timedGuard.onModuleDestroy();

    internalCache.set(testCacheKey('mnfst_leftover'), {
      tenantId: 't',
      agentId: 'a',
      agentName: 'n',
      userId: 'u',
      expiresAt: Date.now() - 1000,
    });

    jest.advanceTimersByTime(120_000);
    expect(internalCache.size).toBe(1);

    jest.useRealTimers();
  });

  it('does not store plaintext tokens in cache', async () => {
    const token = 'mnfst_plaintext-check-key';
    mockGetMany.mockResolvedValue([
      {
        id: 'key-pt',
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        key_hash: hashKey(token),
        expires_at: null,
        agent: { name: 'test-agent' },
        tenant: { name: 'user-1' },
      },
    ]);

    const { ctx } = makeContext({ authorization: `Bearer ${token}` });
    await guard.canActivate(ctx);

    const internalCache = (guard as any).cache as Map<string, unknown>;
    expect(internalCache.has(token)).toBe(false);
    expect(internalCache.has(testCacheKey(token))).toBe(true);
  });

  it('caches entries for the configured 5 minute TTL', async () => {
    const token = 'mnfst_ttl-check-key';
    mockGetMany.mockResolvedValue([
      {
        id: 'key-ttl',
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        key_hash: hashKey(token),
        expires_at: null,
        agent: { name: 'test-agent' },
        tenant: { name: 'user-1' },
      },
    ]);

    const before = Date.now();
    const { ctx } = makeContext({ authorization: `Bearer ${token}` });
    await guard.canActivate(ctx);

    const internalCache = (guard as any).cache as Map<string, { expiresAt: number }>;
    const entry = internalCache.get(testCacheKey(token));
    expect(entry).toBeDefined();
    const ttlMs = entry!.expiresAt - before;
    expect(ttlMs).toBeGreaterThanOrEqual(5 * 60 * 1000 - 1000);
    expect(ttlMs).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
  });

  it('LRU touch on cache hit moves entry to tail of insertion order', async () => {
    const token = 'mnfst_lru-touch-key';
    mockGetMany.mockResolvedValue([
      {
        id: 'key-lru',
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        key_hash: hashKey(token),
        expires_at: null,
        agent: { name: 'test-agent' },
        tenant: { name: 'user-1' },
      },
    ]);

    const { ctx } = makeContext({ authorization: `Bearer ${token}` });
    await guard.canActivate(ctx);

    const internalCache = (guard as any).cache as Map<string, unknown>;
    internalCache.set(testCacheKey('mnfst_other-1'), {
      tenantId: 't',
      agentId: 'a',
      agentName: 'n',
      userId: 'u',
      expiresAt: Date.now() + 999_999,
    });

    expect(Array.from(internalCache.keys())[0]).toBe(testCacheKey(token));

    const { ctx: ctx2 } = makeContext({ authorization: `Bearer ${token}` });
    await guard.canActivate(ctx2);

    expect(Array.from(internalCache.keys())[1]).toBe(testCacheKey(token));
  });

  it('invalidateCache removes a specific key from cache', async () => {
    const token = 'mnfst_inv-key-test';
    const storedHash = hashKey(token);
    mockGetMany.mockResolvedValue([
      {
        id: 'key-inv',
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        key_hash: storedHash,
        expires_at: null,
        agent: { name: 'test-agent' },
        tenant: { name: 'user-1' },
      },
    ]);

    const { ctx } = makeContext({ authorization: `Bearer ${token}` });
    await guard.canActivate(ctx);

    guard.invalidateCache(token);
    mockCreateQueryBuilder.mockClear();
    mockGetMany.mockClear();

    mockGetMany.mockResolvedValue([
      {
        id: 'key-inv',
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        key_hash: storedHash,
        expires_at: null,
        agent: { name: 'test-agent' },
        tenant: { name: 'user-1' },
      },
    ]);

    const mockSelectQb2 = {
      select: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: mockGetMany,
    };
    const mockUpdateQb2 = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    mockCreateQueryBuilder.mockImplementation((alias?: string) => {
      return alias ? mockSelectQb2 : mockUpdateQb2;
    });

    const { ctx: ctx2 } = makeContext({ authorization: `Bearer ${token}` });
    await guard.canActivate(ctx2);

    expect(mockGetMany).toHaveBeenCalledTimes(1);
  });
});
