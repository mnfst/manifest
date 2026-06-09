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
        { provide: getRepositoryToken(Tenant), useValue: { findOne: mockFindOne } },
      ],
    }).compile();
    service = module.get<TenantCacheService>(TenantCacheService);
  });

  it('returns tenantId when the tenant exists', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 'tenant-abc', name: 'user-1' });
    expect(await service.resolve('user-1')).toBe('tenant-abc');
    expect(mockFindOne).toHaveBeenCalledWith({ where: { name: 'user-1' } });
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
});
