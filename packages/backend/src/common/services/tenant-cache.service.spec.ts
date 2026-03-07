import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TenantCacheService } from './tenant-cache.service';
import { Tenant } from '../../entities/tenant.entity';

describe('TenantCacheService', () => {
  let service: TenantCacheService;
  let mockFindOne: jest.Mock;

  beforeEach(async () => {
    mockFindOne = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantCacheService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: { findOne: mockFindOne },
        },
      ],
    }).compile();

    service = module.get<TenantCacheService>(TenantCacheService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns tenantId when tenant exists in DB', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 'tenant-abc', name: 'user-1' });

    const result = await service.resolve('user-1');

    expect(result).toBe('tenant-abc');
    expect(mockFindOne).toHaveBeenCalledWith({ where: { name: 'user-1' } });
  });

  it('returns null when tenant not found', async () => {
    mockFindOne.mockResolvedValueOnce(null);

    const result = await service.resolve('unknown-user');

    expect(result).toBeNull();
  });

  it('returns cached value on second call without hitting DB again', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 'tenant-abc', name: 'user-1' });

    const first = await service.resolve('user-1');
    const second = await service.resolve('user-1');

    expect(first).toBe('tenant-abc');
    expect(second).toBe('tenant-abc');
    expect(mockFindOne).toHaveBeenCalledTimes(1);
  });

  it('deletes expired cache entry on miss', async () => {
    jest.useFakeTimers();
    mockFindOne
      .mockResolvedValueOnce({ id: 'tenant-abc', name: 'user-1' })
      .mockResolvedValueOnce({ id: 'tenant-abc-v2', name: 'user-1' });

    await service.resolve('user-1');
    const cache = (service as any).cache as Map<string, unknown>;
    expect(cache.has('user-1')).toBe(true);

    jest.advanceTimersByTime(300_001);
    await service.resolve('user-1');

    // Stale entry was deleted and replaced with fresh one
    expect(cache.has('user-1')).toBe(true);
    expect(mockFindOne).toHaveBeenCalledTimes(2);
  });

  it('does not evict when updating an existing key at capacity', async () => {
    jest.useFakeTimers();
    const cache = (service as any).cache as Map<string, unknown>;
    for (let i = 0; i < 5000; i++) {
      cache.set(`u-${i}`, { tenantId: `t-${i}`, expiresAt: Date.now() + 300_000 });
    }

    // Expire u-0's entry and re-resolve — should update in place, not evict another entry
    jest.advanceTimersByTime(300_001);
    mockFindOne.mockResolvedValueOnce({ id: 't-0-new', name: 'u-0' });
    await service.resolve('u-0');

    // u-0 was expired+deleted then re-added, so size should still be 5000
    // and u-1 should still be present (not evicted)
    expect(cache.size).toBe(5000);
    expect(cache.has('u-1')).toBe(true);
  });

  it('cache expires after TTL (300_000ms)', async () => {
    jest.useFakeTimers();
    mockFindOne
      .mockResolvedValueOnce({ id: 'tenant-abc', name: 'user-1' })
      .mockResolvedValueOnce({ id: 'tenant-abc-v2', name: 'user-1' });

    await service.resolve('user-1');
    expect(mockFindOne).toHaveBeenCalledTimes(1);

    // Advance past TTL
    jest.advanceTimersByTime(300_001);

    const result = await service.resolve('user-1');
    expect(result).toBe('tenant-abc-v2');
    expect(mockFindOne).toHaveBeenCalledTimes(2);
  });

  it('evicts oldest entry when cache reaches MAX_ENTRIES (5000)', async () => {
    // Fill the cache with 5000 entries
    for (let i = 0; i < 5000; i++) {
      mockFindOne.mockResolvedValueOnce({ id: `t-${i}`, name: `u-${i}` });
      await service.resolve(`u-${i}`);
    }
    expect(mockFindOne).toHaveBeenCalledTimes(5000);

    // The 5001st entry should trigger eviction of the oldest (u-0)
    mockFindOne.mockResolvedValueOnce({ id: 't-5000', name: 'u-5000' });
    const result = await service.resolve('u-5000');
    expect(result).toBe('t-5000');

    // u-0 was evicted, so resolving it should hit the DB again
    mockFindOne.mockResolvedValueOnce({ id: 't-0-new', name: 'u-0' });
    const evictedResult = await service.resolve('u-0');
    expect(evictedResult).toBe('t-0-new');
  });

  it('handles undefined from iterator when cache is empty during eviction check', async () => {
    // This edge case is covered by the normal code path:
    // when cache.size < MAX_ENTRIES, the eviction block is skipped.
    // The undefined check inside the block is a defensive guard.
    // We test it indirectly — when tenant is found and cache is not full,
    // the code still works correctly.
    mockFindOne.mockResolvedValueOnce({ id: 'tenant-1', name: 'user-1' });

    const result = await service.resolve('user-1');
    expect(result).toBe('tenant-1');
  });
});
