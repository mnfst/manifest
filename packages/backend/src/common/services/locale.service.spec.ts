import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { LocaleService } from './locale.service';

describe('LocaleService', () => {
  const findOne = jest.fn();
  const update = jest.fn();
  const repo = { findOne, update } as unknown as Repository<Tenant>;
  const service = new LocaleService(repo);

  beforeEach(() => jest.clearAllMocks());

  it('returns English when no tenant is available', async () => {
    await expect(service.getTenantLocale(null)).resolves.toBe('en');
    expect(findOne).not.toHaveBeenCalled();
  });

  it('returns a stored supported locale', async () => {
    findOne.mockResolvedValue({ locale: 'ru' });
    await expect(service.getTenantLocale('tenant-1')).resolves.toBe('ru');
    expect(findOne).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, select: ['locale'] });
  });

  it('distinguishes an unset workspace preference from English', async () => {
    findOne.mockResolvedValue({ locale: null });
    await expect(service.getStoredTenantLocale('tenant-1')).resolves.toBeNull();
    findOne.mockResolvedValue({ locale: 'en' });
    await expect(service.getStoredTenantLocale('tenant-1')).resolves.toBe('en');
  });

  it('falls back when a legacy or invalid value is encountered', async () => {
    findOne.mockResolvedValue({ locale: 'de' });
    await expect(service.getTenantLocale('tenant-1')).resolves.toBe('en');
  });

  it('persists a validated locale', async () => {
    update.mockResolvedValue({ affected: 1 });
    await expect(service.setTenantLocale('tenant-1', 'ru')).resolves.toBe('ru');
    expect(update).toHaveBeenCalledWith({ id: 'tenant-1' }, { locale: 'ru' });
  });
});
