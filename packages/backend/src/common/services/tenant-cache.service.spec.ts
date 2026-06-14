import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TenantCacheService } from './tenant-cache.service';
import { Tenant } from '../../entities/tenant.entity';

describe('TenantCacheService', () => {
  let service: TenantCacheService;
  let mockFindOne: jest.Mock;
  let mockInsert: jest.Mock;

  beforeEach(async () => {
    mockFindOne = jest.fn();
    mockInsert = jest.fn().mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantCacheService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: { findOne: mockFindOne, insert: mockInsert },
        },
      ],
    }).compile();
    service = module.get<TenantCacheService>(TenantCacheService);
  });

  it('returns tenantId when the tenant exists', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 'tenant-abc', owner_user_id: 'user-1' });
    expect(await service.resolve('user-1')).toBe('tenant-abc');
    expect(mockFindOne).toHaveBeenCalledWith({ where: { owner_user_id: 'user-1' } });
  });

  it('returns null when the tenant is missing', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    expect(await service.resolve('unknown')).toBeNull();
  });

  it('caches subsequent lookups for the same user', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 'tenant-abc' });
    await service.resolve('user-1');
    await service.resolve('user-1');
    expect(mockFindOne).toHaveBeenCalledTimes(1);
  });

  it('invalidate() forces the next resolve() to re-hit the DB', async () => {
    // First resolve populates the cache.
    mockFindOne.mockResolvedValueOnce({ id: 'tenant-abc' });
    await service.resolve('user-1');
    expect(mockFindOne).toHaveBeenCalledTimes(1);

    // Invalidate clears the cached entry.
    service.invalidate('user-1');

    // Next resolve must re-query.
    mockFindOne.mockResolvedValueOnce({ id: 'tenant-abc-refreshed' });
    const result = await service.resolve('user-1');
    expect(mockFindOne).toHaveBeenCalledTimes(2);
    expect(result).toBe('tenant-abc-refreshed');
  });

  it('invalidate() on an unknown user is a no-op (does not throw)', () => {
    expect(() => service.invalidate('no-such-user')).not.toThrow();
  });

  describe('ensureForUser', () => {
    it('returns the existing tenant id without inserting when one exists', async () => {
      mockFindOne.mockResolvedValueOnce({ id: 'tenant-existing' });
      const result = await service.ensureForUser('user-1');
      expect(result).toBe('tenant-existing');
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('inserts a new tenant keyed by owner_user_id when none exists', async () => {
      mockFindOne.mockResolvedValueOnce(null);
      const result = await service.ensureForUser('user-2');
      expect(mockInsert).toHaveBeenCalledTimes(1);
      const inserted = mockInsert.mock.calls[0][0];
      expect(inserted).toEqual(
        expect.objectContaining({
          id: result,
          name: 'user-2',
          owner_user_id: 'user-2',
          is_active: true,
        }),
      );
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('re-finds by owner_user_id when the insert races and loses', async () => {
      // resolve() finds nothing → attempt insert → insert throws (unique
      // index on owner_user_id) → re-find returns the surviving row.
      mockFindOne.mockResolvedValueOnce(null);
      mockInsert.mockRejectedValueOnce(new Error('duplicate key value'));
      mockFindOne.mockResolvedValueOnce({ id: 'tenant-raced' });

      const result = await service.ensureForUser('user-3');
      expect(result).toBe('tenant-raced');
      // Second findOne is the post-race re-find, scoped by owner_user_id.
      expect(mockFindOne).toHaveBeenLastCalledWith({ where: { owner_user_id: 'user-3' } });
    });

    it('rethrows the original insert error when the re-find finds nothing (not a race)', async () => {
      mockFindOne.mockResolvedValueOnce(null);
      mockInsert.mockRejectedValueOnce(new Error('connection terminated'));
      mockFindOne.mockResolvedValueOnce(null);

      await expect(service.ensureForUser('user-4')).rejects.toThrow('connection terminated');
    });
  });
});
