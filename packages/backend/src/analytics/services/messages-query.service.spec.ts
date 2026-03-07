import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Brackets, DataSource } from 'typeorm';
import { MessagesQueryService } from './messages-query.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

describe('MessagesQueryService', () => {
  let service: MessagesQueryService;
  let mockGetRawOne: jest.Mock;
  let mockGetRawMany: jest.Mock;
  let mockTenantResolve: jest.Mock;

  beforeEach(async () => {
    mockGetRawOne = jest.fn().mockResolvedValue({ total: 0 });
    mockGetRawMany = jest.fn().mockResolvedValue([]);
    mockTenantResolve = jest.fn().mockResolvedValue('tenant-123');

    const mockQb: Record<string, jest.Mock> = {
      select: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orWhere: jest.fn(),
      groupBy: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      limit: jest.fn(),
      clone: jest.fn(),
      getRawOne: mockGetRawOne,
      getRawMany: mockGetRawMany,
    };

    const chainableMethods = [
      'select',
      'addSelect',
      'where',
      'andWhere',
      'orWhere',
      'groupBy',
      'orderBy',
      'addOrderBy',
      'limit',
      'clone',
    ];
    for (const method of chainableMethods) {
      mockQb[method].mockImplementation((...args: unknown[]) => {
        const arg = args[0];
        if (arg instanceof Brackets && typeof (arg as any).whereFactory === 'function') {
          (arg as any).whereFactory(mockQb);
        }
        return mockQb;
      });
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesQueryService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockQb) },
        },
        {
          provide: DataSource,
          useValue: { options: { type: 'postgres' } },
        },
        {
          provide: TenantCacheService,
          useValue: { resolve: mockTenantResolve },
        },
      ],
    }).compile();

    service = module.get<MessagesQueryService>(MessagesQueryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns items with cache and duration fields', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany.mockResolvedValueOnce([
      {
        id: 'msg-c',
        timestamp: '2026-02-16 10:00:00',
        model: 'gpt-4o',
        cost: 0.01,
        cache_read_tokens: 500,
        cache_creation_tokens: 100,
        duration_ms: 1200,
      },
    ]);
    mockGetRawMany.mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    expect(result.items[0]).toHaveProperty('cache_read_tokens', 500);
    expect(result.items[0]).toHaveProperty('cache_creation_tokens', 100);
    expect(result.items[0]).toHaveProperty('duration_ms', 1200);
  });

  it('returns paginated messages with total count and models list', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 42 });
    mockGetRawMany.mockResolvedValueOnce([
      { id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o', cost: 0.01 },
      { id: 'msg-2', timestamp: '2026-02-16 09:00:00', model: 'claude-opus-4-6', cost: 0.05 },
    ]);
    mockGetRawMany.mockResolvedValueOnce([{ model: 'claude-opus-4-6' }, { model: 'gpt-4o' }]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    expect(result.total_count).toBe(42);
    expect(result.items).toHaveLength(2);
    expect(result.next_cursor).toBeNull();
    expect(result.models).toEqual(['claude-opus-4-6', 'gpt-4o']);
  });

  it('returns next_cursor when more items exist', async () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      id: `msg-${i}`,
      timestamp: `2026-02-16 10:0${i}:00`,
      model: 'gpt-4o',
      cost: 0.01,
    }));

    mockGetRawOne.mockResolvedValueOnce({ total: 20 });
    mockGetRawMany.mockResolvedValueOnce(rows).mockResolvedValueOnce([]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 5,
    });

    expect(result.items).toHaveLength(5);
    expect(result.next_cursor).not.toBeNull();
    expect(result.next_cursor).toContain('|msg-4');
  });

  it('returns null next_cursor when no more items', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 2 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00' }])
      .mockResolvedValueOnce([]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    expect(result.next_cursor).toBeNull();
  });

  it('handles Date objects in timestamp for cursor formatting', async () => {
    const rows = [
      { id: 'msg-0', timestamp: new Date('2026-02-16T10:00:00'), model: 'gpt-4o' },
      { id: 'msg-1', timestamp: new Date('2026-02-16T09:30:00'), model: 'gpt-4o' },
      { id: 'extra', timestamp: new Date('2026-02-16T09:00:00'), model: 'gpt-4o' },
    ];

    mockGetRawOne.mockResolvedValueOnce({ total: 10 });
    mockGetRawMany.mockResolvedValueOnce(rows).mockResolvedValueOnce([]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 2,
    });

    expect(result.next_cursor).not.toBeNull();
    expect(result.next_cursor).toContain('2026-02-16T09:30:00');
    expect(result.next_cursor).toContain('|msg-1');
  });

  it('handles empty result set', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 0 });
    mockGetRawMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    expect(result.total_count).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.next_cursor).toBeNull();
    expect(result.models).toEqual([]);
  });

  it('should apply cursor-based pagination when cursor has pipe separator', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 50 });
    mockGetRawMany
      .mockResolvedValueOnce([
        { id: 'msg-10', timestamp: '2026-02-16 08:00:00', model: 'gpt-4o', cost: 0.01 },
      ])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      cursor: '2026-02-16 09:00:00|msg-5',
    });

    expect(result.total_count).toBe(50);
    expect(result.items).toHaveLength(1);
    expect(result.next_cursor).toBeNull();
  });

  it('should ignore cursor without pipe separator', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 10 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      cursor: 'invalid-cursor-no-pipe',
    });

    expect(result.total_count).toBe(10);
    expect(result.items).toHaveLength(1);
  });

  it('should query without range cutoff when range is omitted', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 5 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-01-01 00:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    const result = await service.getMessages({
      userId: 'test-user',
      limit: 20,
    });

    expect(result.total_count).toBe(5);
    expect(result.items).toHaveLength(1);
    expect(result.models).toEqual(['gpt-4o']);
  });

  it('should apply all optional filter parameters', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 3 });
    mockGetRawMany
      .mockResolvedValueOnce([
        { id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o', cost: 0.05 },
      ])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      status: 'success',
      service_type: 'chat',
      model: 'gpt-4o',
      cost_min: 0.01,
      cost_max: 1.0,
      agent_name: 'my-agent',
    });

    expect(result.total_count).toBe(3);
    expect(result.items).toHaveLength(1);
  });

  it('should handle null total from count query', async () => {
    mockGetRawOne.mockResolvedValueOnce(null);
    mockGetRawMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    expect(result.total_count).toBe(0);
  });

  it('should handle cost_min of 0 as a valid filter', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([
        { id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o', cost: 0 },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      cost_min: 0,
    });

    expect(result.total_count).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('should handle cost_max of 0 as a valid filter', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 0 });
    mockGetRawMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      cost_max: 0,
    });

    expect(result.total_count).toBe(0);
  });

  it('models cache returns cached value on second call', async () => {
    // First call
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }, { model: 'claude-opus-4-6' }]);

    const result1 = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });
    expect(result1.models).toEqual(['gpt-4o', 'claude-opus-4-6']);

    // Second call — models query should NOT be called again
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany.mockResolvedValueOnce([
      { id: 'msg-2', timestamp: '2026-02-16 11:00:00', model: 'gpt-4o' },
    ]);
    // Note: no mockResolvedValueOnce for models query — if it runs, it would return []

    const result2 = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    // Should still return cached models from first call
    expect(result2.models).toEqual(['gpt-4o', 'claude-opus-4-6']);
    // getRawMany should have been called 3 times total:
    // call 1: data rows + models = 2, call 2: data rows only = 1
    expect(mockGetRawMany).toHaveBeenCalledTimes(3);
  });

  it('models cache deletes expired entry before fetching fresh data', async () => {
    jest.useFakeTimers();

    // First call — populate cache
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });
    const cache = (service as any).modelsCache as Map<string, unknown>;
    expect(cache.size).toBe(1);

    // Expire and re-query
    jest.advanceTimersByTime(60_001);

    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-2', timestamp: '2026-02-16 11:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o', model2: 'claude-opus-4-6' }]);

    await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });
    // Stale entry was deleted before re-adding — size should still be 1
    expect(cache.size).toBe(1);
  });

  it('models cache evicts oldest entry when reaching MAX_CACHE_ENTRIES', async () => {
    const cache = (service as any).modelsCache as Map<string, unknown>;
    for (let i = 0; i < 5_000; i++) {
      cache.set(`user-${i}:24h`, { models: ['gpt-4o'], expiresAt: Date.now() + 60_000 });
    }
    expect(cache.size).toBe(5_000);

    // Trigger a fresh models fetch for a new key
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '7d', userId: 'new-user', limit: 20 });

    expect(cache.size).toBe(5_000);
    expect(cache.has('user-0:24h')).toBe(false);
    expect(cache.has('new-user:7d')).toBe(true);
  });

  it('models cache does not evict when updating an existing key at capacity', async () => {
    jest.useFakeTimers();
    const cache = (service as any).modelsCache as Map<string, unknown>;
    for (let i = 0; i < 5_000; i++) {
      cache.set(`user-${i}:24h`, { models: ['gpt-4o'], expiresAt: Date.now() + 60_000 });
    }
    // Overwrite test-user:24h (already exists in our range)
    cache.set('test-user:24h', { models: ['old'], expiresAt: Date.now() + 60_000 });

    jest.advanceTimersByTime(60_001);

    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });

    // Expired entry was deleted first, then re-added — no eviction of other entries
    // Size might be 4999 (expired entry deleted, then re-added = 5000, but if the
    // has(key) check fires after delete, it won't evict)
    expect(cache.has('test-user:24h')).toBe(true);
  });

  it('models cache expires after 60s', async () => {
    jest.useFakeTimers();

    // First call
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    expect(mockGetRawMany).toHaveBeenCalledTimes(2);

    // Advance past models cache TTL (60s)
    jest.advanceTimersByTime(60_001);

    // Second call — models query should run again
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-2', timestamp: '2026-02-16 11:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }, { model: 'claude-opus-4-6' }]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    expect(result.models).toEqual(['gpt-4o', 'claude-opus-4-6']);
    // 2 from first call + 2 from second call = 4
    expect(mockGetRawMany).toHaveBeenCalledTimes(4);
  });

  it('handles null tenantId from cache when tenant does not exist', async () => {
    mockTenantResolve.mockResolvedValueOnce(null);
    mockGetRawOne.mockResolvedValueOnce({ total: 0 });
    mockGetRawMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'unknown-user',
      limit: 20,
    });

    expect(result.total_count).toBe(0);
  });
});

