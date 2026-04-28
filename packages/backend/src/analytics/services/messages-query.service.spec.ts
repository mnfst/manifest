import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Brackets } from 'typeorm';
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
      distinct: jest.fn(),
      leftJoin: jest.fn(),
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
      'distinct',
      'leftJoin',
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

  it('returns paginated messages with total count and providers list', async () => {
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
    expect(result.providers).toEqual(['anthropic', 'openai']);
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
    expect(result.providers).toEqual([]);
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
    expect(result.providers).toEqual(['openai']);
  });

  it('should apply all optional filter parameters', async () => {
    // Provider filter needs models list to resolve matching models
    mockGetRawMany.mockResolvedValueOnce([{ model: 'gpt-4o' }]); // getDistinctModels for provider filter
    mockGetRawOne.mockResolvedValueOnce({ total: 3 });
    mockGetRawMany
      .mockResolvedValueOnce([
        { id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o', cost: 0.05 },
      ])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]); // getDistinctModels for providers response

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      provider: 'openai',
      service_type: 'chat',
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
    expect(result1.providers).toEqual(['anthropic', 'openai']);

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

    // Should still return cached providers from first call
    expect(result2.providers).toEqual(['anthropic', 'openai']);
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
    const cache = (service as any).modelsCache;
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
    const cache = (service as any).modelsCache;
    for (let i = 0; i < 5_000; i++) {
      cache.set(`user-${i}::24h`, ['gpt-4o']);
    }
    expect(cache.size).toBe(5_000);

    // Trigger a fresh models fetch for a new key
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '7d', userId: 'new-user', limit: 20 });

    expect(cache.size).toBe(5_000);
    expect(cache.has('user-0::24h')).toBe(false);
    expect(cache.has('new-user::7d')).toBe(true);
  });

  it('models cache does not evict when updating an existing key at capacity', async () => {
    jest.useFakeTimers();
    const cache = (service as any).modelsCache;
    for (let i = 0; i < 5_000; i++) {
      cache.set(`user-${i}::24h`, ['gpt-4o']);
    }
    // Overwrite test-user::24h (already exists in our range)
    cache.set('test-user::24h', ['old']);

    jest.advanceTimersByTime(5 * 60_000 + 1);

    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });

    // Expired entry was deleted first, then re-added — no eviction of other entries
    expect(cache.has('test-user::24h')).toBe(true);
  });

  it('models cache expires after the configured TTL', async () => {
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

    // Advance past the models cache TTL (5 min)
    jest.advanceTimersByTime(5 * 60_000 + 1);

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

    expect(result.providers).toEqual(['anthropic', 'openai']);
    // 2 from first call + 2 from second call = 4
    expect(mockGetRawMany).toHaveBeenCalledTimes(4);
  });

  it('count cache hit returns cached value on paginated call', async () => {
    // First call (no cursor) — populates count cache
    mockGetRawOne.mockResolvedValueOnce({ total: 42 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    const result1 = await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });
    expect(result1.total_count).toBe(42);
    expect(mockGetRawOne).toHaveBeenCalledTimes(1);

    // Second call WITH cursor — count comes from cache, no additional getRawOne call
    mockGetRawMany.mockResolvedValueOnce([
      { id: 'msg-2', timestamp: '2026-02-16 11:00:00', model: 'gpt-4o' },
    ]);

    const result2 = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      cursor: '2026-02-16 10:00:00|msg-1',
    });
    expect(result2.total_count).toBe(42);
    expect(mockGetRawOne).toHaveBeenCalledTimes(1);
  });

  it('count cache miss runs COUNT query', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 10 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    const result = await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });
    expect(result.total_count).toBe(10);
    expect(mockGetRawOne).toHaveBeenCalledTimes(1);
  });

  it('first page always runs fresh count even when cache exists', async () => {
    // First call — populates cache
    mockGetRawOne.mockResolvedValueOnce({ total: 42 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });

    // Second call without cursor — should still run fresh count
    mockGetRawOne.mockResolvedValueOnce({ total: 45 });
    mockGetRawMany.mockResolvedValueOnce([
      { id: 'msg-2', timestamp: '2026-02-16 11:00:00', model: 'gpt-4o' },
    ]);

    const result = await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });
    expect(result.total_count).toBe(45);
    expect(mockGetRawOne).toHaveBeenCalledTimes(2);
  });

  it('count cache expires after 30s', async () => {
    jest.useFakeTimers();

    // First call (no cursor) — populates cache
    mockGetRawOne.mockResolvedValueOnce({ total: 50 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });
    expect(mockGetRawOne).toHaveBeenCalledTimes(1);

    // Advance past count cache TTL (30s)
    jest.advanceTimersByTime(30_001);

    // Second call with cursor — cache expired, should re-query
    mockGetRawOne.mockResolvedValueOnce({ total: 55 });
    mockGetRawMany.mockResolvedValueOnce([
      { id: 'msg-2', timestamp: '2026-02-16 11:00:00', model: 'gpt-4o' },
    ]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      cursor: '2026-02-16 10:00:00|msg-1',
    });
    expect(result.total_count).toBe(55);
    expect(mockGetRawOne).toHaveBeenCalledTimes(2);
  });

  it('different filter params produce different count cache keys', async () => {
    // First call with range=24h
    mockGetRawOne.mockResolvedValueOnce({ total: 10 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });

    // Second call with range=7d — different cache key, should query again
    mockGetRawOne.mockResolvedValueOnce({ total: 100 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-2', timestamp: '2026-02-16 11:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    const result = await service.getMessages({ range: '7d', userId: 'test-user', limit: 20 });
    expect(result.total_count).toBe(100);
    expect(mockGetRawOne).toHaveBeenCalledTimes(2);
  });

  it('different service_type produces different count cache key', async () => {
    // First call with no service_type
    mockGetRawOne.mockResolvedValueOnce({ total: 10 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '24h', userId: 'test-user', limit: 20 });

    // Second call with service_type=chat — different cache key, should query again
    mockGetRawOne.mockResolvedValueOnce({ total: 5 });
    mockGetRawMany.mockResolvedValueOnce([
      { id: 'msg-2', timestamp: '2026-02-16 11:00:00', model: 'gpt-4o' },
    ]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      service_type: 'chat',
      cursor: '2026-02-16 10:00:00|msg-1',
    });
    expect(result.total_count).toBe(5);
    expect(mockGetRawOne).toHaveBeenCalledTimes(2);
  });

  it('count cache evicts oldest entry at capacity', async () => {
    const cache = (service as any).countCache;
    for (let i = 0; i < 5_000; i++) {
      cache.set(`user-${i}:24h::::`, i);
    }
    expect(cache.size).toBe(5_000);

    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
      .mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    await service.getMessages({ range: '7d', userId: 'new-user', limit: 20 });

    expect(cache.size).toBe(5_000);
    expect(cache.has('user-0:24h::::')).toBe(false);
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

  it('provider filter returns empty result when no models match', async () => {
    // getDistinctModels returns models that don't match the requested provider
    mockGetRawMany.mockResolvedValueOnce([{ model: 'gpt-4o' }]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      provider: 'anthropic',
    });

    expect(result.total_count).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.providers).toEqual(['openai']);
  });

  it('provider filter applies IN clause for matching models', async () => {
    // getDistinctModels for provider filter resolution
    mockGetRawMany.mockResolvedValueOnce([
      { model: 'gpt-4o' },
      { model: 'gpt-4.1' },
      { model: 'claude-opus-4-6' },
    ]);
    mockGetRawOne.mockResolvedValueOnce({ total: 2 });
    mockGetRawMany
      .mockResolvedValueOnce([
        { id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o', cost: 0.01 },
        { id: 'msg-2', timestamp: '2026-02-16 09:00:00', model: 'gpt-4.1', cost: 0.02 },
      ])
      .mockResolvedValueOnce([
        { model: 'gpt-4o' },
        { model: 'gpt-4.1' },
        { model: 'claude-opus-4-6' },
      ]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
      provider: 'openai',
    });

    expect(result.total_count).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.providers).toEqual(['anthropic', 'openai']);
  });

  it('derives providers from multiple model types', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 3 });
    mockGetRawMany
      .mockResolvedValueOnce([
        { id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' },
        { id: 'msg-2', timestamp: '2026-02-16 09:00:00', model: 'claude-opus-4-6' },
        { id: 'msg-3', timestamp: '2026-02-16 08:00:00', model: 'gemini-2.0-flash' },
      ])
      .mockResolvedValueOnce([
        { model: 'claude-opus-4-6' },
        { model: 'gemini-2.0-flash' },
        { model: 'gpt-4o' },
      ]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    expect(result.providers).toEqual(['anthropic', 'gemini', 'openai']);
  });

  /**
   * These tests cover the new stored-provider path:
   *   1. getDistinctModels collects providers from the distinct rows
   *   2. deriveProviders merges stored providers with inferred-from-model providers
   *   3. getMessages provider filter ORs on at.provider = ? AND legacy model match
   */
  describe('stored provider column', () => {
    it('derives provider from the stored provider column when present', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 1 });
      mockGetRawMany
        .mockResolvedValueOnce([
          {
            id: 'msg-1',
            timestamp: '2026-02-16 10:00:00',
            model: 'gemma4:31b',
            provider: 'ollama-cloud',
          },
        ])
        .mockResolvedValueOnce([{ model: 'gemma4:31b', provider: 'ollama-cloud' }]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 20,
      });

      // Without the stored provider, inferProviderFromModel would return
      // `ollama` for `gemma4:31b` (tagless colon heuristic). The stored value
      // takes precedence.
      expect(result.providers).toEqual(expect.arrayContaining(['ollama-cloud']));
      expect(result.providers).toContain('ollama');
    });

    it('merges stored providers with providers inferred from legacy rows', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 2 });
      mockGetRawMany
        .mockResolvedValueOnce([
          {
            id: 'msg-1',
            timestamp: '2026-02-16 10:00:00',
            model: 'deepseek-v3.2',
            provider: 'ollama-cloud',
          },
          {
            id: 'msg-2',
            timestamp: '2026-02-16 09:00:00',
            model: 'gpt-4o',
            provider: null,
          },
        ])
        .mockResolvedValueOnce([
          { model: 'deepseek-v3.2', provider: 'ollama-cloud' },
          { model: 'gpt-4o', provider: null },
        ]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 20,
      });

      // deepseek-v3.2 is stored with ollama-cloud; gpt-4o has no stored
      // provider so it falls back to inference → openai.
      expect(result.providers.sort()).toEqual(['deepseek', 'ollama-cloud', 'openai']);
    });

    it('skips null and empty provider values in distinct rows', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 1 });
      mockGetRawMany
        .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o' }])
        // Include rows with null and empty-string provider values to cover
        // the `providerValue != null && providerValue !== ''` branch.
        .mockResolvedValueOnce([
          { model: 'gpt-4o', provider: null },
          { model: 'claude-opus-4-6', provider: '' },
          { model: 'deepseek-v3.2', provider: 'ollama-cloud' },
        ]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 20,
      });

      // The null and '' providers must not create spurious entries; only the
      // real ollama-cloud entry plus the model-name-inferred ones.
      expect(result.providers).toContain('ollama-cloud');
      expect(result.providers).toContain('openai');
      expect(result.providers).toContain('anthropic');
      expect(result.providers).not.toContain('');
    });

    it('derives providers skipping null entries in stored list', async () => {
      // Cover deriveProviders() line where `if (p) seen.add(p)` guards against
      // null values surfacing in the stored providers array.
      const derive = (
        service as unknown as {
          deriveProviders: (m: string[], p: string[]) => string[];
        }
      ).deriveProviders.bind(service);

      // Intentionally pass a null inside the array to simulate a row that had
      // provider = null. The TtlCache contract uses string[], but the guard
      // defends against legacy or corrupted cached entries.
      const result = derive(
        ['gpt-4o'],
        ['anthropic', null as unknown as string, '', 'ollama-cloud'],
      );
      expect(result).toEqual(['anthropic', 'ollama-cloud', 'openai']);
    });

    it('provider filter: ORs stored provider = ? with legacy model IN (...)', async () => {
      // getDistinctModels returns a mix of models and providers.
      // `matching` will include gpt-4o (inferred as openai), so the OR branch
      // with at.provider IS NULL AND at.model IN (...) is built.
      mockGetRawMany.mockResolvedValueOnce([
        { model: 'gpt-4o', provider: 'openai' },
        { model: 'gpt-4.1', provider: null },
        { model: 'claude-opus-4-6', provider: null },
      ]);
      mockGetRawOne.mockResolvedValueOnce({ total: 2 });
      mockGetRawMany
        .mockResolvedValueOnce([
          {
            id: 'msg-1',
            timestamp: '2026-02-16 10:00:00',
            model: 'gpt-4o',
            provider: 'openai',
          },
          {
            id: 'msg-2',
            timestamp: '2026-02-16 09:00:00',
            model: 'gpt-4.1',
            provider: null,
          },
        ])
        .mockResolvedValueOnce([
          { model: 'gpt-4o', provider: 'openai' },
          { model: 'gpt-4.1', provider: null },
          { model: 'claude-opus-4-6', provider: null },
        ]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 20,
        provider: 'openai',
      });

      expect(result.total_count).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('provider filter: uses only the stored provider branch when no legacy models match', async () => {
      // All distinct models map to something other than the requested provider
      // (e.g. the legacy OR branch would be empty), exercising the matching.length === 0 path.
      mockGetRawMany.mockResolvedValueOnce([{ model: 'gpt-4o', provider: 'openai' }]);
      mockGetRawOne.mockResolvedValueOnce({ total: 0 });
      mockGetRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ model: 'gpt-4o', provider: 'openai' }]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 20,
        provider: 'anthropic',
      });

      expect(result.total_count).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // Shared contract with TimeseriesQueriesService.getRecentActivity:
  // both endpoints must project `specificity_category` so the frontend
  // MessageTable/ModelCell badge renders the specificity category instead of
  // falling back to the complexity tier. See selectMessageRowColumns helper.
  it('propagates specificity_category rows returned by the helper projection', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([
        {
          id: 'msg-spec',
          timestamp: '2026-02-16 10:00:00',
          model: 'claude-opus-4-6',
          cost: 0.1,
          routing_tier: 'standard',
          routing_reason: 'specificity',
          specificity_category: 'coding',
        },
      ])
      .mockResolvedValueOnce([{ model: 'claude-opus-4-6' }]);

    const result = await service.getMessages({
      range: '24h',
      userId: 'test-user',
      limit: 20,
    });

    expect(result.items[0]).toHaveProperty('specificity_category', 'coding');
  });
});