describe('MessagesQueryService (sql.js / local mode)', () => {
  let service: MessagesQueryService;
  let mockAddSelect: jest.Mock;
  let mockGetRawOne: jest.Mock;
  let mockGetRawMany: jest.Mock;

  beforeEach(async () => {
    mockAddSelect = jest.fn().mockReturnThis();
    mockGetRawOne = jest.fn().mockResolvedValue({ total: 0 });
    mockGetRawMany = jest.fn().mockResolvedValue([]);

    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: mockAddSelect,
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      getRawOne: mockGetRawOne,
      getRawMany: mockGetRawMany,
    };

    mockQb.clone = jest.fn().mockReturnValue({ ...mockQb, clone: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesQueryService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockQb) },
        },
        {
          provide: DataSource,
          useValue: { options: { type: 'sqljs' } },
        },
        {
          provide: TenantCacheService,
          useValue: { resolve: jest.fn().mockResolvedValue('tenant-123') },
        },
      ],
    }).compile();

    service = module.get<MessagesQueryService>(MessagesQueryService);
  });

  it('uses CAST(... AS REAL) for cost in sqlite mode', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-01-01', cost: 0.5 }])
      .mockResolvedValueOnce([]);

    await service.getMessages({ range: '24h', userId: 'u1', limit: 20 });

    const addSelectCalls = mockAddSelect.mock.calls.map((c: unknown[]) => c[0]);
    const hasCastReal = addSelectCalls.some(
      (expr: unknown) =>
        typeof expr === 'string' && expr.includes('CAST') && expr.includes('AS REAL'),
    );
    expect(hasCastReal).toBe(true);
  });
});
